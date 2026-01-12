// app.css is intentionally not imported here. Individual controllers load their own CSS and the
// shared controller CSS is imported by the ScreenController base class.
import { TemplateResult, html, render } from "lit-html";
import { Ref, createRef, ref } from "lit-html/directives/ref.js";
import * as flatbuffers from "flatbuffers";
import { DialogController, OkDialog } from "./dialog_controller.ts";
import { DefaultScreenController, ScreenController } from "./controllers/screen_controller.ts";
import { DashboardController } from "./controllers/DashboardController";
import { LiveViewController } from "./controllers/LiveViewController";
import { RecipeEditorController } from "./controllers/RecipeEditorController";
import { AnalyticsController } from "./controllers/AnalyticsController";
import { CombinedSettingsController } from "./controllers/CombinedSettingsController";
import { Html} from "./utils/common.ts";
import { IsNotNullOrEmpty, MyFavouriteDateTimeFormat, Severity, severity2class, severity2symbol} from "@klaus-liebler/commons";
import { IAppManagement, IScreenControllerHost, IWebsocketMessageListener } from "./utils/interfaces.ts";
import RouterMenu, { IRouteHandler, Route } from "./utils/routermenu";
import {ArrayBufferToHexString} from "@klaus-liebler/commons"
import * as cfg from "@generated/runtimeconfig_ts"
import { setupRecipeManagement, receiveMessage, type CommandDto } from "./recipe_management";
import { ResponseWrapper } from "@generated/flatbuffers_ts/recipemanagement/response-wrapper";
import { ResponseJson } from "@generated/flatbuffers_ts/recipemanagement/response-json";
import { RequestJson } from "@generated/flatbuffers_ts/recipemanagement/request-json";
import { JsonPayload } from "@generated/flatbuffers_ts/recipemanagement/json-payload";
import { RequestWrapper } from "@generated/flatbuffers_ts/recipemanagement/request-wrapper";
import { Requests } from "@generated/flatbuffers_ts/recipemanagement/requests";


class Router2ContentAdapter implements IRouteHandler {
  constructor(public readonly child: ScreenController, public readonly app: AppController) { }
  handleRoute(params: RegExpMatchArray): void {

    console.log("Router2ContentAdapter->handleRoute")
    this.app.SetMain(this.child, params)
  }
}

class BufferedMessage {
  constructor(public data: Uint8Array, public namespace: number, public maxLockingTimeMs: number) { }
}

export class AppController implements IAppManagement, IScreenControllerHost {
  private routes: Array<Route> = []
  
  private namespace2listener = new Map<number, Array<IWebsocketMessageListener>>();
  private lockingNamespace:number|null=null;
  private socket: WebSocket | null = null;
  private messageBuffer = new Array<BufferedMessage>();
  private modalSpinner: Ref<HTMLDivElement> = createRef();
  private modalSpinnerTimeoutHandle: number = -1;


  private menu = new RouterMenu("/", this.routes);
  private mainContent: ScreenController = new DefaultScreenController(this);
  private mainRef: Ref<HTMLInputElement> = createRef();
  
  private dialog: Ref<HTMLDivElement> = createRef();
  private snackbarTimeout: number = -1;


  public ShowDialog(d: DialogController) {
    //this.dialog.value!.innerText="";
    render(d.Template(), this.dialog.value!)
    d.Show();
  }

  public RegisterWebsocketMessageNamespace(listener: IWebsocketMessageListener, ...namespaces: number[]): (() => void){
    namespaces.forEach((n) => {
      let arr = this.namespace2listener.get(n)
      if (!arr) {
        arr = []
        this.namespace2listener.set(n, arr)
      }
      arr.push(listener)
    })
    return () => {this.Unregister(listener)}
  }


  public Unregister(listener: IWebsocketMessageListener): void{
    console.info('unregister')
    this.namespace2listener.forEach((v) => {
      v.filter((l) => {
        l != listener
      })
    })
  }
  public SendFinishedBuilder(namespace:number, b:flatbuffers.Builder, maxLockingTimeMs: number=0):void{
    var arr= b.asUint8Array()
    
    
    var m=new BufferedMessage(arr, namespace, maxLockingTimeMs)
    if (!this.socket || this.socket.readyState != this.socket.OPEN) {
      console.info('sendWebsocketMessage --> not OPEN --> buffering')
      this.messageBuffer.push(m);
      return;
    }
    this.sendMessage(m);
  }

  private sendMessage(m:BufferedMessage){
    console.debug(`Send message of Namespace ${m.namespace} with net length ${m.data.byteLength} to server`)
    const bufferLength = 4 + m.data.byteLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const dataView = new DataView(arrayBuffer);
    dataView.setUint32(0, m.namespace, true);
    const newData = new Uint8Array(arrayBuffer);
    newData.set(m.data, 4);
    
    if(m.maxLockingTimeMs==0){
      this.lockingNamespace=null;
    }else{
      this.lockingNamespace=m.namespace;
      this.setModal(true)
      this.modalSpinnerTimeoutHandle = <number>(<unknown>setTimeout(() => this.modalSpinnerTimeout(), m.maxLockingTimeMs)) //casting to make TypeScript happy
    }

    console.debug(`sendWebsocketMessage for namespace ${m.namespace} --> OPEN --> send to server`)
    try {
      this.socket!.send(newData)
    } catch (error: any) {
      this.setModal(false)
      if (this.modalSpinnerTimeoutHandle) {
        clearTimeout(this.modalSpinnerTimeoutHandle)
      }
      this.ShowDialog(new OkDialog(Severity.ERROR, `Error while sending a request to server:${error}`))
    }
  }

  // ========== Recipe Management Command Sender ==========
  private sendRecipeCommand(cmd: CommandDto): void {
    const builder = new flatbuffers.Builder(256);
    
    // Serialize CommandDto to JSON
    const jsonStr = JSON.stringify(cmd);
    const jsonOffset = builder.createString(jsonStr);
    
    // Build FlatBuffers: CommandDto → JsonPayload → RequestJson → RequestWrapper
    JsonPayload.startJsonPayload(builder);
    JsonPayload.addJson(builder, jsonOffset);
    const payloadOffset = JsonPayload.endJsonPayload(builder);
    
    RequestJson.startRequestJson(builder);
    RequestJson.addPayload(builder, payloadOffset);
    const requestJsonOffset = RequestJson.endRequestJson(builder);
    
    RequestWrapper.startRequestWrapper(builder);
    RequestWrapper.addRequestType(builder, Requests.RequestJson);
    RequestWrapper.addRequest(builder, requestJsonOffset);
    const wrapperOffset = RequestWrapper.endRequestWrapper(builder);
    
    builder.finish(wrapperOffset);
    
    // Send via WebSocket with Namespace 11
    this.SendFinishedBuilder(11, builder);
  }

  private onWebsocketData(arrayBuffer: ArrayBuffer) {
    const dataView = new DataView(arrayBuffer);
    const namespace = dataView.getUint32(0, true);
    console.debug(`A message of namespace ${namespace} with length ${arrayBuffer.byteLength} has arrived: ${ArrayBufferToHexString(arrayBuffer)} .`)
    if (this.lockingNamespace==namespace) {
      clearTimeout(this.modalSpinnerTimeoutHandle)
      this.lockingNamespace = null
      this.setModal(false)
    }
    let bb = new flatbuffers.ByteBuffer(new Uint8Array(arrayBuffer, 4))
    //let messageWrapper = ResponseWrapper.getRootAsResponseWrapper(bb)
    const listeners = this.namespace2listener.get(namespace);
    if(!listeners ||listeners.length==0){
      console.warn(`No Listeners registered for messages with namespace ${namespace}`)
      return;
    }
    listeners.forEach((v) => {
      v.OnMessage(namespace, bb)
    })
  }


  public ShowSnackbar(severity: Severity, text: string, timeout = 3000) {
    if (this.snackbarTimeout >= 0) {
      clearInterval(this.snackbarTimeout);
    }
    var snackbar = document.getElementById("snackbar")!;
    snackbar.innerText = "";
    Html(snackbar, "span", [], [severity2class(severity)], severity2symbol(severity));
    Html(snackbar, "span", [], [], text);
    snackbar.style.visibility = "visible";
    snackbar.style.animation = "fadein 0.5s, fadeout 0.5s 2.5s";
    this.snackbarTimeout = <any>setTimeout(() => {
      snackbar.style.visibility = "hidden";
      snackbar.style.animation = "";
      this.snackbarTimeout = -1;
    }, timeout);
  }


  public SetMain(child: ScreenController, params: RegExpMatchArray) {
    this.mainContent.OnPausePublic();
    this.mainContent = child
    //this.mainRef.value!.innerText=""
    render(this.mainContent.Template(), this.mainRef.value!)
    this.mainContent.OnStartPublic();
    child.SetParameter(params)
  }

  public AddScreenController(url: string, urlPattern: RegExp, caption: TemplateResult<1>, controllerObject: ScreenController){ 
    var w = new Route(url, urlPattern, caption, new Router2ContentAdapter(controllerObject, this))
    this.routes.push(w)
    controllerObject.OnCreate();
    return controllerObject
  }

  private setModal(state: boolean) {
    this.modalSpinner.value!.style.display = state ? "flex" : "none";
  }

  private modalSpinnerTimeout() {
    this.setModal(false);
    this.ShowDialog(new OkDialog(Severity.ERROR, "Server did not respond"));
  }

  public log(text: string) {
    console.log(text)
  }

  constructor(
    private readonly appTitle:string, 
    private readonly websocketUrl:string, 
    private readonly google_api_key_for_chatbot_or_null_to_deactivate:string|null=null, 
    private readonly activateEastereggs=false, 
    private readonly additionalFooter:string=""){}

  
  public Startup() {
    // ========== Recipe Management Setup (ONCE) ==========
    setupRecipeManagement({
      sendMessage: (cmd: CommandDto) => this.sendRecipeCommand(cmd),
      registerWebSocket: (namespace: number, handler: (data: any) => void) => {
        // Register for Namespace 11
        this.RegisterWebsocketMessageNamespace({
          OnMessage: (namespace: number, bb: flatbuffers.ByteBuffer) => {
            const wrapper = ResponseWrapper.getRootAsResponseWrapper(bb);
            const responseType = wrapper.responseType();
            
            if (responseType === 1) { // ResponseJson is type 1
              const response = wrapper.response(new ResponseJson());
              if (response && response.payload()) {
                const jsonStr = response.payload()!.json();
                if (jsonStr) {
                  try {
                    const jsonObj = JSON.parse(jsonStr);
                    handler(jsonObj); // Call receiveMessage
                  } catch (e) {
                    console.error("Failed to parse Recipe Management JSON:", e);
                  }
                }
              }
            }
          }
        }, namespace);
      }
    });
    console.log("Recipe Management initialized in AppController");

    const menuIconRef: Ref<HTMLDivElement> = createRef();

    const updateMenuIcon = () => {
      if (!menuIconRef.value) return;
      const dropdown = document.querySelector('.nav-dropdown') as HTMLElement;
      const isOpen = dropdown && dropdown.style.display === 'block';

      const arrowDownIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="24" height="24" fill="white"><path d="M151.6 469.6C145.5 476.2 137 480 128 480s-17.5-3.8-23.6-10.4l-88-96c-11.9-13-11.1-33.3 2-45.2s33.3-11.1 45.2 2L96 365.7 96 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 301.7 32.4-35.4c11.9-13 32.2-13.9 45.2-2s13.9 32.2 2 45.2l-88 96zM320 32l32 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 128l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 128l160 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-160 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 128l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>`;
      const arrowUpIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="24" height="24" fill="white"><path d="M151.6 42.4C145.5 35.8 137 32 128 32s-17.5 3.8-23.6 10.4l-88 96c-11.9 13-11.1 33.3 2 45.2s33.3 11.1 45.2-2L96 146.3 96 448c0 17.7 14.3 32 32 32s32-14.3 32-32l0-301.7 32.4 35.4c11.9 13 32.2 13.9 45.2 2s13.9-32.2 2-45.2l-88-96zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-32 0zm0 128c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0zm0 128c-17.7 0-32 14.3-32 32s14.3 32 32 32l160 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-160 0zm0 128c-17.7 0-32 14.3-32 32s14.3 32 32 32l224 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-224 0z"/></svg>`;

      menuIconRef.value.innerHTML = isOpen ? arrowUpIcon : arrowDownIcon;
    };

    // Menüeinträge registrieren (Reihenfolge: Dashboard, Live, Recipe, Analytics, Combined Settings)
    this.AddScreenController(
      "/",
      /^\/$/,
      html`<span>📊</span><span>Dashboard</span>`,
      new DashboardController(this)
    );

    this.AddScreenController(
      "/live",
      /^\/live$/,
      html`<span>🌐</span><span>Live</span>`,
      new LiveViewController(this)
    );

    this.AddScreenController(
      "/recipe",
      /^\/recipe$/,
      html`<span>📖</span><span>Recipe</span>`,
      new RecipeEditorController(this)
    );

    this.AddScreenController(
      "/analytics",
      /^\/analytics$/,
      html`<span>📈</span><span>Analytics</span>`,
      new AnalyticsController(this)
    );

    this.AddScreenController(
      "/settings",
      /^\/settings$/,
      html`<span>⚙️</span><span>Settings</span>`,
      new CombinedSettingsController(this)
    );

    const Template = html`
      <nav>
        <div ${ref(menuIconRef)} class="nav-menu-icon" @click=${() => {
          this.menu.ToggleDropdown();
          setTimeout(updateMenuIcon, 0);
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="24" height="24" fill="white"><path d="M151.6 469.6C145.5 476.2 137 480 128 480s-17.5-3.8-23.6-10.4l-88-96c-11.9-13-11.1-33.3 2-45.2s33.3-11.1 45.2 2L96 365.7 96 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 301.7 32.4-35.4c11.9-13 32.2-13.9 45.2-2s13.9 32.2 2 45.2l-88 96zM320 32l32 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 128l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 128l160 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-160 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 128l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>
        </div>
        ${this.menu.Template()}
      </nav>
      <main ${ref(this.mainRef)}></main>
      <div ${ref(this.modalSpinner)} class="modal"><span class="loader"></span></div>
      <div id="snackbar">Some text some message..</div>
      <div ${ref(this.dialog)}></div>
    `;
    render(Template, document.body);
    window.onresize = () => {
      this.menu.ShowHamburgerMenuIfLargeScreen();
    };
    console.log(`Connecting to ${this.websocketUrl}`)
    this.setModal(true);
    this.socket = new WebSocket(this.websocketUrl)
    this.socket.binaryType = 'arraybuffer'
    this.socket.onopen = (_event) => {
      console.log(`Websocket is connected.`)
      this.setModal(false);
      if (this.messageBuffer.length > 0) {
        console.log(`There are ${this.messageBuffer.length} messages in buffer.`)
        for (const m of this.messageBuffer) {
          this.sendMessage(m);
        }
      }
      this.messageBuffer = new Array<BufferedMessage>()
    }
    this.socket.onerror = (event: Event) => {
      console.error(`Websocket error ${JSON.stringify(event)}`)
      this.ShowSnackbar(Severity.ERROR, "Websocket Error")
      this.setModal(true);
    }
    this.socket.onmessage = (event: MessageEvent<any>) => {
      this.onWebsocketData(event.data)
    }
    this.socket.onclose = (event) => {
      if (event.code == 1000) {
        console.info('The Websocket connection has been closed normally. But why????')
        return
      }
      console.error(`Websocket has been closed: ${JSON.stringify(event)}`)
      this.ShowSnackbar(Severity.ERROR, `Websocket has been closed`)
      this.setModal(true);
    }
    this.menu.check();
  }

  
    
    
  
}



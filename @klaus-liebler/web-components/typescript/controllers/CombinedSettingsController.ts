import { html, TemplateResult } from "lit-html";
import * as CFG from "@generated/runtimeconfig_ts/index";
import { ControllerState, ScreenController } from "./screen_controller";
import { WifimanagerController } from "./wifimanager_controller";
import { SystemController } from "./systeminfo_controller";
import { UsersettingsController } from "./usersettings_controller";
import { AppController } from "../app_controller";
import * as usersettings from "@generated/usersettings_ts/usersettings";
import '../../style/combined-settings.css';
import { CombinedSettingsTemplate } from "../templates/combinedsettings_template";

export class CombinedSettingsController extends ScreenController {
    private wifiController: WifimanagerController;
    private systemController: SystemController;
    private usersettingsController: UsersettingsController;
    private wifiStarted = false;
    private systemStarted = false;
    private usersettingsStarted = false;

    constructor(app: AppController) {
        super(app);
        this.wifiController = new WifimanagerController(app);
        this.systemController = new SystemController(app);
        this.usersettingsController = new UsersettingsController(
            app, 
            usersettings.Build(CFG.BOARD_NAME, CFG.BOARD_VERSION, [])
        );
    }

    private onWifiToggle(e: Event) {
        const details = e.target as HTMLDetailsElement;
        if (details.open && !this.wifiStarted) {
            console.log("Starting WiFi Controller...");
            this.wifiStarted = true;
            if (this.wifiController.State === ControllerState.CREATED) {
                this.wifiController.OnStartPublic();
            }
        }
    }

    private onSystemToggle(e: Event) {
        const details = e.target as HTMLDetailsElement;
        if (details.open && !this.systemStarted) {
            console.log("Starting System Controller...");
            this.systemStarted = true;
            if (this.systemController.State === ControllerState.CREATED) {
                this.systemController.OnStartPublic();
            }
        }
    }

    private onUsersettingsToggle(e: Event) {
        const details = e.target as HTMLDetailsElement;
        if (details.open && !this.usersettingsStarted) {
            console.log("Starting Usersettings Controller...");
            this.usersettingsStarted = true;
            if (this.usersettingsController.State === ControllerState.CREATED) {
                this.usersettingsController.OnStartPublic();
            }
        }
    }

    public Template(): TemplateResult<1> {
        // Pass the sub-controller templates into the shared template
        return CombinedSettingsTemplate(
            this.wifiController.Template(),
            this.systemController.Template(),
            this.usersettingsController.Template(),
            this.onWifiToggle.bind(this),
            this.onSystemToggle.bind(this),
            this.onUsersettingsToggle.bind(this),
        );
    }

    public OnCreate(): void {
        // Nur OnCreate aufrufen, aber NICHT starten
        // Dies registriert nur die WebSocket-Listener
        this.wifiController.OnCreate();
        this.systemController.OnCreate();
        this.usersettingsController.OnCreate();
    }

    protected OnFirstStart(): void {
        // WICHTIG: Die Sub-Controller NICHT automatisch starten!
        // Sie werden on-demand beim Aufklappen der Details gestartet
        console.log("CombinedSettingsController started - sub-controllers will start on-demand");
    }

    protected OnRestart(): void {
        // Nichts tun beim Neustart
    }

    public OnPause(): void {
        // Sub-Controller pausieren nur wenn sie gestartet wurden
        if (this.wifiStarted && this.wifiController.State === ControllerState.STARTED) {
            this.wifiController.OnPausePublic();
        }
        if (this.systemStarted && this.systemController.State === ControllerState.STARTED) {
            this.systemController.OnPausePublic();
        }
        if (this.usersettingsStarted && this.usersettingsController.State === ControllerState.STARTED) {
            this.usersettingsController.OnPausePublic();
        }
    }

    public OnMessage(namespace: number, bb: any): void {
        // Nachrichten an die Sub-Controller weiterleiten
        this.wifiController.OnMessage(namespace, bb);
        this.systemController.OnMessage(namespace, bb);
        this.usersettingsController.OnMessage(namespace, bb);
    }
}

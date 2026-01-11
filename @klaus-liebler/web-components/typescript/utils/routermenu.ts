import {TemplateResult, html, render} from 'lit-html';
import { createRef, ref, Ref } from 'lit-html/directives/ref.js';
import { IHtmlRenderer } from './interfaces';
import { MenuTemplate } from '../templates/menu_template';

export interface IRouteHandler {
  handleRoute(params: RegExpMatchArray): void;
}

export class Route {
  constructor(public readonly url:string, public readonly urlPattern: RegExp, public readonly caption:TemplateResult<1>, public readonly handler: IRouteHandler) { }
}

export default class RouterMenu implements IHtmlRenderer {
  private currentUrl = "";

  private dropdownRef: Ref<HTMLUListElement> = createRef();

  constructor(private readonly root="/", private routes:Array<Route>) {
    globalThis.window.onpopstate = (e:PopStateEvent) => {
      var newUrl = decodeURI(globalThis.location.pathname)
      newUrl = this.root != '/' ? newUrl.replace(this.root, '') : newUrl;
      if (this.currentUrl != newUrl) {
        this.check()
      }
      this.currentUrl = newUrl;
    }
  }

  RenderStatic(container: HTMLElement): void {
    try {
      // Map routes into the shape expected by MenuTemplate
      const mapped = this.routes.map(r => ({ url: r.url, caption: r.caption, clickHandler: (e:MouseEvent, u:string)=>this.navigation_anchor_clicked(e, u) }));
      render(MenuTemplate(mapped, /*menuIconRef*/ null, /*dropdownRef*/ this.dropdownRef, /*toggleHandler*/ (e:MouseEvent)=>this.ToggleDropdown()), container);
    } catch (err) {
      // fallback to embedded dropdown template
      render(this.Template(), container)
    }
  }

  public ToggleDropdown() {
    if (!this.dropdownRef.value) return;
    const style = this.dropdownRef.value.style;
    style.display = style.display === "block" ? "none" : "block";
  }

  public ShowHamburgerMenuIfLargeScreen() {
    if (!this.dropdownRef.value) return;
    // Beispiel: ab 900px Breite Dropdown immer anzeigen
    if (window.innerWidth > 900) {
      this.dropdownRef.value.style.display = "block";
    } else {
      this.dropdownRef.value.style.display = "none";
    }
  }

  public check() {
    var fragment = decodeURI(globalThis.location.pathname)
    for (var r of this.routes) {
      var match = fragment.match(r.urlPattern);
      if (match) {
        r.handler.handleRoute(match);
        break;
      }
    }
  }

  private navigation_anchor_clicked(e: MouseEvent, url: string) {
    e.preventDefault();
    this.ToggleDropdown();
    window.history.pushState(null, "", url);
    this.check();
  }

  public readonly Template = () => html`
    <ul class="nav-dropdown" ${ref(this.dropdownRef)} style="display:none;">
      ${this.routes.map((item: Route) => html`
        <li>
          <a 
            @click=${(e: MouseEvent) => this.navigation_anchor_clicked(e, item.url)} 
            href=${item.url}
            title=${item.caption.strings?.[0] ?? ""}
            style="display:flex;align-items:center;gap:8px;"
          >
            <span class="icon">${item.caption}</span>
          </a>
        </li>
      `)}
    </ul>
  `
}
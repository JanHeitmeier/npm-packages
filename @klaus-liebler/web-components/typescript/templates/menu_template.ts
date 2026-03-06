import { TemplateResult, html } from "lit-html";
import { unsafeSVG } from "lit-html/directives/unsafe-svg.js";
import { Ref } from 'lit-html/directives/ref.js';
import { ref } from 'lit-html/directives/ref.js';

import barsIcon from "../../svgs/solid/bars.svg?raw";

export function MenuTemplate(
    routes: Array<{url:string, caption: TemplateResult<1>, clickHandler:(e:MouseEvent, url:string)=>void}>,
    menuIconRef?: Ref<HTMLDivElement> | null,
    dropdownRef?: Ref<HTMLUListElement> | null,
    toggleHandler?: (e:MouseEvent)=>void
): TemplateResult<1> {
    // helper to extract a text label from a TemplateResult by rendering into a temporary container
    const extractLabel = (caption: TemplateResult<1>): string => {
      try {
        const tmp = document.createElement('div');
        // use Lit's render to fill the tmp and read text
        // import lazily to avoid cycles; render is available globally from lit-html in consumers
        // We attempt to use (window as any).litHtmlRender if available, else skip
        try {
          const renderFn = (window as any).litHtmlRender || ((window as any).render);
          if (renderFn) {
            renderFn(caption as any, tmp);
          } else {
            // fallback: inject the strings (best-effort)
            tmp.textContent = (caption as any).strings ? (caption as any).strings.join(' ') : '';
          }
        } catch (e) {
          tmp.textContent = (caption as any).strings ? (caption as any).strings.join(' ') : '';
        }
        const t = tmp.textContent || '';
        tmp.remove();
        return t.trim();
      } catch (e) {
        return '';
      }
    }

    const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

  return html`
    <nav class="app-menu">
          <div class="nav-menu-icon" ${menuIconRef ? ref(menuIconRef as any) : ''} @click=${(e:MouseEvent)=>{ if (toggleHandler) toggleHandler(e); }}>
            ${unsafeSVG(barsIcon)}
          </div>
          <ul class="nav-dropdown" ${dropdownRef ? ref(dropdownRef as any) : ''} style="display:none;">
            ${routes.map(r => {
                const label = extractLabel(r.caption) || '';
                const slug = slugify(label || r.url || 'item');
                const svgPath = `./svgs/solid/${slug}.svg`;
                return html`<li>
                  <a @click=${(e:MouseEvent)=>r.clickHandler(e, r.url)} href=${r.url} style="display:flex;align-items:center;justify-content:center;" title=${label} aria-label=${label}>
                    <img class="menu-item-icon" src=${svgPath} alt="" width="24" height="24" onerror="this.style.display='none'"/>
                  </a>
                </li>`
              }) }
          </ul>
        </nav>
    `;
}

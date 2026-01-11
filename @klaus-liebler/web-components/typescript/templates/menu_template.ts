import { TemplateResult, html } from "lit-html";
import { Ref } from 'lit-html/directives/ref.js';
import { ref } from 'lit-html/directives/ref.js';

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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="24" height="24" fill="white"><path d="M151.6 42.4C145.5 35.8 137 32 128 32s-17.5 3.8-23.6 10.4l-88 96c-11.9 13-11.1 33.3 2 45.2s33.3 11.1 45.2-2L96 146.3 96 448c0 17.7 14.3 32 32 32s32-14.3 32-32l0-301.7 32.4 35.4c11.9 13 32.2 13.9 45.2 2s13.9-32.2 2-45.2l-88-96zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-32 0zm0 128c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0zm0 128c-17.7 0-32 14.3-32 32s14.3 32 32 32l160 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-160 0zm0 128c-17.7 0-32 14.3-32 32s14.3 32 32 32l224 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-224 0z"></path></svg>
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

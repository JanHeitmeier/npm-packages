import { html, TemplateResult } from "lit-html";
import { Ref, createRef, ref } from "lit-html/directives/ref.js";
import "../../style/dashboard.css";
import { ScreenController } from "./screen_controller";
import { AppController } from "../app_controller";
import { renderDashboard, reRenderDashboard, sendCommand, type CommandDto } from "../recipe_management";
import * as flatbuffers from 'flatbuffers';

export class DashboardController extends ScreenController {
    private containerRef: Ref<HTMLDivElement> = createRef();

    constructor(app: AppController) {
        super(app);
    }

    public Template(): TemplateResult<1> {
        return html`
            <div ${ref(this.containerRef)} class="dashboard-content"></div>
        `;
    }

    public OnCreate(): void {
        // WebSocket registration happens in AppController
    }

    protected OnFirstStart(): void {
        const container = this.containerRef.value;
        if (container) {
            renderDashboard(container);
        }
    }

    protected OnRestart(): void {
        const container = this.containerRef.value;
        if (container) {
            renderDashboard(container);
        }
    }

    public OnPause(): void {
        // Renderer is persistent, nothing to cleanup
    }

    public OnMessage(namespace: number, bb: flatbuffers.ByteBuffer): void {
        // Handled by AppController
    }
}

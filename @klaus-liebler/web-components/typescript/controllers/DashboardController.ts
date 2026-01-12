import { html, TemplateResult } from "lit-html";
import { Ref, createRef, ref } from "lit-html/directives/ref.js";
import "../../style/dashboard.css";
import { ScreenController } from "./screen_controller";
import { AppController } from "../app_controller";
import { renderDashboard, sendCommand, type CommandDto } from "../recipe_management";
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

    private sendTestRecipe(): void {
        const testRecipe = {
            id: "test_recipe_002",
            name: "Red-Yellow Alternating Test",
            steps: [
                {stepTypeId: "0x0001", systemId: "step_red_led_1", aliases: {LED: "LED0", RedButton: "RedButton"}},
                {stepTypeId: "0x0002", systemId: "step_yellow_green_1", aliases: {LED: "LED1", GreenButton: "GreenButton"}}
            ]
        };

        const cmd: CommandDto = {
            command: 'start_recipe',
            payload: testRecipe,  // Send as object, not string
        };

        sendCommand(cmd);
        console.log('Sending recipe command:', JSON.stringify(cmd, null, 2));
        this.appManagement.ShowSnackbar('info' as any, 'Test-Rezept gesendet');
    }
}

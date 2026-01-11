import { TemplateResult } from "lit-html";
import "../../style/liveview.css";
import { ScreenController } from "./screen_controller";
import { AppController } from "../app_controller";
import { LiveViewTemplate } from "../templates/liveview_template";

export class LiveViewController extends ScreenController {
    constructor(app: AppController) {
        super(app);
    }

    public Template(): TemplateResult<1> {
        return LiveViewTemplate();
    }

    public OnCreate(): void {}

    protected OnFirstStart(): void {}

    protected OnRestart(): void {}

    public OnPause(): void {}

    public OnMessage(namespace: number, bb: any): void {}
}

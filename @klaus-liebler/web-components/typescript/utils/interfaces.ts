
import * as flatbuffers from "flatbuffers";
import { DialogController } from "../dialog_controller.ts";
import { TemplateResult } from "lit-html";
import { ScreenController } from "../controllers/screen_controller";
import { Severity } from "@klaus-liebler/commons";

export interface IDialogController____ {
    ShowDialog(pHandler?: ((ok: boolean, value: string) => any)): void;
};

export interface IDialogBodyRenderer {
    Render(dialogBody: HTMLElement): HTMLInputElement | null;
}

export interface IHtmlRenderer {
    RenderStatic(c: HTMLElement): void;
}

export interface IWebsocketMessageListener {
    OnMessage(namespace:number, byteBuffer: flatbuffers.ByteBuffer): void;
  }
export interface IScreenControllerHost {
   AddScreenController(url: string, urlPattern: RegExp, caption: TemplateResult<1>, controller:ScreenController):void;
}

export interface IAppManagement {
    RegisterWebsocketMessageNamespace(listener: IWebsocketMessageListener, namespace: number): (() => void);
    Unregister(listener: IWebsocketMessageListener): void;
    SendFinishedBuilder(namespace:number, b:flatbuffers.Builder, maxlockingTimeMs?: number):void;
    ShowSnackbar(severity: Severity, text: string): void;
    ShowDialog(dialogController: DialogController): void;
};
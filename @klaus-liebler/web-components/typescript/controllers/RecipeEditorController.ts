import { html, TemplateResult } from "lit-html";
import "../../style/recipe-editor.css";
import { ScreenController } from "./screen_controller";
import { AppController } from "../app_controller";

export class RecipeEditorController extends ScreenController {
    constructor(app: AppController) {
        super(app);
    }

    public Template(): TemplateResult<1> {
        return html`
            <div class="recipe-editor-container">
                <h1>Rezept Editor</h1>
                <div class="recipe-editor">
                    <p>Hier können Rezepte erstellt und bearbeitet werden</p>
                    <!-- Rezept-Editor Formular -->
                </div>
            </div>
        `;
    }

    public OnCreate(): void {
        // Initialisierung
    }

    protected OnFirstStart(): void {
        // Rezepte laden beim ersten Start
    }

    protected OnRestart(): void {
        // Beim Neustart nach Pause
    }

    public OnPause(): void {
        // Beim Pausieren
    }

    public OnMessage(namespace: number, bb: any): void {
        // WebSocket-Nachrichten verarbeiten
    }
}

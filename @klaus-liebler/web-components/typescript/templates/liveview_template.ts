import { TemplateResult, html } from "lit-html";

export function LiveViewTemplate(): TemplateResult<1> {
    return html`
        <div class="live-view-container">
            <div class="live-title">Live View</div>

            <div class="live-details">
                <h2>Details</h2>
                <div class="details-content"></div>
            </div>

            <div class="live-recipe-row">
                <div class="recipe-steps">
                    <div class="step-box">Schritt 1</div>
                </div>
            </div>

            <div class="live-sensors">
                <h2>Sensoren</h2>
                <div class="sensors-content"></div>
            </div>

            <div class="control-buttons">
                <button class="control-btn">▶</button>
                <button class="control-btn">⏸</button>
                <button class="control-btn">⏹</button>
            </div>

            <div class="live-instructions">
                <h3>Anweisungen</h3>
                <div class="instructions-content"></div>
            </div>

            <div class="live-acknowledge">
                <h3>Quittieren</h3>
                <div class="status-buttons">
                    <button class="status-btn">✓</button>
                    <button class="status-btn">✗</button>
                </div>
            </div>

            <div class="live-status">
                <h3>Status</h3>
                <div class="status-content"></div>
            </div>
        </div>
    `;
}

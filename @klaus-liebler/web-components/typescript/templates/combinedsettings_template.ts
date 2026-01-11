import { TemplateResult, html } from "lit-html";

export function CombinedSettingsTemplate(
    wifiTpl: TemplateResult<1>,
    systemTpl: TemplateResult<1>,
    usersettingsTpl: TemplateResult<1>,
    onWifiToggle?: (e: Event) => void,
    onSystemToggle?: (e: Event) => void,
    onUsersettingsToggle?: (e: Event) => void,
): TemplateResult<1> {
    return html`
        <div class="combined-settings">
            <div class="content">
                <h1>Einstellungen</h1>

                <details class="settings-section" data-section="wifi" @toggle=${onWifiToggle}>
                    <summary>
                        <h2>WiFi Einstellungen</h2>
                    </summary>
                    <div class="settings-content">
                        ${wifiTpl}
                    </div>
                </details>

                <details class="settings-section" data-section="system" @toggle=${onSystemToggle}>
                    <summary>
                        <h2>System Einstellungen</h2>
                    </summary>
                    <div class="settings-content">
                        ${systemTpl}
                    </div>
                </details>

                <details class="settings-section" data-section="usersettings" @toggle=${onUsersettingsToggle}>
                    <summary>
                        <h2>Benutzereinstellungen</h2>
                    </summary>
                    <div class="settings-content">
                        ${usersettingsTpl}
                    </div>
                </details>
            </div>
        </div>
    `;
}

/**
 * Analytics Renderer (Dummy Implementation)
 * Shows recorded metrics and charts
 * Based on: analytics.css
 */

import { recipeState } from '../state';
import type { ViewHandle } from './LiveViewRenderer';

export class AnalyticsRenderer implements ViewHandle {
    private container: HTMLElement;
    private unsubscribe: (() => void) | null = null;
    private sendCommandFn: ((cmd: any) => void) | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.classList.add('recipe-mgmt-analytics');
        
        // Subscribe to state changes
        this.unsubscribe = recipeState.subscribe(() => this.render());
    }

    setSendFunction(sendFn: (cmd: any) => void): void {
        this.sendCommandFn = sendFn;
    }

    setContainer(container: HTMLElement): void {
        this.container = container;
        this.container.classList.add('recipe-mgmt-analytics');
    }

    render(): void {
        this.container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 2rem; color: #333;">
                Analytics coming soon
            </div>
        `;
    }

    private renderMetrics(metrics: any): string {
        if (!metrics.series || metrics.series.length === 0) {
            return this.renderPlaceholder();
        }

        return `
            <div class="metrics-overview">
                <h2>Rezept: ${this.escapeHtml(metrics.recipeId)}</h2>
                <div class="metrics-grid">
                    ${metrics.series.map((series: any) => `
                        <div class="metric-card">
                            <h3>${this.escapeHtml(series.name)}</h3>
                            <div class="metric-chart">
                                ${this.renderSimpleChart(series)}
                            </div>
                            <div class="metric-stats">
                                <span>Datenpunkte: ${series.data.length}</span>
                                <span>Einheit: ${this.escapeHtml(series.unit)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    private renderSimpleChart(series: any): string {
        // Simple ASCII-style chart placeholder
        if (!series.data || series.data.length === 0) {
            return '<div class="chart-placeholder">Keine Daten</div>';
        }

        const values = series.data.map((d: any) => d.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;

        return `
            <div class="chart-simple">
                <div class="chart-bar" style="height: 100%; background: linear-gradient(to top, #4CAF50, #8BC34A);"></div>
                <div class="chart-stats">
                    <div>Min: ${min.toFixed(2)}</div>
                    <div>Avg: ${avg.toFixed(2)}</div>
                    <div>Max: ${max.toFixed(2)}</div>
                </div>
            </div>
        `;
    }

    private renderPlaceholder(): string {
        return `
            <div class="analytics-placeholder">
                <h2>📊 Analytics (Coming Soon)</h2>
                <p>Aufgezeichnete Messwerte und Diagramme werden hier angezeigt.</p>
                <p><small>Diese Funktion wird später mit Chart.js oder ähnlichen Bibliotheken erweitert.</small></p>
                
                <div class="feature-preview">
                    <h3>Geplante Features:</h3>
                    <ul>
                        <li>📈 Echtzeit-Diagramme für Sensor-Daten</li>
                        <li>📊 Historische Datenanalyse</li>
                        <li>💾 Export von Messwerten (CSV, JSON)</li>
                        <li>🔍 Vergleich verschiedener Rezept-Durchläufe</li>
                        <li>⚙️ Konfigurierbare Dashboards</li>
                    </ul>
                </div>
            </div>
        `;
    }

    private attachEventListeners(): void {
        const buttons = this.container.querySelectorAll('[data-action]');
        buttons.forEach(btn => {
            const action = (btn as HTMLElement).dataset.action;
            btn.addEventListener('click', () => this.handleAction(action!));
        });
    }

    private handleAction(action: string): void {
        if (action === 'refresh') {
            // Request metrics update
            if (this.sendCommandFn) {
                // TODO: Implement metrics request command
                console.log('Metrics refresh requested');
            }
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.container.innerHTML = '';
        this.container.classList.remove('recipe-mgmt-analytics');
    }

    isVisible(): boolean {
        return this.container.offsetParent !== null;
    }
}

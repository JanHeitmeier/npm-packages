import { recipeState } from '../state';
import { escapeHtml } from '../utils';
import type { LiveViewDto } from '../types';

export interface ViewHandle {
    destroy(): void;
    isVisible(): boolean;
}

export class LiveViewRenderer implements ViewHandle {
    private container: HTMLElement;
    private unsubscribe: (() => void) | null = null;
    private sendCommandFn: ((cmd: any) => void) | null = null;
    private isDescriptionModalOpen: boolean = false;
    private pollingIntervalId: number | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.classList.add('recipe-mgmt-live-view');
        this.unsubscribe = recipeState.subscribe(() => this.render());
    }

    setSendFunction(sendFn: (cmd: any) => void): void {
        this.sendCommandFn = sendFn;
    }

    setContainer(container: HTMLElement): void {
        this.container = container;
        this.container.classList.add('recipe-mgmt-live-view');
    }

    private startPolling(): void {
        this.stopPolling();
        this.pollingIntervalId = window.setInterval(() => {
            const liveView = recipeState.getLiveView();
            if (liveView && (liveView.recipeStatus === 'running' || liveView.recipeStatus === 'paused')) {
                // Only request updates if there are sensors to monitor
                if (Object.keys(liveView.sensorValues || {}).length > 0 && this.sendCommandFn) {
                    this.sendCommandFn({ command: 'request_live_view' });
                }
            }
        }, 500);
    }

    private stopPolling(): void {
        if (this.pollingIntervalId !== null) {
            window.clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
        }
    }

    render(): void {
        const liveView = recipeState.getLiveView();
        
        if (!liveView) {
            this.container.innerHTML = `
                <div class="live-view-container">
                    <div class="live-title">Live View</div>
                    <div class="live-details">
                        <h2>Details</h2>
                        <div class="details-content">Waiting for recipe start...</div>
                    </div>
                    <div class="live-progress-bar"></div>
                    <div class="live-recipe-row">
                        <div class="recipe-steps">
                            <div class="step-box">No recipe active</div>
                        </div>
                    </div>
                    <div class="live-sensors">
                        <h2>Sensors</h2>
                        <div class="sensors-content">No data</div>
                    </div>
                    <div class="control-buttons">
                        <button class="control-btn" disabled>▶</button>
                        <button class="control-btn" disabled>⏸</button>
                        <button class="control-btn" disabled>⏹</button>
                    </div>
                    <div class="live-instructions">
                        <h3>Instructions</h3>
                        <div class="instructions-content"></div>
                    </div>
                    <div class="live-acknowledge">
                        <h3>Acknowledge</h3>
                        <div class="status-buttons">
                            <button class="status-btn" disabled>✓</button>
                            <button class="status-btn" disabled>✗</button>
                        </div>
                    </div>
                    <div class="live-status">
                        <h3>Status</h3>
                        <div class="status-content"></div>
                    </div>
                </div>
            `;
            return;
        }

        const currentRecipe = recipeState.getCurrentRecipe();
        
        const lastModified = currentRecipe?.lastModified 
            ? new Date(currentRecipe.lastModified).toLocaleString('de-DE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'N/A';

        this.container.innerHTML = `
            <div class="live-view-container">
                <div class="live-title">Live View</div>

                <div class="live-details">
                    <h2>Details</h2>
                    <div class="details-content">
                        <div class="detail-column">
                            <div class="detail-row">
                                <span class="detail-label">Name:</span>
                                <span class="detail-value">${escapeHtml(liveView.recipeName || currentRecipe?.name || 'N/A')}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Author:</span>
                                <span class="detail-value">${escapeHtml(currentRecipe?.author || 'N/A')}</span>
                            </div>
                        </div>
                        <div class="detail-column">
                            <div class="detail-row">
                                <span class="detail-label">Version:</span>
                                <span class="detail-value">${escapeHtml(currentRecipe?.version || 'N/A')}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Modified:</span>
                                <span class="detail-value">${lastModified}</span>
                            </div>
                        </div>
                        <div class="detail-column">
                            <button class="detail-btn" data-action="show-description">📄 Description</button>
                        </div>
                    </div>
                </div>

                <div class="live-progress-bar" style="position: relative;">
                    <div class="progress-fill" style="height: ${liveView.progress * 100}%;"></div>
                    <span class="progress-text" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10;">${Math.round(liveView.progress * 100)}%</span>
                </div>

                <div class="live-recipe-row">
                    <div class="recipe-steps">
                        ${this.renderSteps(liveView)}
                    </div>
                </div>

                <div class="live-sensors">
                    <h2>Sensors</h2>
                    <div class="sensors-content">
                        ${this.renderSensors(liveView.sensorValues || {})}
                    </div>
                </div>

                <div class="control-buttons">
                    ${this.renderControlButtons(liveView)}
                </div>

                <div class="live-instructions">
                    <h3>Instructions</h3>
                    <div class="instructions-content">
                        ${liveView.userInstruction ? escapeHtml(liveView.userInstruction) : 'No instructions'}
                    </div>
                </div>

                <div class="live-acknowledge">
                    <h3>Acknowledge</h3>
                    <div class="status-buttons">
                        ${liveView.awaitingUserAcknowledgment ? `
                            <button class="status-btn ack-ok" data-action="acknowledge">✓ Confirm</button>
                        ` : `
                            <button class="status-btn" disabled>—</button>
                        `}
                    </div>
                </div>

                <div class="live-status">
                    <h3>Status</h3>
                    <div class="status-content">
                        <strong>${escapeHtml(liveView.recipeName || currentRecipe?.name || 'Unknown Recipe')}</strong>
                        <span class="status-badge status-${liveView.recipeStatus}">${liveView.recipeStatus}</span>
                        <div>${liveView.errorMessage ? escapeHtml(liveView.errorMessage) : 'Active'}</div>
                    </div>
                </div>
                
                ${this.isDescriptionModalOpen ? this.renderDescriptionModal() : ''}
            `;

        this.attachEventListeners();
        
        // Start or stop polling based on recipe status and sensor availability
        if ((liveView.recipeStatus === 'running' || liveView.recipeStatus === 'paused') 
            && Object.keys(liveView.sensorValues || {}).length > 0) {
            this.startPolling();
        } else {
            this.stopPolling();
        }
    }

    private renderDescriptionModal(): string {
        const currentRecipe = recipeState.getCurrentRecipe();
        const description = currentRecipe?.description || 'No description available';
        
        return `
            <div class="modal-overlay" data-action="close-description" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div class="modal-content" style="max-width: 600px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-height: 80vh; overflow: auto;" onclick="event.stopPropagation()">
                    <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #e0e0e0; position: relative;">
                        <h2 style="margin: 0;">Recipe Description</h2>
                        <button class="modal-close" data-action="close-description" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
                    </div>
                    <div class="modal-body" style="padding: 20px; white-space: pre-wrap; line-height: 1.6;">
                        ${escapeHtml(description)}
                    </div>
                    <div class="modal-footer" style="padding: 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end;">
                        <button class="btn-secondary" data-action="close-description" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
                    </div>
                </div>
            </div>
        `;
    }

    private renderSteps(liveView: LiveViewDto): string {
        const currentRecipe = recipeState.getCurrentRecipe();
        const availableSteps = recipeState.getAvailableSteps();
        
        const steps: string[] = [];
        for (let i = 0; i < liveView.totalSteps; i++) {
            const isCurrent = i === liveView.currentStepIndex;
            const isPast = i < liveView.currentStepIndex;
            const stepClass = isCurrent ? 'step-box current' : isPast ? 'step-box completed' : 'step-box';
            
            // Try to get display name from recipe and available steps metadata
            let stepDisplayName = `Step ${i + 1}`;
            if (currentRecipe && currentRecipe.steps && currentRecipe.steps[i]) {
                const stepTypeId = currentRecipe.steps[i].stepTypeId;
                if (availableSteps && availableSteps.steps) {
                    const stepMeta = availableSteps.steps.find(s => s.typeId === stepTypeId);
                    if (stepMeta) {
                        stepDisplayName = stepMeta.displayName;
                    }
                }
            }
            
            steps.push(`
                <div class="${stepClass}">
                    ${escapeHtml(stepDisplayName)}
                </div>
            `);
        }
        return steps.join('');
    }

    private renderSensors(sensorValues: Record<string, number>): string {
        const entries = Object.entries(sensorValues);
        
        if (entries.length === 0) {
            return '<p>No sensor data available</p>';
        }

        return entries.map(([name, value]) => {
            // Check if this looks like a boolean value (0 or 1)
            const isBooleanLike = (value === 0 || value === 1) && Number.isInteger(value);
            const displayValue = isBooleanLike 
                ? (value === 1 ? '✓ True' : '✗ False')
                : value.toFixed(2);
            
            return `
                <div class="sensor-item">
                    <span class="sensor-name">${escapeHtml(name)}:</span>
                    <span class="sensor-value">${displayValue}</span>
                </div>
            `;
        }).join('');
    }

    private renderControlButtons(liveView: LiveViewDto): string {
        const status = liveView.recipeStatus;
        
        if (status === 'running') {
            return `
                <button class="control-btn" data-action="pause"><span style="font-size: 1.5em;">⏸</span> Pause</button>
                <button class="control-btn" data-action="stop"><span style="font-size: 1.5em;">⏹</span> Stop</button>
            `;
        } else if (status === 'paused') {
            return `
                <button class="control-btn" data-action="resume"><span style="font-size: 1.5em;">▶</span> Resume</button>
                <button class="control-btn" data-action="stop"><span style="font-size: 1.5em;">⏹</span> Stop</button>
            `;
        } else {
            return '<p>Recipe not active</p>';
        }
    }

    private attachEventListeners(): void {
        const buttons = this.container.querySelectorAll('[data-action]');
        buttons.forEach(btn => {
            const action = (btn as HTMLElement).dataset.action;
            btn.addEventListener('click', () => this.handleAction(action!));
        });
    }

    private handleAction(action: string): void {
        console.log('[LiveViewRenderer] handleAction called with action:', action);
        
        if (action === 'show-description') {
            this.isDescriptionModalOpen = true;
            this.render();
            return;
        }
        
        if (action === 'close-description') {
            this.isDescriptionModalOpen = false;
            this.render();
            return;
        }
        
        if (!this.sendCommandFn) {
            console.error('Send function not configured');
            return;
        }

        const commandMap: Record<string, string> = {
            'pause': 'pause_recipe',
            'resume': 'resume_recipe',
            'stop': 'stop_recipe',
            'acknowledge': 'acknowledge_step',
        };

        const command = commandMap[action];
        if (command) {
            console.log('[LiveViewRenderer] Sending command:', command);
            this.sendCommandFn({ command });
        } else {
            console.warn('[LiveViewRenderer] Unknown action:', action);
        }
    }

    destroy(): void {
        this.stopPolling();
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.container.innerHTML = '';
        this.container.classList.remove('recipe-mgmt-live-view');
    }

    isVisible(): boolean {
        return this.container.offsetParent !== null;
    }
}

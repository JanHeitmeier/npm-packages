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

        this.container.innerHTML = `
            <div class="live-view-container">
                <div class="live-title">
                    ${escapeHtml(liveView.recipeName)} 
                    <span class="status-badge status-${liveView.recipeStatus}">${liveView.recipeStatus}</span>
                </div>

                <div class="live-details">
                    <h2>Details</h2>
                    <div class="details-content">
                        Recipe ID: ${escapeHtml(liveView.recipeId)}<br>
                        Step: ${liveView.currentStepIndex + 1} / ${liveView.totalSteps}<br>
                        Progress: ${Math.round(liveView.progress * 100)}%
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
                        ${this.renderSensors(liveView.sensorValues)}
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
                            <button class="status-btn ack-ok" data-action="acknowledge">✓ OK</button>
                            <button class="status-btn ack-cancel" data-action="stop">✗ Cancel</button>
                        ` : `
                            <button class="status-btn" disabled>✓</button>
                            <button class="status-btn" disabled>✗</button>
                        `}
                    </div>
                </div>

                <div class="live-status">
                    <h3>Status</h3>
                    <div class="status-content">
                        ${liveView.errorMessage ? escapeHtml(liveView.errorMessage) : 'Active'}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    private renderSteps(liveView: LiveViewDto): string {
        // Get current recipe to access step type IDs
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

        return entries.map(([name, value]) => `
            <div class="sensor-item">
                <span class="sensor-name">${escapeHtml(name)}:</span>
                <span class="sensor-value">${value.toFixed(2)}</span>
            </div>
        `).join('');
    }

    private renderControlButtons(liveView: LiveViewDto): string {
        const status = liveView.recipeStatus;
        
        if (status === 'running') {
            return `
                <button class="control-btn" data-action="pause">⏸ Pause</button>
                <button class="control-btn" data-action="stop">⏹ Stop</button>
            `;
        } else if (status === 'paused') {
            return `
                <button class="control-btn" data-action="resume">▶ Resume</button>
                <button class="control-btn" data-action="stop">⏹ Stop</button>
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
            this.sendCommandFn({ command });
        }
    }

    destroy(): void {
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

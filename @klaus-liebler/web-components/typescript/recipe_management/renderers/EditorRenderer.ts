/**
 * Recipe Editor Renderer
 * Allows creating and editing recipes
 * Based on: recipe-editor.css
 */

import { recipeState } from '../state';
import type { RecipeDto, StepConfigDto } from '../types';
import type { ViewHandle } from './LiveViewRenderer';

export class EditorRenderer implements ViewHandle {
    private container: HTMLElement;
    private unsubscribe: (() => void) | null = null;
    private sendCommandFn: ((cmd: any) => void) | null = null;
    
    private currentRecipe: RecipeDto = {
        id: '',
        name: '',
        description: '',
        steps: [],
        author: '',
        version: '1.0',
    };

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.classList.add('recipe-mgmt-editor');
        
        // Subscribe to state changes
        this.unsubscribe = recipeState.subscribe(() => this.onStateChange());
    }

    setSendFunction(sendFn: (cmd: any) => void): void {
        this.sendCommandFn = sendFn;
    }

    setContainer(container: HTMLElement): void {
        this.container = container;
        this.container.classList.add('recipe-mgmt-editor');
    }

    private requestAvailableSteps(): void {
        if (this.sendCommandFn) {
            this.sendCommandFn({ command: 'get_available_steps' });
        }
    }

    private onStateChange(): void {
        const recipe = recipeState.getCurrentRecipe();
        if (recipe) {
            this.currentRecipe = { ...recipe };
        }
        this.render();
    }

    render(): void {
        const availableSteps = recipeState.getAvailableSteps();
        const mode = 1; // 1 = List, 2 = Edit
        
        // Container IST bereits das Editor-Div, nutze Grid-Layout
        this.container.innerHTML = `
            <div class="editor-title">Recipe Editor</div>

            <div class="editor-info">
                <h2>Info</h2>
                <p>Rezeptverwaltung</p>
            </div>

            <!-- Modus 1: Rezeptverwaltung -->
            <div class="recipe-list-view" style="display: ${mode === 1 ? 'flex' : 'none'};">
                <h2>Rezepte</h2>
                <div class="recipe-list-content">
                    <p>Rezeptliste wird hier angezeigt</p>
                </div>
            </div>

            <!-- Modus 2: Rezeptbearbeitung - Links -->
            <div class="recipe-edit-left" style="display: ${mode === 2 ? 'flex' : 'none'};">
                <div class="recipe-meta">
                    <h3>Rezept-Details</h3>
                    <input type="text" placeholder="Rezept Name" style="width: 100%; padding: 8px; margin-bottom: 8px;">
                    <textarea placeholder="Beschreibung" style="width: 100%; padding: 8px; resize: vertical;"></textarea>
                </div>
                <div class="recipe-steps">
                    <h3>Schritte</h3>
                    <div class="steps-list">
                        <p>Schrittliste</p>
                    </div>
                </div>
                <div class="add-step-button">
                    <button style="width: 100%; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">+ Schritt hinzufügen</button>
                </div>
            </div>

            <!-- Modus 2: Rezeptbearbeitung - Rechts -->
            <div class="recipe-edit-right" style="display: ${mode === 2 ? 'flex' : 'none'};">
                <div class="dynamic-content">
                    <p>Dynamischer Bereich</p>
                </div>
            </div>

            <!-- Aktionsleiste -->
            <div class="editor-actions">
                <h3>Aktionen</h3>
                <button style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Neues Rezept</button>
                <button style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Importieren</button>
            </div>
                <div class="editor-header">
                    <h1>Rezept Editor</h1>
                    <div class="editor-actions">
                        <button class="btn-secondary" data-action="new">📄 Neues Rezept</button>
                        <button class="btn-primary" data-action="save">💾 Speichern</button>
                    </div>
                </div>

                <div class="editor-content">
                    <div class="recipe-metadata">
                        <h2>Rezept-Informationen</h2>
                        <div class="form-group">
                            <label for="recipe-name">Name:</label>
                            <input type="text" id="recipe-name" value="${this.escapeHtml(this.currentRecipe.name)}" placeholder="Rezeptname" />
                        </div>
                        <div class="form-group">
                            <label for="recipe-description">Beschreibung:</label>
                            <textarea id="recipe-description" placeholder="Beschreibung des Rezepts">${this.escapeHtml(this.currentRecipe.description)}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="recipe-author">Autor:</label>
                            <input type="text" id="recipe-author" value="${this.escapeHtml(this.currentRecipe.author)}" placeholder="Autor" />
                        </div>
                    </div>

                    <div class="recipe-steps-editor">
                        <div class="steps-header">
                            <h2>Schritte (${this.currentRecipe.steps.length})</h2>
                            <button class="btn-primary" data-action="add-step">+ Schritt hinzufügen</button>
                        </div>
                        <div class="steps-list">
                            ${this.renderSteps()}
                        </div>
                    </div>

                    ${availableSteps ? `
                        <div class="available-steps">
                            <h3>Verfügbare Schritt-Typen</h3>
                            <div class="step-types-grid">
                                ${this.renderAvailableSteps(availableSteps)}
                            </div>
                        </div>
                    ` : '<p>Lade verfügbare Schritt-Typen...</p>'}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    private renderSteps(): string {
        if (this.currentRecipe.steps.length === 0) {
            return '<div class="empty-steps">Noch keine Schritte definiert</div>';
        }

        return this.currentRecipe.steps
            .sort((a, b) => a.order - b.order)
            .map((step, index) => `
                <div class="step-item" data-step-index="${index}">
                    <div class="step-header">
                        <span class="step-number">${step.order + 1}</span>
                        <span class="step-type">${this.escapeHtml(step.stepTypeId)}</span>
                        <div class="step-actions">
                            <button class="btn-icon" data-action="move-up" data-step-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
                            <button class="btn-icon" data-action="move-down" data-step-index="${index}" ${index === this.currentRecipe.steps.length - 1 ? 'disabled' : ''}>↓</button>
                            <button class="btn-icon btn-danger" data-action="delete-step" data-step-index="${index}">🗑</button>
                        </div>
                    </div>
                    <div class="step-parameters">
                        ${this.renderStepParameters(step)}
                    </div>
                </div>
            `).join('');
    }

    private renderStepParameters(step: StepConfigDto): string {
        const params = Object.entries(step.parameters);
        if (params.length === 0) {
            return '<div class="no-parameters">Keine Parameter definiert</div>';
        }

        return params.map(([key, value]) => `
            <div class="parameter-item">
                <label>${this.escapeHtml(key)}:</label>
                <input type="text" value="${this.escapeHtml(value)}" data-param-key="${this.escapeHtml(key)}" />
            </div>
        `).join('');
    }

    private renderAvailableSteps(availableSteps: any): string {
        if (!availableSteps.steps || availableSteps.steps.length === 0) {
            return '<p>Keine Schritt-Typen verfügbar</p>';
        }

        return availableSteps.steps.map((stepMeta: any) => `
            <div class="step-type-card" data-step-type="${this.escapeHtml(stepMeta.typeId)}">
                <h4>${this.escapeHtml(stepMeta.displayName)}</h4>
                <p class="step-type-description">${this.escapeHtml(stepMeta.description)}</p>
                <span class="step-type-category">${this.escapeHtml(stepMeta.category)}</span>
            </div>
        `).join('');
    }

    private attachEventListeners(): void {
        // Action buttons
        const buttons = this.container.querySelectorAll('[data-action]');
        buttons.forEach(btn => {
            const action = (btn as HTMLElement).dataset.action;
            const stepIndex = (btn as HTMLElement).dataset.stepIndex;
            btn.addEventListener('click', () => this.handleAction(action!, stepIndex));
        });

        // Input changes for metadata
        const nameInput = this.container.querySelector('#recipe-name') as HTMLInputElement;
        const descInput = this.container.querySelector('#recipe-description') as HTMLTextAreaElement;
        const authorInput = this.container.querySelector('#recipe-author') as HTMLInputElement;

        if (nameInput) nameInput.addEventListener('input', (e) => {
            this.currentRecipe.name = (e.target as HTMLInputElement).value;
        });
        if (descInput) descInput.addEventListener('input', (e) => {
            this.currentRecipe.description = (e.target as HTMLTextAreaElement).value;
        });
        if (authorInput) authorInput.addEventListener('input', (e) => {
            this.currentRecipe.author = (e.target as HTMLInputElement).value;
        });

        // Parameter changes
        const paramInputs = this.container.querySelectorAll('[data-param-key]');
        paramInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                const key = target.dataset.paramKey!;
                const stepItem = target.closest('[data-step-index]') as HTMLElement;
                const stepIndex = parseInt(stepItem.dataset.stepIndex!);
                this.currentRecipe.steps[stepIndex].parameters[key] = target.value;
            });
        });

        // Step type card clicks
        const stepTypeCards = this.container.querySelectorAll('.step-type-card');
        stepTypeCards.forEach(card => {
            card.addEventListener('click', () => {
                const stepType = (card as HTMLElement).dataset.stepType!;
                this.addStep(stepType);
            });
        });
    }

    private handleAction(action: string, stepIndexStr?: string): void {
        const stepIndex = stepIndexStr !== undefined ? parseInt(stepIndexStr) : -1;

        switch (action) {
            case 'new':
                this.newRecipe();
                break;
            case 'save':
                this.saveRecipe();
                break;
            case 'add-step':
                // Prompt for step type
                break;
            case 'delete-step':
                if (stepIndex >= 0) {
                    this.deleteStep(stepIndex);
                }
                break;
            case 'move-up':
                if (stepIndex > 0) {
                    this.moveStep(stepIndex, stepIndex - 1);
                }
                break;
            case 'move-down':
                if (stepIndex < this.currentRecipe.steps.length - 1) {
                    this.moveStep(stepIndex, stepIndex + 1);
                }
                break;
        }
    }

    private newRecipe(): void {
        this.currentRecipe = {
            id: `recipe_${Date.now()}`,
            name: '',
            description: '',
            steps: [],
            author: '',
            version: '1.0',
        };
        this.render();
    }

    private saveRecipe(): void {
        if (!this.sendCommandFn) {
            console.error('Send function not configured');
            return;
        }

        if (!this.currentRecipe.name.trim()) {
            alert('Bitte gib einen Rezeptnamen ein');
            return;
        }

        // Generate ID if new recipe
        if (!this.currentRecipe.id) {
            this.currentRecipe.id = `recipe_${Date.now()}`;
        }

        this.sendCommandFn({
            command: 'save_recipe',
            payload: JSON.stringify(this.currentRecipe),
        });

        alert('Rezept gespeichert');
    }

    private addStep(stepTypeId: string): void {
        const newStep: StepConfigDto = {
            stepTypeId,
            parameters: {},
            order: this.currentRecipe.steps.length,
        };
        this.currentRecipe.steps.push(newStep);
        this.render();
    }

    private deleteStep(index: number): void {
        this.currentRecipe.steps.splice(index, 1);
        // Reorder
        this.currentRecipe.steps.forEach((step, i) => step.order = i);
        this.render();
    }

    private moveStep(fromIndex: number, toIndex: number): void {
        const [moved] = this.currentRecipe.steps.splice(fromIndex, 1);
        this.currentRecipe.steps.splice(toIndex, 0, moved);
        // Reorder
        this.currentRecipe.steps.forEach((step, i) => step.order = i);
        this.render();
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
        this.container.classList.remove('recipe-mgmt-editor');
    }

    isVisible(): boolean {
        return this.container.offsetParent !== null;
    }
}

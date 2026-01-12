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
    private selectedStepIndex: number = -1;
    private backendStepsLoaded: boolean = false;
    private backendRecipesLoaded: boolean = false;
    
    private currentRecipe: RecipeDto = {
        id: '',
        name: '',
        description: '',
        steps: [],
        author: '',
        version: '1.0',
    };
    
    private isStepSelectorOpen = false;
    private isRecipeLoaderOpen = false;

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.classList.add('recipe-mgmt-editor');
        
        // Subscribe to state changes
        this.unsubscribe = recipeState.subscribe(() => this.onStateChange());
        
        // Request available recipes from backend (always load from machine first)
        this.loadRecipeList();
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
            console.log('[EditorRenderer] Requesting available steps');
            this.sendCommandFn({ command: 'get_available_steps' });
        } else {
            console.warn('[EditorRenderer] sendCommandFn not configured yet');
        }
    }

    private onStateChange(): void {
        const recipe = recipeState.getCurrentRecipe();
        if (recipe) {
            this.currentRecipe = { ...recipe };
        }
        
        const availableSteps = recipeState.getAvailableSteps();
        if (availableSteps && availableSteps.steps) {
            console.log('[EditorRenderer] Available steps received from backend:', availableSteps.steps.length);
            this.backendStepsLoaded = true;
            
            // Replace localStorage with backend data (even if empty)
            try {
                if (availableSteps.steps.length > 0) {
                    localStorage.setItem('recipe_available_steps', JSON.stringify(availableSteps));
                    console.log('[EditorRenderer] Steps replaced in localStorage');
                } else {
                    localStorage.removeItem('recipe_available_steps');
                    console.log('[EditorRenderer] No steps from backend - localStorage cleared');
                }
            } catch (error) {
                console.error('[EditorRenderer] Error updating localStorage:', error);
            }
        }
        
        const availableRecipes = recipeState.getAvailableRecipes();
        if (availableRecipes && availableRecipes.recipes) {
            console.log('[EditorRenderer] Available recipes received from backend:', availableRecipes.recipes.length);
            this.backendRecipesLoaded = true;
            
            // Replace localStorage with backend data (even if empty)
            try {
                if (availableRecipes.recipes.length > 0) {
                    localStorage.setItem('recipe_available_recipes', JSON.stringify(availableRecipes));
                    console.log('[EditorRenderer] Recipes replaced in localStorage');
                } else {
                    localStorage.removeItem('recipe_available_recipes');
                    console.log('[EditorRenderer] No recipes from backend - localStorage cleared');
                }
            } catch (error) {
                console.error('[EditorRenderer] Error updating localStorage:', error);
            }
        }
        
        this.render();
    }

    private loadRecipeList(): void {
        console.log('[EditorRenderer] Loading recipe list from backend (machine)...');
        
        // Always request from backend first (at least once)
        if (!this.backendRecipesLoaded) {
            console.log('[EditorRenderer] Requesting recipes from backend');
            this.requestRecipeList();
            return;
        }
        
        // After backend has been loaded once, check state first
        const availableRecipes = recipeState.getAvailableRecipes();
        if (availableRecipes && availableRecipes.recipes && availableRecipes.recipes.length > 0) {
            console.log('[EditorRenderer] Recipes already in state:', availableRecipes.recipes.length);
            return;
        }
        
        // Fallback to localStorage if backend request failed
        try {
            const cachedRecipes = localStorage.getItem('recipe_available_recipes');
            if (cachedRecipes) {
                console.log('[EditorRenderer] Loading recipes from localStorage as fallback');
                const parsedRecipes = JSON.parse(cachedRecipes);
                recipeState.setAvailableRecipes(parsedRecipes);
                return;
            }
        } catch (error) {
            console.error('[EditorRenderer] Error reading from localStorage:', error);
        }
        
        // Request from backend again
        
        // No cached recipes - request from backend
        console.log('[EditorRenderer] Requesting recipes from backend');
        this.requestRecipeList();
    }

    private requestRecipeList(): void {
        if (this.sendCommandFn) {
            console.log('[EditorRenderer] Sending get_recipe_list command');
            this.sendCommandFn({ command: 'get_recipe_list' });
        } else {
            console.warn('[EditorRenderer] sendCommandFn not configured yet');
        }
    }

    render(): void {
        const availableSteps = recipeState.getAvailableSteps();
        
        this.container.innerHTML = `
            <div class="editor-grid-container">
                <!-- Header: Title -->
                <div class="editor-title">
                    <h1>Recipe Editor</h1>
                </div>

                <!-- Header: Action Buttons -->
                <div class="editor-actions">
                    <button class="btn-secondary" data-action="open-recipe-loader">📂 Load</button>
                    <button class="btn-secondary" data-action="new">📄 New</button>
                    <button class="btn-primary" data-action="save">💾 Save</button>
                </div>

                <!-- Left: Recipe Details (Fixed, Non-Scrollable) -->
                <div class="editor-details">
                    <h2>Details</h2>
                    <div class="details-form">
                        <div class="form-group">
                            <label for="recipe-name">Name:</label>
                            <input type="text" id="recipe-name" value="${this.escapeHtml(this.currentRecipe.name)}" placeholder="Recipe name" required />
                        </div>
                        <div class="form-group">
                            <label for="recipe-description">Description:</label>
                            <textarea id="recipe-description" placeholder="Description" rows="3">${this.escapeHtml(this.currentRecipe.description)}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="recipe-author">Author:</label>
                            <input type="text" id="recipe-author" value="${this.escapeHtml(this.currentRecipe.author)}" placeholder="Author" />
                        </div>
                        <div class="form-group">
                            <label for="recipe-version">Version:</label>
                            <input type="text" id="recipe-version" value="${this.escapeHtml(this.currentRecipe.version)}" placeholder="1.0" />
                        </div>
                    </div>
                </div>

                <!-- Center: Steps List (Scrollable) -->
                <div class="editor-steps-list">
                    <div class="steps-list-header">
                        <h2>Steps (${this.currentRecipe.steps.length})</h2>
                        <button class="btn-success" data-action="open-step-selector">+ Add</button>
                    </div>
                    <div class="steps-list-content">
                        ${this.renderStepsList()}
                    </div>
                </div>

                <!-- Right: Step Parameters (Scrollable if needed) -->
                <div class="editor-step-parameters">
                    <div class="parameters-header">
                        <h2>Parameter</h2>
                    </div>
                    <div class="parameters-content">
                        ${this.renderStepParameters()}
                    </div>
                </div>
            </div>

            <!-- Step Selector Modal -->
            <div class="step-selector-modal ${this.isStepSelectorOpen ? 'active' : ''}" data-modal="step-selector">
                <div class="step-selector-content">
                    <div class="step-selector-header">
                        <h2>Schritt-Typ auswählen</h2>
                        <button class="btn-secondary" data-action="close-step-selector">✕ Schließen</button>
                    </div>
                    <div class="step-selector-body">
                        ${availableSteps ? this.renderStepSelector(availableSteps) : '<p class="loading">Lade verfügbare Schritt-Typen...</p>'}
                    </div>
                </div>
            </div>

            <!-- Recipe Loader Modal -->
            <div class="step-selector-modal ${this.isRecipeLoaderOpen ? 'active' : ''}" data-modal="recipe-loader">
                <div class="step-selector-content">
                    <div class="step-selector-header">
                        <h2>Rezept zum Bearbeiten auswählen</h2>
                        <button class="btn-secondary" data-action="close-recipe-loader">✕ Schließen</button>
                    </div>
                    <div class="step-selector-body">
                        ${this.renderRecipeLoader()}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    private renderRecipeLoader(): string {
        const availableRecipes = recipeState.getAvailableRecipes();
        
        if (!availableRecipes || !availableRecipes.recipes || availableRecipes.recipes.length === 0) {
            return '<p class="loading">Keine Rezepte verfügbar. Erstelle zuerst ein Rezept und speichere es.</p>';
        }

        return `
            <div class="step-type-list">
                ${availableRecipes.recipes.map((recipe: any) => `
                    <div class="step-type-item" data-action="load-recipe" data-recipe-id="${this.escapeHtml(recipe.id)}">
                        <h4>${this.escapeHtml(recipe.name)}</h4>
                        <p>${this.escapeHtml(recipe.description || 'Keine Beschreibung')}</p>
                        <span class="step-type-category">ID: ${this.escapeHtml(recipe.id)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private renderStepsList(): string {
        if (this.currentRecipe.steps.length === 0) {
            return '<div class="empty-steps">No steps defined yet. Click "+ Add" to add a step.</div>';
        }

        return this.currentRecipe.steps
            .sort((a, b) => a.order - b.order)
            .map((step, index) => `
                <div class="step-item ${this.selectedStepIndex === index ? 'selected' : ''}" data-action="select-step-item" data-step-index="${index}">
                    <div class="step-item-header">
                        <span class="step-number">${step.order + 1}</span>
                        <span class="step-type-name">${this.escapeHtml(this.getStepDisplayName(step.stepTypeId))}</span>
                        <div class="step-actions">
                            <button class="btn-icon" data-action="move-up" data-step-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
                            <button class="btn-icon" data-action="move-down" data-step-index="${index}" ${index === this.currentRecipe.steps.length - 1 ? 'disabled' : ''}>↓</button>
                            <button class="btn-icon btn-danger" data-action="delete-step" data-step-index="${index}">🗑</button>
                        </div>
                    </div>
                    <div class="step-category">${this.escapeHtml(step.stepTypeId)}</div>
                </div>
            `).join('');
    }

    private renderStepParameters(): string {
        if (this.selectedStepIndex < 0 || this.selectedStepIndex >= this.currentRecipe.steps.length) {
            return '<div class="no-step-selected">← Select a step from the list to edit its parameters</div>';
        }

        const step = this.currentRecipe.steps[this.selectedStepIndex];
        const availableSteps = recipeState.getAvailableSteps();
        const stepMeta = availableSteps?.steps?.find((s: any) => s.typeId === step.stepTypeId);

        if (!stepMeta || !stepMeta.parameters || stepMeta.parameters.length === 0) {
            return '<div class="no-step-selected">This step has no configurable parameters</div>';
        }

        return stepMeta.parameters.map((paramMeta: any) => {
            const currentValue = step.parameters[paramMeta.name] || paramMeta.defaultValue || '';
            
            // Determine input type and attributes based on parameter type
            let inputType = 'text';
            let minAttr = '';
            let maxAttr = '';
            let stepAttr = '';
            
            if (paramMeta.type === 'int' || paramMeta.type === 'float') {
                inputType = 'number';
                if (paramMeta.minValue !== undefined && paramMeta.minValue !== '' && paramMeta.minValue !== '0') {
                    minAttr = `min="${this.escapeHtml(paramMeta.minValue)}"`;
                }
                if (paramMeta.maxValue !== undefined && paramMeta.maxValue !== '' && paramMeta.maxValue !== '0') {
                    maxAttr = `max="${this.escapeHtml(paramMeta.maxValue)}"`;
                }
                if (paramMeta.type === 'float') {
                    stepAttr = 'step="any"';
                } else {
                    stepAttr = 'step="1"';
                }
            } else if (paramMeta.type === 'bool') {
                inputType = 'checkbox';
            }
            
            // Format range display
            let rangeText = '';
            if (paramMeta.minValue && paramMeta.maxValue) {
                rangeText = `Range: ${paramMeta.minValue} - ${paramMeta.maxValue}`;
            } else if (paramMeta.minValue) {
                rangeText = `Min: ${paramMeta.minValue}`;
            } else if (paramMeta.maxValue) {
                rangeText = `Max: ${paramMeta.maxValue}`;
            }
            
            return `
                <div class="parameter-item-wide">
                    <div class="parameter-label-section">
                        <label>${this.escapeHtml(paramMeta.name)}${paramMeta.required ? ' *' : ''}</label>
                    </div>
                    <div class="parameter-input-section">
                        <div class="parameter-input-group">
                            <input 
                                type="${inputType}" 
                                value="${this.escapeHtml(currentValue)}" 
                                data-param-key="${this.escapeHtml(paramMeta.name)}"
                                placeholder="${this.escapeHtml(paramMeta.defaultValue || '')}"
                                ${paramMeta.required ? 'required' : ''}
                                ${minAttr}
                                ${maxAttr}
                                ${stepAttr}
                            />
                            ${paramMeta.unit ? `<span class="parameter-unit">${this.escapeHtml(paramMeta.unit)}</span>` : ''}
                        </div>
                        ${paramMeta.description ? `<div class="parameter-description">${this.escapeHtml(paramMeta.description)}</div>` : ''}
                        ${rangeText ? `<div class="parameter-limits">${rangeText}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    private getStepDisplayName(typeId: string): string {
        const availableSteps = recipeState.getAvailableSteps();
        const stepMeta = availableSteps?.steps?.find((s: any) => s.typeId === typeId);
        return stepMeta?.displayName || typeId;
    }

    private renderStepSelector(availableSteps: any): string {
        console.log('[EditorRenderer] Rendering step selector with steps:', availableSteps);
        
        if (!availableSteps.steps || availableSteps.steps.length === 0) {
            return '<p>No step types available</p>';
        }

        return `
            <div class="step-type-list">
                ${availableSteps.steps.map((stepMeta: any) => `
                    <div class="step-type-item" data-action="select-step" data-step-type="${this.escapeHtml(stepMeta.typeId)}">
                        <h3>${this.escapeHtml(stepMeta.displayName)}</h3>
                        <p>${this.escapeHtml(stepMeta.description)}</p>
                        <span class="category">${this.escapeHtml(stepMeta.category)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private attachEventListeners(): void {
        // Action buttons
        const buttons = this.container.querySelectorAll('[data-action]');
        buttons.forEach(btn => {
            const action = (btn as HTMLElement).dataset.action;
            const stepIndex = (btn as HTMLElement).dataset.stepIndex;
            const stepType = (btn as HTMLElement).dataset.stepType;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleAction(action!, stepIndex, stepType);
            });
        });

        // Input changes for metadata
        const nameInput = this.container.querySelector('#recipe-name') as HTMLInputElement;
        const descInput = this.container.querySelector('#recipe-description') as HTMLTextAreaElement;
        const authorInput = this.container.querySelector('#recipe-author') as HTMLInputElement;
        const versionInput = this.container.querySelector('#recipe-version') as HTMLInputElement;

        if (nameInput) nameInput.addEventListener('input', (e) => {
            this.currentRecipe.name = (e.target as HTMLInputElement).value;
        });
        if (descInput) descInput.addEventListener('input', (e) => {
            this.currentRecipe.description = (e.target as HTMLTextAreaElement).value;
        });
        if (authorInput) authorInput.addEventListener('input', (e) => {
            this.currentRecipe.author = (e.target as HTMLInputElement).value;
        });
        if (versionInput) versionInput.addEventListener('input', (e) => {
            this.currentRecipe.version = (e.target as HTMLInputElement).value;
        });

        // Parameter changes
        const paramInputs = this.container.querySelectorAll('[data-param-key]');
        paramInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                const key = target.dataset.paramKey!;
                if (this.selectedStepIndex >= 0 && this.selectedStepIndex < this.currentRecipe.steps.length) {
                    this.currentRecipe.steps[this.selectedStepIndex].parameters[key] = target.value;
                }
            });
        });

        // Modal backdrop close
        const modal = this.container.querySelector('[data-modal="step-selector"]');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeStepSelector();
                }
            });
        }

        const recipeLoaderModal = this.container.querySelector('[data-modal="recipe-loader"]');
        if (recipeLoaderModal) {
            recipeLoaderModal.addEventListener('click', (e) => {
                if (e.target === recipeLoaderModal) {
                    this.closeRecipeLoader();
                }
            });
        }
    }

    private handleAction(action: string, stepIndexStr?: string, stepType?: string): void {
        const stepIndex = stepIndexStr !== undefined ? parseInt(stepIndexStr) : -1;

        switch (action) {
            case 'new':
                this.confirmNewRecipe();
                break;
            case 'save':
                this.saveRecipe();
                break;
            case 'open-step-selector':
                this.openStepSelector();
                break;
            case 'close-step-selector':
                this.closeStepSelector();
                break;
            case 'open-recipe-loader':
                this.openRecipeLoader();
                break;
            case 'close-recipe-loader':
                this.closeRecipeLoader();
                break;
            case 'select-step':
                if (stepType) {
                    this.addStep(stepType);
                    this.closeStepSelector();
                }
                break;
            case 'load-recipe':
                const recipeId = (event?.target as HTMLElement)?.closest('[data-recipe-id]')?.getAttribute('data-recipe-id');
                if (recipeId) {
                    this.loadRecipe(recipeId);
                    this.closeRecipeLoader();
                }
                break;
            case 'select-step-item':
                if (stepIndex >= 0) {
                    this.selectStep(stepIndex);
                }
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

    private confirmNewRecipe(): void {
        const hasContent = this.currentRecipe.name || 
                          this.currentRecipe.description || 
                          this.currentRecipe.steps.length > 0;
        
        if (hasContent) {
            if (confirm('Are you sure you want to remove the filled in fields?')) {
                this.newRecipe();
            }
        } else {
            this.newRecipe();
        }
    }

    private openRecipeLoader(): void {
        this.isRecipeLoaderOpen = true;
        console.log('[EditorRenderer] Opening recipe loader');
        this.render();
    }

    private closeRecipeLoader(): void {
        this.isRecipeLoaderOpen = false;
        this.render();
    }

    private loadRecipe(recipeId: string): void {
        if (!this.sendCommandFn) {
            console.error('[EditorRenderer] Send function not configured');
            return;
        }

        console.log('[EditorRenderer] Loading recipe:', recipeId);
        this.sendCommandFn({
            command: 'get_recipe',
            recipeId: recipeId,
        });
    }

    private selectStep(index: number): void {
        this.selectedStepIndex = index;
        this.render();
    }

    private openStepSelector(): void {
        console.log('[EditorRenderer] Opening step selector');
        
        // Always request from backend first (at least once)
        if (!this.backendStepsLoaded) {
            console.log('[EditorRenderer] Requesting steps from backend (machine)');
            this.requestAvailableSteps();
            this.isStepSelectorOpen = true;
            this.render();
            return;
        }
        
        // After backend has been loaded once, check state first
        const availableSteps = recipeState.getAvailableSteps();
        if (availableSteps && availableSteps.steps && availableSteps.steps.length > 0) {
            console.log('[EditorRenderer] Steps already in state:', availableSteps.steps.length);
            this.isStepSelectorOpen = true;
            this.render();
            return;
        }
        
        // Fallback to localStorage if backend request failed
        try {
            const cachedSteps = localStorage.getItem('recipe_available_steps');
            if (cachedSteps) {
                console.log('[EditorRenderer] Loading steps from localStorage as fallback');
                const parsedSteps = JSON.parse(cachedSteps);
                recipeState.setAvailableSteps(parsedSteps);
                this.isStepSelectorOpen = true;
                this.render();
                return;
            }
        } catch (error) {
            console.error('[EditorRenderer] Error reading from localStorage:', error);
        }
        
        // Request from backend again
        console.log('[EditorRenderer] Requesting steps from backend');
        this.requestAvailableSteps();
        this.isStepSelectorOpen = true;
        this.render();
    }

    private closeStepSelector(): void {
        this.isStepSelectorOpen = false;
        this.render();
    }

    private newRecipe(): void {
        this.currentRecipe = {
            id: '',  // Empty ID - will be generated on save
            name: '',
            description: '',
            steps: [],
            author: '',
            version: '1.0',
        };
        this.selectedStepIndex = -1;
        this.render();
    }

    private saveRecipe(): void {
        if (!this.sendCommandFn) {
            console.error('[EditorRenderer] Send function not configured');
            return;
        }

        if (!this.currentRecipe.name.trim()) {
            alert('Bitte gib einen Rezeptnamen ein');
            return;
        }

        // Generate ID with timestamp if new recipe (ID will be used as creation timestamp)
        if (!this.currentRecipe.id || this.currentRecipe.id === '') {
            this.currentRecipe.id = `recipe_${Date.now()}`;
        }

        console.log('[EditorRenderer] Saving recipe:', this.currentRecipe);

        // Send recipe object directly in payload, not as JSON string
        this.sendCommandFn({
            command: 'save_recipe',
            payload: this.currentRecipe,
        });

        alert('Rezept gespeichert');
        // Refresh to show updated creation date
        this.render();
    }

    private addStep(stepTypeId: string): void {
        // Get step metadata to extract default aliases
        const availableSteps = recipeState.getAvailableSteps();
        const stepMeta = availableSteps?.steps?.find(s => s.typeId === stepTypeId);
        
        // Build aliases map from step metadata defaults
        const aliases: Record<string, string> = {};
        if (stepMeta && stepMeta.ioAliases) {
            for (const ioAlias of stepMeta.ioAliases) {
                // Use defaultPhysicalName from backend (defined in Steps.cc)
                aliases[ioAlias.aliasName] = ioAlias.defaultPhysicalName || ioAlias.aliasName;
            }
        }
        
        const newStep: StepConfigDto = {
            stepTypeId,
            parameters: {},
            aliases: aliases,  // Include default aliases from backend
            order: this.currentRecipe.steps.length,
        };
        
        console.log('[EditorRenderer] Adding step with aliases from backend:', aliases);
        this.currentRecipe.steps.push(newStep);
        this.render();
    }

    private deleteStep(index: number): void {
        this.currentRecipe.steps.splice(index, 1);
        // Reorder
        this.currentRecipe.steps.forEach((step, i) => step.order = i);
        // Reset selection if deleted step was selected
        if (this.selectedStepIndex === index) {
            this.selectedStepIndex = -1;
        } else if (this.selectedStepIndex > index) {
            this.selectedStepIndex--;
        }
        this.render();
    }

    private moveStep(fromIndex: number, toIndex: number): void {
        const [moved] = this.currentRecipe.steps.splice(fromIndex, 1);
        this.currentRecipe.steps.splice(toIndex, 0, moved);
        // Reorder
        this.currentRecipe.steps.forEach((step, i) => step.order = i);
        // Update selected index
        if (this.selectedStepIndex === fromIndex) {
            this.selectedStepIndex = toIndex;
        }
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

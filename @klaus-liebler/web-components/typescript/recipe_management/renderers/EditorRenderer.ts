import { recipeState } from '../state';
import * as Templates from './EditorTemplates';
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
        const availableRecipes = recipeState.getAvailableRecipes();
        
        this.container.innerHTML = Templates.renderMainEditor(
            this.currentRecipe,
            this.selectedStepIndex,
            this.isStepSelectorOpen,
            this.isRecipeLoaderOpen,
            availableSteps,
            availableRecipes,
            this.renderStepParameters(),
            (typeId) => this.getStepDisplayName(typeId)
        );

        this.attachEventListeners();
    }

    private renderStepParameters(): string {
        if (this.selectedStepIndex < 0 || this.selectedStepIndex >= this.currentRecipe.steps.length) {
            return '<div class="no-step-selected">← Select a step from the list to edit its parameters</div>';
        }

        const step = this.currentRecipe.steps[this.selectedStepIndex];
        const availableSteps = recipeState.getAvailableSteps();
        const stepMeta = availableSteps?.steps?.find((s: any) => s.typeId === step.stepTypeId);

        return Templates.renderStepParameters(step, stepMeta);
    }

    private getStepDisplayName(typeId: string): string {
        const availableSteps = recipeState.getAvailableSteps();
        const stepMeta = availableSteps?.steps?.find((s: any) => s.typeId === typeId);
        return stepMeta?.displayName || typeId;
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

        // Validate name (required)
        if (!this.currentRecipe.name.trim()) {
            alert('Bitte gib einen Rezeptnamen ein');
            return;
        }
        if (this.currentRecipe.name.length > 50) {
            alert('Rezeptname ist zu lang (max. 50 Zeichen)');
            return;
        }
        
        // Validate description (required)
        if (!this.currentRecipe.description.trim()) {
            alert('Bitte gib eine Beschreibung ein');
            return;
        }
        if (this.currentRecipe.description.length > 500) {
            alert('Beschreibung ist zu lang (max. 500 Zeichen)');
            return;
        }
        
        // Validate author (required)
        if (!this.currentRecipe.author.trim()) {
            alert('Bitte gib einen Autor ein');
            return;
        }
        if (this.currentRecipe.author.length > 50) {
            alert('Autorenname ist zu lang (max. 50 Zeichen)');
            return;
        }
        
        // Validate version (required)
        if (!this.currentRecipe.version.trim()) {
            alert('Bitte gib eine Version ein');
            return;
        }
        const versionPattern = /^\d+(\.\d+){0,2}$/;
        if (!versionPattern.test(this.currentRecipe.version.trim())) {
            alert('Version muss im Format X.Y oder X.Y.Z sein (z.B. 1.0 oder 1.2.3)');
            return;
        }
        
        // Check if recipe already exists with same version
        if (this.currentRecipe.id && this.currentRecipe.id !== '') {
            const availableRecipes = recipeState.getAvailableRecipes();
            if (availableRecipes && availableRecipes.recipes) {
                const existingRecipe = availableRecipes.recipes.find(r => r.id === this.currentRecipe.id);
                if (existingRecipe) {
                    // Recipe exists - check if we're loading an existing recipe
                    const originalRecipe = recipeState.getCurrentRecipe();
                    if (originalRecipe && originalRecipe.id === this.currentRecipe.id && 
                        originalRecipe.version === this.currentRecipe.version) {
                        // Same version - warn user
                        if (!confirm(`Du speicherst Änderungen mit derselben Versionsnummer (${this.currentRecipe.version}).\n\nMöchtest du die Version erhöhen oder trotzdem mit derselben Version speichern?\n\nOK = Mit gleicher Version speichern\nAbbrechen = Versionsnummer anpassen`)) {
                            return;
                        }
                    }
                }
            }
        }

        // Generate ID with name, version and timestamp if new recipe
        // Format: NAME_v1_0_recipe_1234567890
        if (!this.currentRecipe.id || this.currentRecipe.id === '') {
            const sanitizedName = this.currentRecipe.name.trim()
                .replace(/[^a-zA-Z0-9_-]/g, '_')  // Replace special chars with underscore
                .replace(/_{2,}/g, '_')            // Replace multiple underscores with single
                .substring(0, 30);                  // Limit length
            
            const sanitizedVersion = this.currentRecipe.version.trim()
                .replace(/\./g, '_')                // Replace dots with underscores (v1.0 -> v1_0)
                .replace(/[^a-zA-Z0-9_]/g, '');    // Remove other special chars
            
            const timestamp = Date.now();
            this.currentRecipe.id = `${sanitizedName}_v${sanitizedVersion}_recipe_${timestamp}`;
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

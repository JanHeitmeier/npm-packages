import { recipeState } from '../state';
import { escapeHtml } from '../utils';
import type { ViewHandle } from './LiveViewRenderer';

export class DashboardRenderer implements ViewHandle {
    private container: HTMLElement;
    private unsubscribe: (() => void) | null = null;
    private sendCommandFn: ((cmd: any) => void) | null = null;
    private navigateFn: ((view: 'live' | 'dashboard' | 'editor' | 'analytics') => void) | null = null;
    private backendRecipesLoaded: boolean = false;
    private isStartConfirmModalOpen: boolean = false;
    private selectedRecipeForStart: { id: string; name: string; globalParameters: Record<string, string> } | null = null;
    private currentlySelectedRecipeId: string = '';

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.classList.add('recipe-mgmt-dashboard');
        this.unsubscribe = recipeState.subscribe(() => this.onStateChange());
        
        // Request recipe list and execution history immediately on construction
        this.requestRecipeList();
        this.requestExecutionHistory();
    }

    setSendFunction(sendFn: (cmd: any) => void): void {
        this.sendCommandFn = sendFn;
    }
    
    setNavigateFunction(navigateFn: (view: 'live' | 'dashboard' | 'editor' | 'analytics') => void): void {
        this.navigateFn = navigateFn;
    }

    setContainer(container: HTMLElement): void {
        this.container = container;
        this.container.classList.add('recipe-mgmt-dashboard');
        // Reload data when container is set (e.g., when switching back to dashboard)
        this.requestRecipeList();
        this.requestExecutionHistory();
    }

    private deleteRecipeFromLocalStorage(recipeId: number): void {
        try {
            const cachedRecipes = localStorage.getItem('recipe_available_recipes');
            if (!cachedRecipes) {
                return;
            }
            
            let recipes = JSON.parse(cachedRecipes);
            recipes.recipes = recipes.recipes.filter((r: any) => r.id !== recipeId);
            
            localStorage.setItem('recipe_available_recipes', JSON.stringify(recipes));
            console.log('[DashboardRenderer] Deleted recipe from localStorage:', recipeId);
        } catch (error) {
            console.error('[DashboardRenderer] Error deleting recipe from localStorage:', error);
        }
    }

    private onStateChange(): void {
        const availableRecipes = recipeState.getAvailableRecipes();
        if (availableRecipes && availableRecipes.recipes) {
            this.backendRecipesLoaded = true;
            
            // Replace localStorage with backend data (even if empty)
            try {
                if (availableRecipes.recipes.length > 0) {
                    localStorage.setItem('recipe_available_recipes', JSON.stringify(availableRecipes));
                } else {
                    localStorage.removeItem('recipe_available_recipes');
                }
            } catch (error) {
                console.error('[DashboardRenderer] Error updating localStorage:', error);
            }
        }
        this.render();
    }

    private loadRecipeList(): void {
        if (!this.backendRecipesLoaded) {
            console.log('[DashboardRenderer] Requesting recipes from backend');
            this.requestRecipeList();
            this.render();
            return;
        }
        

        const availableRecipes = recipeState.getAvailableRecipes();
        if (availableRecipes && availableRecipes.recipes && availableRecipes.recipes.length > 0) {
            console.log('[DashboardRenderer] Recipes already in state:', availableRecipes.recipes.length);
            this.render();
            return;
        }
        

        try {
            const cachedRecipes = localStorage.getItem('recipe_available_recipes');
            if (cachedRecipes) {
                console.log('[DashboardRenderer] Loading recipes from localStorage as fallback');
                const parsedRecipes = JSON.parse(cachedRecipes);
                recipeState.setAvailableRecipes(parsedRecipes);
                this.render();
                return;
            }
        } catch (error) {
            console.error('[DashboardRenderer] Error reading from localStorage:', error);
        }
        

        this.requestRecipeList();
        this.render();
    }

    private requestRecipeList(): void {
        if (this.sendCommandFn) {
            console.log('[DashboardRenderer] Requesting recipe list from backend');
            this.sendCommandFn({ command: 'get_recipe_list' });
        }
    }

    private requestExecutionHistory(): void {
        if (this.sendCommandFn) {
            console.log('[DashboardRenderer] Requesting execution history from backend');
            this.sendCommandFn({ command: 'get_execution_history' });
        }
    }

    render(): void {
        const availableRecipes = recipeState.getAvailableRecipes();
        
        // Save current selection before re-rendering
        const currentSelect = this.container.querySelector('#recipe-select') as HTMLSelectElement;
        if (currentSelect && currentSelect.value) {
            this.currentlySelectedRecipeId = currentSelect.value;
        }
        
        this.container.innerHTML = `
            <div class="dashboard-container">
                <div class="dashboard-title">Dashboard</div>

                <div class="dashboard-user">
                    <h2>User</h2>
                    <p>Recipe Management</p>
                </div>

                <div class="recipe-start dashboard-field">
                    <h2>Start Recipe</h2>
                    ${this.renderRecipeList(availableRecipes)}
                </div>

                <div class="quick-stats dashboard-field">
                    <h2>Overview</h2>
                    <p>Available Recipes: ${availableRecipes?.recipes?.length || 0}</p>
                    <p>Recipe Executions in History: ${recipeState.getExecutionHistory()?.executions?.length || 0}</p>
                </div>

                <div class="recipe-history dashboard-field">
                    <h2>Recent Recipes</h2>
                    ${this.renderExecutionHistory()}
                </div>
            </div>
            
            ${this.isStartConfirmModalOpen ? this.renderStartConfirmModal() : ''}
        `;

        // Restore selection after re-rendering (before attaching listeners)
        if (this.currentlySelectedRecipeId) {
            const newSelect = this.container.querySelector('#recipe-select') as HTMLSelectElement;
            if (newSelect) {
                newSelect.value = this.currentlySelectedRecipeId;
            }
        }

        this.attachEventListeners();
    }
    
    private renderStartConfirmModal(): string {
        if (!this.selectedRecipeForStart) return '';
        
        const globalParamsHtml = Object.keys(this.selectedRecipeForStart.globalParameters).length > 0
            ? `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                    <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #666;">Recipe Parameters:</h3>
                    ${Object.entries(this.selectedRecipeForStart.globalParameters).map(([key, value]) => `
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">
                                ${escapeHtml(key)}
                            </label>
                            <input 
                                type="text" 
                                data-global-param="${escapeHtml(key)}"
                                value="${escapeHtml(value)}"
                                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;" />
                        </div>
                    `).join('')}
                </div>
            `
            : '';
        
        return `
            <div class="modal-overlay" data-action="close-start-confirm" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div class="modal-content" style="max-width: 500px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
                    <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #e0e0e0; position: relative;">
                        <h2 style="margin: 0;">Start Recipe</h2>
                        <button class="modal-close" data-action="close-start-confirm" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <p style="font-size: 16px; margin-bottom: 10px;">
                            <strong>"${escapeHtml(this.selectedRecipeForStart.name)}"</strong>
                        </p>
                        <p style="color: #666; font-size: 13px; margin: 0;">
                            ID: ${escapeHtml(this.selectedRecipeForStart.id)}
                        </p>
                        ${globalParamsHtml}
                    </div>
                    <div class="modal-footer" style="padding: 20px; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn-secondary" data-action="close-start-confirm" style="padding: 10px 20px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                        <button class="btn-primary" data-action="confirm-start-recipe" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Start</button>
                    </div>
                </div>
            </div>
        `;
    }

    private renderRecipeList(availableRecipes: any): string {
        if (!availableRecipes || !availableRecipes.recipes || availableRecipes.recipes.length === 0) {
            return '<p>No recipes available</p>';
        }

        return `
            <select id="recipe-select" style="width: 100%; padding: 8px; margin-bottom: 10px;">
                <option value="">-- Select Recipe --</option>
                ${availableRecipes.recipes.map((recipe: any) => `
                    <option value="${escapeHtml(recipe.id)}" ${this.currentlySelectedRecipeId === recipe.id ? 'selected' : ''}>
                        ${escapeHtml(recipe.name)} (v${escapeHtml(recipe.version || '1.0')})
                    </option>
                `).join('')}
            </select>
            <button class="btn-primary" data-action="start" style="padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">▶ Start Recipe</button>
        `;
    }

    private renderExecutionHistory(): string {
        const history = recipeState.getExecutionHistory();
        
        if (!history || !history.executions || history.executions.length === 0) {
            return '<p>No execution history available</p>';
        }

        const recentExecutions = history.executions.slice(0, 5);
        
        return `
            <ul style="list-style: none; padding: 0; margin: 0;">
                ${recentExecutions.map(exec => {
                    const date = new Date(exec.startTime);
                    const dateStr = date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE');
                    const durationSec = Math.round(exec.duration / 1000);
                    const statusIcon = exec.status === 'completed' ? '✓' : exec.status === 'error' ? '✗' : '●';
                    const statusColor = exec.status === 'completed' ? '#4CAF50' : exec.status === 'error' ? '#f44336' : '#ff9800';
                    
                    return `
                        <li style="padding: 8px 0; border-bottom: 1px solid #eee; cursor: pointer;" 
                            data-action="view-execution" 
                            data-execution-id="${escapeHtml(exec.executionId)}">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <span style="color: ${statusColor}; font-weight: bold;">${statusIcon}</span>
                                    <strong>${escapeHtml(exec.recipeName)}</strong>
                                    <div style="font-size: 0.85em; color: #666;">
                                        ${dateStr} • ${durationSec}s
                                    </div>
                                </div>
                                <span style="font-size: 0.85em; color: #666;">${escapeHtml(exec.status)}</span>
                            </div>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
    }

    private attachEventListeners(): void {
        const buttons = this.container.querySelectorAll('[data-action]');
        buttons.forEach(btn => {
            const action = (btn as HTMLElement).dataset.action;
            const recipeId = (btn as HTMLElement).dataset.recipeId;
            const executionId = (btn as HTMLElement).dataset.executionId;
            btn.addEventListener('click', () => this.handleAction(action!, recipeId || executionId));
        });
        
        const globalParamInputs = this.container.querySelectorAll('[data-global-param]');
        globalParamInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                const key = target.dataset.globalParam!;
                const value = target.value;
                if (this.selectedRecipeForStart) {
                    this.selectedRecipeForStart.globalParameters[key] = value;
                }
            });
        });
        
        // Load recipe when selected from dropdown
        const recipeSelect = this.container.querySelector('#recipe-select') as HTMLSelectElement;
        if (recipeSelect) {
            recipeSelect.addEventListener('change', (e) => {
                const selectedId = (e.target as HTMLSelectElement).value;
                if (selectedId && this.sendCommandFn) {
                    console.log('[DashboardRenderer] Recipe selected, loading:', selectedId);
                    this.sendCommandFn({ command: 'get_recipe', recipeId: selectedId });
                }
            });
        }
    }

    private handleAction(action: string, recipeId?: string): void {
        console.log('[DashboardRenderer] handleAction called with action:', action, 'recipeId:', recipeId);
        
        if (!this.sendCommandFn) {
            console.error('[DashboardRenderer] Send function not configured');
            return;
        }

        switch (action) {
            case 'start':
                const select = this.container.querySelector('#recipe-select') as HTMLSelectElement;
                const selectedId = select?.value;
                if (selectedId) {
                    const availableRecipes = recipeState.getAvailableRecipes();
                    const recipeInfo = availableRecipes?.recipes?.find(r => r.id === selectedId);
                    const fullRecipe = recipeState.getCurrentRecipe();
                    
                    if (recipeInfo && fullRecipe && fullRecipe.id === selectedId) {
                        // Recipe already loaded from dropdown selection
                        const globalParams = fullRecipe.globalParameters || {};
                        this.selectedRecipeForStart = { 
                            id: selectedId, 
                            name: recipeInfo.name,
                            globalParameters: { ...globalParams }
                        };
                        this.isStartConfirmModalOpen = true;
                        this.render();
                    } else {
                        console.warn('[DashboardRenderer] Recipe not loaded yet, please wait');
                    }
                } else {
                    console.warn('[DashboardRenderer] No recipe selected');
                }
                break;
            case 'confirm-start-recipe':
                console.log('[DashboardRenderer] Starting recipe:', this.selectedRecipeForStart?.id);
                if (this.selectedRecipeForStart) {
                    const fullRecipe = recipeState.getCurrentRecipe();
                    if (fullRecipe) {
                        // Apply updated global parameters to step parameters before sending
                        const availableSteps = recipeState.getAvailableSteps();
                        const modifiedRecipe = {
                            ...fullRecipe,
                            globalParameters: this.selectedRecipeForStart.globalParameters,
                            steps: fullRecipe.steps.map(step => {
                                const stepMeta = availableSteps?.steps?.find((s: any) => s.typeId === step.stepTypeId);
                                const updatedParams = { ...step.parameters };
                                
                                // Fill step parameters with current global parameter values
                                if (stepMeta?.parameters && this.selectedRecipeForStart.globalParameters) {
                                    for (const paramMeta of stepMeta.parameters) {
                                        if (paramMeta.isGlobal) {
                                            const globalValue = this.selectedRecipeForStart.globalParameters[paramMeta.name];
                                            if (globalValue !== undefined) {
                                                updatedParams[paramMeta.name] = globalValue;
                                            }
                                        }
                                    }
                                }
                                
                                return {
                                    ...step,
                                    parameters: updatedParams
                                };
                            })
                        };
                        
                        console.log('[Dashboard] Sending recipe with merged parameters:', modifiedRecipe);
                        this.sendCommandFn({ command: 'start_recipe', payload: modifiedRecipe });
                        
                        if (this.navigateFn) {
                            console.log('[DashboardRenderer] Navigating to Live View');
                            this.navigateFn('live');
                        }
                    }
                    
                    this.isStartConfirmModalOpen = false;
                    this.selectedRecipeForStart = null;
                    this.currentlySelectedRecipeId = '';
                }
                break;
            case 'close-start-confirm':
                this.isStartConfirmModalOpen = false;
                this.selectedRecipeForStart = null;
                this.render();
                break;
            case 'edit':
                if (recipeId) {
                    this.sendCommandFn({ command: 'get_recipe', recipeId });
                }
                break;
            case 'delete':
                if (recipeId && confirm(`Rezept "${recipeId}" wirklich löschen?`)) {
                    this.sendCommandFn({ command: 'delete_recipe', recipeId });
                    // Remove from localStorage immediately
                    this.deleteRecipeFromLocalStorage(Number(recipeId));
                }
                break;
            case 'refresh':
                this.requestRecipeList();
                this.requestExecutionHistory();
                break;
            case 'view-execution':
                console.log('[DashboardRenderer] View execution:', recipeId);
                if (recipeId && this.navigateFn) {
                    // Store execution ID in state for analytics view
                    console.log('[DashboardRenderer] Setting selectedExecutionId:', recipeId);
                    recipeState.setSelectedExecutionId(recipeId);
                    this.sendCommandFn({ command: 'get_timeseries', executionId: recipeId });
                    this.navigateFn('analytics');
                }
                break;
        }
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.container.innerHTML = '';
        this.container.classList.remove('recipe-mgmt-dashboard');
    }

    isVisible(): boolean {
        return this.container.offsetParent !== null;
    }
}

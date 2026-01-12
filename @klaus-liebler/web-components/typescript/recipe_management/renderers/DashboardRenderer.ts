/**
 * Dashboard Renderer
 * Shows available recipes and allows starting them
 */

import { recipeState } from '../state';
import type { ViewHandle } from './LiveViewRenderer';

export class DashboardRenderer implements ViewHandle {
    private container: HTMLElement;
    private unsubscribe: (() => void) | null = null;
    private sendCommandFn: ((cmd: any) => void) | null = null;
    private backendRecipesLoaded: boolean = false;
    private isStartConfirmModalOpen: boolean = false;
    private selectedRecipeForStart: { id: string; name: string } | null = null;
    private currentlySelectedRecipeId: string = '';

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.classList.add('recipe-mgmt-dashboard');
        
        // Subscribe to state changes
        this.unsubscribe = recipeState.subscribe(() => this.onStateChange());
        
        // Request recipe list from backend on initialization (always load from machine first)
        this.loadRecipeList();
    }

    setSendFunction(sendFn: (cmd: any) => void): void {
        this.sendCommandFn = sendFn;
    }

    setContainer(container: HTMLElement): void {
        this.container = container;
        this.container.classList.add('recipe-mgmt-dashboard');
    }

    private onStateChange(): void {
        const availableRecipes = recipeState.getAvailableRecipes();
        if (availableRecipes && availableRecipes.recipes) {
            console.log('[DashboardRenderer] Available recipes received from backend:', availableRecipes.recipes.length);
            this.backendRecipesLoaded = true;
            
            // Replace localStorage with backend data (even if empty)
            try {
                if (availableRecipes.recipes.length > 0) {
                    localStorage.setItem('recipe_available_recipes', JSON.stringify(availableRecipes));
                    console.log('[DashboardRenderer] Recipes replaced in localStorage');
                } else {
                    localStorage.removeItem('recipe_available_recipes');
                    console.log('[DashboardRenderer] No recipes from backend - localStorage cleared');
                }
            } catch (error) {
                console.error('[DashboardRenderer] Error updating localStorage:', error);
            }
        }
        this.render();
    }

    private loadRecipeList(): void {
        console.log('[DashboardRenderer] Loading recipe list from backend (machine)...');
        
        // Always request from backend first (at least once)
        if (!this.backendRecipesLoaded) {
            console.log('[DashboardRenderer] Requesting recipes from backend');
            this.requestRecipeList();
            this.render();
            return;
        }
        
        // After backend has been loaded once, check state first
        const availableRecipes = recipeState.getAvailableRecipes();
        if (availableRecipes && availableRecipes.recipes && availableRecipes.recipes.length > 0) {
            console.log('[DashboardRenderer] Recipes already in state:', availableRecipes.recipes.length);
            this.render();
            return;
        }
        
        // Fallback to localStorage if backend request failed
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
        
        // Request from backend again
        console.log('[DashboardRenderer] Requesting recipes from backend');
        this.requestRecipeList();
        this.render();
    }

    private requestRecipeList(): void {
        if (this.sendCommandFn) {
            console.log('[DashboardRenderer] Sending get_recipe_list command');
            this.sendCommandFn({ command: 'get_recipe_list' });
        } else {
            console.warn('[DashboardRenderer] sendCommandFn not configured yet');
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

                <div class="recipe-start">
                    <h2>Start Recipe</h2>
                    ${this.renderRecipeList(availableRecipes)}
                </div>

                <div class="quick-stats">
                    <h2>Overview</h2>
                    <p>Available Recipes: ${availableRecipes?.recipes?.length || 0}</p>
                </div>

                <div class="recipe-history">
                    <h2>Recent Recipes</h2>
                    <p>No history available</p>
                </div>

                <div class="error-log">
                    <h2>Recent Errors</h2>
                    <p>No errors</p>
                </div>

                <div class="maintenance">
                    <h2>Maintenance</h2>
                    <p>No pending maintenance</p>
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
        
        return `
            <div class="modal-overlay" data-action="close-start-confirm" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div class="modal-content" style="max-width: 500px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
                    <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #e0e0e0; position: relative;">
                        <h2 style="margin: 0;">Start Recipe?</h2>
                        <button class="modal-close" data-action="close-start-confirm" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <p style="font-size: 16px; margin-bottom: 20px;">
                            Do you want to start recipe <strong>"${this.escapeHtml(this.selectedRecipeForStart.name)}"</strong>?
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            ID: ${this.escapeHtml(this.selectedRecipeForStart.id)}
                        </p>
                    </div>
                    <div class="modal-footer" style="padding: 20px; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn-secondary" data-action="close-start-confirm" style="padding: 10px 20px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                        <button class="btn-primary" data-action="confirm-start-recipe" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">▶ Start Now</button>
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
                    <option value="${this.escapeHtml(recipe.id)}" ${this.currentlySelectedRecipeId === recipe.id ? 'selected' : ''}>${this.escapeHtml(recipe.name)}</option>
                `).join('')}
            </select>
            <button class="btn-primary" data-action="start" style="padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">▶ Start Recipe</button>
        `;
    }

    private attachEventListeners(): void {
        const buttons = this.container.querySelectorAll('[data-action]');
        console.log('[DashboardRenderer] Attaching event listeners to', buttons.length, 'buttons');
        buttons.forEach(btn => {
            const action = (btn as HTMLElement).dataset.action;
            const recipeId = (btn as HTMLElement).dataset.recipeId;
            console.log('[DashboardRenderer] Attaching listener for action:', action);
            btn.addEventListener('click', () => this.handleAction(action!, recipeId));
        });
    }

    private handleAction(action: string, recipeId?: string): void {
        console.log('[DashboardRenderer] handleAction called with action:', action, 'recipeId:', recipeId);
        
        if (!this.sendCommandFn) {
            console.error('[DashboardRenderer] Send function not configured');
            return;
        }

        switch (action) {
            case 'start':
                console.log('[DashboardRenderer] Processing start action');
                const select = this.container.querySelector('#recipe-select') as HTMLSelectElement;
                const selectedId = select?.value;
                console.log('[DashboardRenderer] Selected recipe ID:', selectedId);
                if (selectedId) {
                    // Find recipe name
                    const availableRecipes = recipeState.getAvailableRecipes();
                    const recipe = availableRecipes?.recipes?.find(r => r.id === selectedId);
                    console.log('[DashboardRenderer] Found recipe:', recipe);
                    if (recipe) {
                        // Show confirmation modal
                        this.selectedRecipeForStart = { id: selectedId, name: recipe.name };
                        this.isStartConfirmModalOpen = true;
                        console.log('[DashboardRenderer] Opening confirmation modal');
                        this.render();
                    }
                } else {
                    console.warn('[DashboardRenderer] No recipe selected');
                }
                break;
            case 'confirm-start-recipe':
                console.log('[DashboardRenderer] Confirming recipe start');
                if (this.selectedRecipeForStart) {
                    console.log('[DashboardRenderer] Sending start_recipe command for:', this.selectedRecipeForStart.id);
                    this.sendCommandFn({ command: 'start_recipe', recipeId: this.selectedRecipeForStart.id });
                    this.isStartConfirmModalOpen = false;
                    this.selectedRecipeForStart = null;
                    this.currentlySelectedRecipeId = '';
                    
                    // Navigate to LiveView
                    window.location.hash = '#liveview';
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
                }
                break;
            case 'refresh':
                this.requestRecipeList();
                break;
        }
    }

    private formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleDateString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
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
        this.container.classList.remove('recipe-mgmt-dashboard');
    }

    isVisible(): boolean {
        return this.container.offsetParent !== null;
    }
}

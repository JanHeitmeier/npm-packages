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

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.classList.add('recipe-mgmt-dashboard');
        
        // Subscribe to state changes
        this.unsubscribe = recipeState.subscribe(() => this.render());
    }

    setSendFunction(sendFn: (cmd: any) => void): void {
        this.sendCommandFn = sendFn;
    }

    setContainer(container: HTMLElement): void {
        this.container = container;
        this.container.classList.add('recipe-mgmt-dashboard');
    }

    private requestRecipeList(): void {
        if (this.sendCommandFn) {
            this.sendCommandFn({ command: 'get_recipe_list' });
        }
    }

    render(): void {
        const availableRecipes = recipeState.getAvailableRecipes();
        
        this.container.innerHTML = `
            <div class="dashboard-container">
                <div class="dashboard-title">Dashboard</div>

                <div class="dashboard-user">
                    <h2>Nutzer</h2>
                    <p>Rezeptverwaltung</p>
                </div>

                <div class="recipe-start">
                    <h2>Rezept starten</h2>
                    <button class="btn-test-recipe" data-action="test" style="padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; margin-bottom: 10px;">
                        🚀 Send Test Recipe
                    </button>
                    ${this.renderRecipeList(availableRecipes)}
                </div>

                <div class="quick-stats">
                    <h2>Übersicht</h2>
                    <p>Verfügbare Rezepte: ${availableRecipes?.recipes?.length || 0}</p>
                </div>

                <div class="recipe-history">
                    <h2>Letzte Rezepte</h2>
                    <p>Keine Historie verfügbar</p>
                </div>

                <div class="error-log">
                    <h2>Letzte Fehler</h2>
                    <p>Keine Fehler</p>
                </div>

                <div class="maintenance">
                    <h2>Wartungen</h2>
                    <p>Keine anstehenden Wartungen</p>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    private renderRecipeList(availableRecipes: any): string {
        if (!availableRecipes || !availableRecipes.recipes || availableRecipes.recipes.length === 0) {
            return '<p>Keine Rezepte verfügbar</p>';
        }

        return `
            <select id="recipe-select" style="width: 100%; padding: 8px; margin-bottom: 10px;">
                <option value="">-- Rezept wählen --</option>
                ${availableRecipes.recipes.map((recipe: any) => `
                    <option value="${this.escapeHtml(recipe.id)}">${this.escapeHtml(recipe.name)}</option>
                `).join('')}
            </select>
            <button class="btn-primary" data-action="start" style="padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">▶ Rezept Starten</button>
        `;
    }

    private attachEventListeners(): void {
        const buttons = this.container.querySelectorAll('[data-action]');
        buttons.forEach(btn => {
            const action = (btn as HTMLElement).dataset.action;
            const recipeId = (btn as HTMLElement).dataset.recipeId;
            btn.addEventListener('click', () => this.handleAction(action!, recipeId));
        });
    }

    private handleAction(action: string, recipeId?: string): void {
        if (!this.sendCommandFn) {
            console.error('Send function not configured');
            return;
        }

        switch (action) {
            case 'test':
                const testRecipe = {
                    id: "test_recipe_002",
                    name: "Red-Yellow Alternating Test",
                    steps: [
                        {stepTypeId: "0x0001", systemId: "step_red_led_1", aliases: {LED: "LED0", RedButton: "RedButton"}},
                        {stepTypeId: "0x0002", systemId: "step_yellow_green_1", aliases: {LED: "LED1", GreenButton: "GreenButton"}}
                    ]
                };
                this.sendCommandFn({
                    command: 'start_recipe',
                    payload: testRecipe
                });
                console.log('Test-Rezept gesendet:', testRecipe);
                break;
            case 'start':
                const select = this.container.querySelector('#recipe-select') as HTMLSelectElement;
                const selectedId = select?.value;
                if (selectedId) {
                    this.sendCommandFn({ command: 'start_recipe', recipeId: selectedId });
                } else {
                    console.warn('Kein Rezept ausgewählt');
                }
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

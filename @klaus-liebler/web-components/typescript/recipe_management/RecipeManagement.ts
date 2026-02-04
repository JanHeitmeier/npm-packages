import { recipeState } from './state';
import { LiveViewRenderer } from './renderers/LiveViewRenderer';
import { DashboardRenderer } from './renderers/DashboardRenderer';
import { EditorRenderer } from './renderers/EditorRenderer';
import { AnalyticsRenderer } from './renderers/AnalyticsRenderer';
import type { CommandDto } from './types';

export interface RecipeManagementConfig {
    /**
     * Function to send commands to the backend (Browser → Engine)
     * @param command CommandDto to send
     */
    sendMessage: (command: CommandDto) => void;

    /**
     * Function to register WebSocket namespace handler
     * @param namespace Namespace number (11 for Recipe Management)
     * @param handler Message handler function
     */
    registerWebSocket: (namespace: number, handler: (data: any) => void) => void;

    /**
     * Optional callback for navigation events
     * @param view Target view ('live' | 'dashboard' | 'editor' | 'analytics')
     */
    onNavigate?: (view: 'live' | 'dashboard' | 'editor' | 'analytics') => void;

    /**
     * Optional CSS overrides for custom styling
     */
    cssOverrides?: {
        primaryColor?: string;
        secondaryColor?: string;
        fontFamily?: string;
    };
}

let globalSendFunction: ((command: CommandDto) => void) | null = null;
let globalNavigateFunction: ((view: 'live' | 'dashboard' | 'editor' | 'analytics') => void) | null = null;

let liveViewRenderer: LiveViewRenderer | null = null;
let dashboardRenderer: DashboardRenderer | null = null;
let editorRenderer: EditorRenderer | null = null;
let analyticsRenderer: AnalyticsRenderer | null = null;


export function setupRecipeManagement(config: RecipeManagementConfig): void {
    globalSendFunction = config.sendMessage;
    globalNavigateFunction = config.onNavigate || null;

    config.registerWebSocket(11, receiveMessage);

    liveViewRenderer = new LiveViewRenderer(document.createElement('div'));
    dashboardRenderer = new DashboardRenderer(document.createElement('div'));
    editorRenderer = new EditorRenderer(document.createElement('div'));
    analyticsRenderer = new AnalyticsRenderer(document.createElement('div'));

    [liveViewRenderer, dashboardRenderer, editorRenderer, analyticsRenderer].forEach(renderer => {
        renderer.setSendFunction(sendCommand);
    });
    
    // Set navigation callback for Dashboard (switches to Live View after recipe start)
    if (dashboardRenderer && globalNavigateFunction) {
        dashboardRenderer.setNavigateFunction(globalNavigateFunction);
    }

    if (config.cssOverrides) {
        applyCssOverrides(config.cssOverrides);
    }

    importRecipeManagementStyles();
}

function applyCssOverrides(overrides: NonNullable<RecipeManagementConfig['cssOverrides']>): void {
    const root = document.documentElement;
    if (overrides.primaryColor) {
        root.style.setProperty('--recipe-mgmt-primary-color', overrides.primaryColor);
    }
    if (overrides.secondaryColor) {
        root.style.setProperty('--recipe-mgmt-secondary-color', overrides.secondaryColor);
    }
    if (overrides.fontFamily) {
        root.style.setProperty('--recipe-mgmt-font-family', overrides.fontFamily);
    }
}

function importRecipeManagementStyles(): void {
    // Check if styles are already imported
    if (document.getElementById('recipe-mgmt-styles')) {
        return;
    }

    const link = document.createElement('link');
    link.id = 'recipe-mgmt-styles';
    link.rel = 'stylesheet';
    link.href = new URL('../../style/recipe-management.css', import.meta.url).href;
    document.head.appendChild(link);
}


export function receiveMessage(jsonMessage: string | any): void {
    let message: any;
    if (typeof jsonMessage === 'string') {
        try {
            message = JSON.parse(jsonMessage);
        } catch (error) {
            return;
        }
    } else {
        message = jsonMessage;
    }

    if (message.type) {
        routeTypedMessage(message);
    } else {
        routeUntypedMessage(message);
    }
}

function routeTypedMessage(message: any): void {
    const data = message.data || message;
    
    switch (message.type) {
        case 'liveview':
            recipeState.setLiveView(data);
            // When LiveView is received, check if we need to load recipe details
            const currentRecipe = recipeState.getCurrentRecipe();
            if (data.recipeId && (!currentRecipe || currentRecipe.id !== data.recipeId)) {
                // Recipe ID in LiveView doesn't match current recipe - load it
                console.log('[RecipeManagement] LiveView has recipeId', data.recipeId, 'but currentRecipe is', currentRecipe?.id, '- loading recipe');
                if (globalSendFunction) {
                    globalSendFunction({ command: 'get_recipe', recipeId: data.recipeId });
                }
            }
            break;
        case 'available_recipes':
            recipeState.setAvailableRecipes(data);
            break;
        case 'available_steps':
            recipeState.setAvailableSteps(data);
            break;
        case 'recipe':
            recipeState.setCurrentRecipe(data);
            break;
        case 'execution_history':
            console.log('[RecipeManagement] Received execution_history, storing in state:', data);
            recipeState.setExecutionHistory(data);
            break;
        case 'timeseries':
        case 'timeseries_data':
            console.log('[RecipeManagement] Received timeseries data, storing in state:', data);
            recipeState.setTimeSeriesData(data);
            break;
            
        default:
            console.warn('[RecipeManagement] Unknown message type:', message.type);
            break;
    }
}

function routeUntypedMessage(message: any): void {
    
    if (message.recipeStatus && message.currentStepIndex !== undefined) {
        recipeState.setLiveView(message);
        // When LiveView is received, check if we need to load recipe details
        const currentRecipe = recipeState.getCurrentRecipe();
        if (message.recipeId && (!currentRecipe || currentRecipe.id !== message.recipeId)) {
            // Recipe ID in LiveView doesn't match current recipe - load it
            console.log('[RecipeManagement] LiveView (untyped) has recipeId', message.recipeId, 'but currentRecipe is', currentRecipe?.id, '- loading recipe');
            if (globalSendFunction) {
                globalSendFunction({ command: 'get_recipe', recipeId: message.recipeId });
            }
        }
    } else if (message.recipes && Array.isArray(message.recipes)) {
        recipeState.setAvailableRecipes(message);
    } else if (message.steps && Array.isArray(message.steps) && message.steps[0]?.typeId) {
        recipeState.setAvailableSteps(message);
    } else if (message.id && message.name && message.steps && Array.isArray(message.steps)) {
        recipeState.setCurrentRecipe(message);
    } else if (message.executions && Array.isArray(message.executions)) {
        recipeState.setExecutionHistory(message);
    } else if (message.executionId && message.series && Array.isArray(message.series)) {
        recipeState.setTimeSeriesData(message);
    }
}

function ensureRenderer(renderer: any, name: string): void {
    if (!renderer) {
        throw new Error(`Recipe Management not initialized. Call setupRecipeManagement() first.`);
    }
}

export function renderLiveView(container: HTMLElement): void {
    ensureRenderer(liveViewRenderer, 'LiveViewRenderer');
    liveViewRenderer!.setContainer(container);
    liveViewRenderer!.render();
}

export function reRenderLiveView(): void {
    ensureRenderer(liveViewRenderer, 'LiveViewRenderer');
    liveViewRenderer!.render();
}

export function renderDashboard(container: HTMLElement): void {
    ensureRenderer(dashboardRenderer, 'DashboardRenderer');
    dashboardRenderer!.setContainer(container);
    dashboardRenderer!.render();
}

export function reRenderDashboard(): void {
    ensureRenderer(dashboardRenderer, 'DashboardRenderer');
    dashboardRenderer!.render();
}

export function renderEditor(container: HTMLElement): void {
    ensureRenderer(editorRenderer, 'EditorRenderer');
    editorRenderer!.setContainer(container);
    editorRenderer!.render();
}

export function reRenderEditor(): void {
    ensureRenderer(editorRenderer, 'EditorRenderer');
    editorRenderer!.render();
}

export function renderAnalytics(container: HTMLElement): void {
    ensureRenderer(analyticsRenderer, 'AnalyticsRenderer');
    analyticsRenderer!.setContainer(container);
    analyticsRenderer!.render();
}

export function reRenderAnalytics(): void {
    ensureRenderer(analyticsRenderer, 'AnalyticsRenderer');
    analyticsRenderer!.render();
}

export function sendCommand(command: CommandDto): void {
    if (!globalSendFunction) {
        throw new Error('Recipe Management not initialized. Call setupRecipeManagement() first.');
    }
    console.log('%c[RecipeManagement] ⬆️ SENDEN:', 'color: #FF9800; font-weight: bold', command);
    globalSendFunction(command);
}

export function getState() {
    return recipeState;
}

export function resetState(): void {
    recipeState.reset();
}

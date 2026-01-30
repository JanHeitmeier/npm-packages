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

    console.log('Recipe Management initialized with Namespace 11');
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
    console.log('%c[RecipeManagement] ⬇️ EMPFANGEN:', 'color: #4CAF50; font-weight: bold', jsonMessage);
    
    let message: any;
    if (typeof jsonMessage === 'string') {
        try {
            message = JSON.parse(jsonMessage);
            console.log('%c[RecipeManagement] ⬇️ Parsed JSON:', 'color: #4CAF50', message);
        } catch (error) {
            console.error('[RecipeManagement] Failed to parse message:', error);
            return;
        }
    } else {
        message = jsonMessage;
    }

    console.log('[RecipeManagement] Processing message:', message);

    if (message.type) {
        console.log('[RecipeManagement] Message has type:', message.type);
        routeTypedMessage(message);
    } else {
        console.log('[RecipeManagement] Message has no type, inferring...');
        routeUntypedMessage(message);
    }
}

function routeTypedMessage(message: any): void {
    console.log('[RecipeManagement] routeTypedMessage:', message.type);
    
    const data = message.data || message;
    
    switch (message.type) {
        case 'liveview':
            recipeState.setLiveView(data);
            // When LiveView is received, check if we need to load recipe details
            const currentRecipe = recipeState.getCurrentRecipe();
            if (data.recipeId) {
                if (!currentRecipe || currentRecipe.id !== data.recipeId) {
                    console.log('[RecipeManagement] LiveView received, looking for recipe:', data.recipeId);
                    // First try to find recipe in availableRecipes (browser state)
                    const availableRecipes = recipeState.getAvailableRecipes();
                    const foundRecipe = availableRecipes?.recipes?.find(r => r.id === data.recipeId);
                    
                    if (foundRecipe) {
                        console.log('[RecipeManagement] Recipe found in availableRecipes, requesting full details');
                        // Found in list, but we need full RecipeDto with steps, so request it
                        if (globalSendFunction) {
                            globalSendFunction({ command: 'get_recipe', recipeId: data.recipeId });
                        }
                    } else {
                        console.log('[RecipeManagement] Recipe not in availableRecipes, requesting from backend');
                        if (globalSendFunction) {
                            globalSendFunction({ command: 'get_recipe', recipeId: data.recipeId });
                        }
                    }
                } else {
                    console.log('[RecipeManagement] Recipe already loaded for:', data.recipeId);
                }
            }
            break;
        case 'available_recipes':
            console.log('[RecipeManagement] Setting available recipes with', message.recipes?.length || 0, 'recipes');
            recipeState.setAvailableRecipes(data);
            break;
        case 'available_steps':
            console.log('[RecipeManagement] Setting available steps with', message.steps?.length || 0, 'steps');
            recipeState.setAvailableSteps(data);
            break;
        case 'recipe':
            console.log('[RecipeManagement] Setting current recipe:', message.name || 'Unknown');
            recipeState.setCurrentRecipe(data);
            break;
        case 'metrics':
            recipeState.setMetrics(data);
            break;
            
        default:
            console.warn('Unknown message type:', message.type);
    }
}

function routeUntypedMessage(message: any): void {
    console.log('[RecipeManagement] routeUntypedMessage, analyzing structure:', Object.keys(message));
    
    if (message.recipeStatus && message.currentStepIndex !== undefined) {
        console.log('[RecipeManagement] Detected as LiveViewDto');
        recipeState.setLiveView(message);
        // When LiveView is received, check if we need to load recipe details
        const currentRecipe = recipeState.getCurrentRecipe();
        if (message.recipeId) {
            if (!currentRecipe || currentRecipe.id !== message.recipeId) {
                console.log('[RecipeManagement] LiveView received, looking for recipe:', message.recipeId);
                // First try to find recipe in availableRecipes (browser state)
                const availableRecipes = recipeState.getAvailableRecipes();
                const foundRecipe = availableRecipes?.recipes?.find(r => r.id === message.recipeId);
                
                if (foundRecipe) {
                    console.log('[RecipeManagement] Recipe found in availableRecipes, requesting full details');
                    // Found in list, but we need full RecipeDto with steps, so request it
                    if (globalSendFunction) {
                        globalSendFunction({ command: 'get_recipe', recipeId: message.recipeId });
                    }
                } else {
                    console.log('[RecipeManagement] Recipe not in availableRecipes, requesting from backend');
                    if (globalSendFunction) {
                        globalSendFunction({ command: 'get_recipe', recipeId: message.recipeId });
                    }
                }
            } else {
                console.log('[RecipeManagement] Recipe already loaded for:', message.recipeId);
            }
        }
    } else if (message.recipes && Array.isArray(message.recipes)) {
        console.log('[RecipeManagement] Detected as AvailableRecipesDto');
        recipeState.setAvailableRecipes(message);
    } else if (message.steps && Array.isArray(message.steps) && message.steps[0]?.typeId) {
        console.log('[RecipeManagement] Detected as AvailableStepsDto with', message.steps.length, 'steps');
        recipeState.setAvailableSteps(message);
    } else if (message.id && message.name && message.steps && Array.isArray(message.steps)) {
        console.log('[RecipeManagement] Detected as RecipeDto');
        recipeState.setCurrentRecipe(message);
    } else if (message.series && Array.isArray(message.series)) {
        console.log('[RecipeManagement] Detected as MetricsDto');
        recipeState.setMetrics(message);
    } else {
        console.warn('[RecipeManagement] Could not infer message type from structure:', message);
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

export function renderDashboard(container: HTMLElement): void {
    ensureRenderer(dashboardRenderer, 'DashboardRenderer');
    dashboardRenderer!.setContainer(container);
    dashboardRenderer!.render();
}

export function renderEditor(container: HTMLElement): void {
    ensureRenderer(editorRenderer, 'EditorRenderer');
    editorRenderer!.setContainer(container);
    editorRenderer!.render();
}

export function renderAnalytics(container: HTMLElement): void {
    ensureRenderer(analyticsRenderer, 'AnalyticsRenderer');
    analyticsRenderer!.setContainer(container);
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

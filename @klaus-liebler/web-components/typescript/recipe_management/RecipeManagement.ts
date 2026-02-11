import { recipeState } from './state';
import { LiveViewRenderer } from './renderers/LiveViewRenderer';
import { DashboardRenderer } from './renderers/DashboardRenderer';
import { EditorRenderer } from './renderers/EditorRenderer';
import { AnalyticsRenderer } from './renderers/AnalyticsRenderer';
import { TimeSeriesDeserializer } from './TimeSeriesDeserializer';
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
            const currentRecipe = recipeState.getCurrentRecipe();
            if (data.recipeId && (!currentRecipe || currentRecipe.id !== data.recipeId)) {
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
        case 'timeseries_binary':
            console.log('[RecipeManagement] Received timeseries_binary data');
            try {
                const decoded = TimeSeriesDeserializer.deserialize(
                    data.binaryData,
                    data.executionId,
                    data.startTime
                );
                console.log('[RecipeManagement] Successfully decoded binary timeseries:', decoded);
                recipeState.setTimeSeriesData(decoded);
            } catch (error) {
                console.error('[RecipeManagement] Failed to decode binary timeseries:', error);
            }
            break;
        case 'timeseries':
        case 'timeseries_data':
            console.log('[RecipeManagement] Received timeseries data (legacy JSON format), storing in state:', data);
            recipeState.setTimeSeriesData(data);
            break;
        case 'auth_response':
            console.log('[RecipeManagement] Received auth_response:', data);
            if (data.success && data.sessionToken) {
                recipeState.setSession(data.sessionToken, data.role);
            } else {
                // Login failed - show error message
                const errorMsg = data.errorMessage || 'Login failed';
                alert(`Login failed: ${errorMsg}`);
                console.warn('[RecipeManagement] Login failed:', data);
            }
            break;
        case 'command_response':
            console.log('[RecipeManagement] Received command_response:', data);
            if (!data.success) {
                if (data.errorCode === 401) {
                    // Not authenticated - clear session and prompt login
                    recipeState.clearSession();
                    alert('Session expired or invalid. Please login again.');
                } else if (data.errorCode === 403) {
                    // Not authorized - insufficient role
                    alert(`Access denied: ${data.errorMessage || 'Not allowed with current role'}`);
                } else {
                    // Other error
                    alert(`Error: ${data.errorMessage || 'Operation failed'}`);
                }
            } else {
                // Success response - might contain recipe data
                console.log('[RecipeManagement] Command success response:', data);
                if (data.recipe) {
                    console.log('[RecipeManagement] Command response contains recipe, setting it');
                    recipeState.setCurrentRecipe(data.recipe);
                }
            }
            break;
            
        default:
            console.warn('[RecipeManagement] Unknown message type:', message.type);
            break;
    }
}

function routeUntypedMessage(message: any): void {
    
    if (message.success !== undefined && message.role && message.sessionToken !== undefined) {
        console.log('[RecipeManagement] Detected auth_response (untyped):', message);
        if (message.success && message.sessionToken) {
            recipeState.setSession(message.sessionToken, message.role);
        } else {
            // Login failed - show error message
            const errorMsg = message.errorMessage || 'Login failed';
            alert(`Login failed: ${errorMsg}`);
            console.warn('[RecipeManagement] Login failed (untyped):', message);
        }
    } else if (message.success !== undefined && message.errorCode !== undefined) {
        console.log('[RecipeManagement] Detected command_response (untyped):', message);
        if (!message.success) {
            if (message.errorCode === 401) {
                // Not authenticated - clear session and prompt login
                recipeState.clearSession();
                alert('Session expired or invalid. Please login again.');
            } else if (message.errorCode === 403) {
                // Not authorized - insufficient role
                alert(`Access denied: ${message.errorMessage || 'Not allowed with current role'}`);
            } else {
                // Other error
                alert(`Error: ${message.errorMessage || 'Operation failed'}`);
            }
        } else {
            // Success response - might contain recipe data
            console.log('[RecipeManagement] Success response received:', message);
            if (message.recipe) {
                console.log('[RecipeManagement] Success response contains recipe, setting it');
                recipeState.setCurrentRecipe(message.recipe);
            }
        }
    } else if (message.recipeStatus && message.currentStepIndex !== undefined) {
        recipeState.setLiveView(message);
        const currentRecipe = recipeState.getCurrentRecipe();
        if (message.recipeId && (!currentRecipe || currentRecipe.id !== message.recipeId)) {
            console.log('[RecipeManagement] LiveView (untyped) has recipeId', message.recipeId, 'but currentRecipe is', currentRecipe?.id, '- loading recipe');
            if (globalSendFunction) {
                globalSendFunction({ command: 'get_recipe', recipeId: message.recipeId });
            }
        }
    } else if (message.recipes && Array.isArray(message.recipes)) {
        recipeState.setAvailableRecipes(message);
    } else if (message.id && message.name && message.steps && Array.isArray(message.steps)) {
        // Full recipe (has id, name, steps) - must be checked BEFORE available_steps
        console.log('[RecipeManagement] Detected full recipe (untyped):', message.id);
        recipeState.setCurrentRecipe(message);
    } else if (message.steps && Array.isArray(message.steps) && message.steps[0]?.typeId && !message.id) {
        // Available steps list (has steps with typeId, but NO recipe id/name)
        console.log('[RecipeManagement] Detected available_steps (untyped)');
        recipeState.setAvailableSteps(message);
    } else if (message.executions && Array.isArray(message.executions)) {
        recipeState.setExecutionHistory(message);
    } else if (message.executionId && message.series && Array.isArray(message.series)) {
        recipeState.setTimeSeriesData(message);
    } else if (message.executionId && message.binaryData && message.startTime !== undefined) {
        // Binary TimeSeries format (untyped)
        console.log('[RecipeManagement] Detected timeseries_binary (untyped)');
        try {
            const decoded = TimeSeriesDeserializer.deserialize(
                message.binaryData,
                message.executionId,
                message.startTime
            );
            recipeState.setTimeSeriesData(decoded);
        } catch (error) {
            console.error('[RecipeManagement] Failed to decode binary timeseries (untyped):', error);
        }
    } else {
        console.warn('[RecipeManagement] Unrecognized message format (untyped):', message);
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
    
    // List of commands that require authentication
    const authRequiredCommands = [
        'start_recipe', 'stop_recipe', 'pause_recipe', 'resume_recipe', 'acknowledge_step',
        'save_recipe', 'delete_recipe', 'delete_execution', 'change_pin'
    ];
    
    // Auto-add session token for commands that require authentication
    if (command.command !== 'login' && !command.sessionToken) {
        const token = recipeState.getSessionToken();
        
        if (authRequiredCommands.includes(command.command)) {
            // Command requires auth - add token and warn if missing
            command.sessionToken = token;
            if (token) {
                console.log('%c[RecipeManagement] Added session token:', 'color: #4CAF50', token.substring(0, 16) + '...');
            } else {
                console.warn('[RecipeManagement] Command requires authentication but no token available:', command.command);
            }
        } else {
            // Read-only command - add token if available but don't warn if missing
            command.sessionToken = token || '';
            if (token) {
                console.log('%c[RecipeManagement] Added session token (optional for read-only):', 'color: #2196F3', token.substring(0, 16) + '...');
            }
        }
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

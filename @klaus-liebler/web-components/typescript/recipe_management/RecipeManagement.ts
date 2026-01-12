/**
 * Recipe Management - Main API
 * 
 * Standalone library for Recipe Management UI
 * 100% framework-independent (Vanilla TypeScript)
 * 
 * Usage:
 * ```typescript
 * import { setupRecipeManagement, renderLiveView, renderDashboard } from './recipe_management';
 * 
 * // 1. Setup communication
 * setupRecipeManagement({
 *     sendMessage: (cmd) => {
 *         websocket.send(JSON.stringify(cmd));
 *     }
 * });
 * 
 * // 2. Render views
 * const liveView = renderLiveView(document.getElementById('live-container'));
 * const dashboard = renderDashboard(document.getElementById('dashboard-container'));
 * 
 * // 3. Receive messages from backend
 * websocket.onmessage = (event) => {
 *     receiveMessage(event.data);
 * };
 * ```
 */

import { recipeState } from './state';
import { LiveViewRenderer } from './renderers/LiveViewRenderer';
import { DashboardRenderer } from './renderers/DashboardRenderer';
import { EditorRenderer } from './renderers/EditorRenderer';
import { AnalyticsRenderer } from './renderers/AnalyticsRenderer';
import type { CommandDto } from './types';

// ========== Configuration ==========

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
     * Optional CSS overrides for custom styling
     */
    cssOverrides?: {
        primaryColor?: string;
        secondaryColor?: string;
        fontFamily?: string;
    };
}

let globalSendFunction: ((command: CommandDto) => void) | null = null;

// ========== Persistent Renderer Instances (Singletons) ==========

let liveViewRenderer: LiveViewRenderer | null = null;
let dashboardRenderer: DashboardRenderer | null = null;
let editorRenderer: EditorRenderer | null = null;
let analyticsRenderer: AnalyticsRenderer | null = null;

// ========== Setup ==========

/**
 * Initialize the Recipe Management system
 * Must be called ONCE during app startup
 * - Registers WebSocket handler for Namespace 11
 * - Creates persistent renderer instances
 */
export function setupRecipeManagement(config: RecipeManagementConfig): void {
    globalSendFunction = config.sendMessage;

    // Register WebSocket handler for Namespace 11 ONCE
    config.registerWebSocket(11, receiveMessage);

    // Create persistent renderer instances (Singletons)
    liveViewRenderer = new LiveViewRenderer(document.createElement('div')); // Dummy container, will be replaced on first render
    dashboardRenderer = new DashboardRenderer(document.createElement('div'));
    editorRenderer = new EditorRenderer(document.createElement('div'));
    analyticsRenderer = new AnalyticsRenderer(document.createElement('div'));

    // Set send functions
    liveViewRenderer.setSendFunction(sendCommand);
    dashboardRenderer.setSendFunction(sendCommand);
    editorRenderer.setSendFunction(sendCommand);
    analyticsRenderer.setSendFunction(sendCommand);

    // Apply CSS overrides if provided
    if (config.cssOverrides) {
        applyCssOverrides(config.cssOverrides);
    }

    // Import CSS automatically
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

// ========== Message Reception (Engine → Browser) ==========

/**
 * Process incoming messages from the backend
 * Automatically routes messages to the appropriate state
 * 
 * @param jsonMessage JSON string or parsed object containing the message
 */
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

    // Auto-detect message type and route to state
    if (message.type) {
        console.log('[RecipeManagement] Message has type:', message.type);
        routeTypedMessage(message);
    } else {
        console.log('[RecipeManagement] Message has no type, inferring...');
        // Try to infer type from structure
        routeUntypedMessage(message);
    }
}

function routeTypedMessage(message: any): void {
    console.log('[RecipeManagement] routeTypedMessage:', message.type);
    switch (message.type) {
        case 'LiveViewDto':
        case 'liveview':
            recipeState.setLiveView(message.data || message);
            break;
        case 'AvailableRecipesDto':
        case 'RecipeListDto':
        case 'available_recipes':
            console.log('[RecipeManagement] Setting available recipes with', message.recipes?.length || 0, 'recipes');
            recipeState.setAvailableRecipes(message.data || message);
            break;
        case 'AvailableStepsDto':
        case 'available_steps':
            console.log('[RecipeManagement] Setting available steps with', message.steps?.length || 0, 'steps');
            recipeState.setAvailableSteps(message);
            break;
        case 'RecipeDto':
        case 'recipe':
            console.log('[RecipeManagement] Setting current recipe:', message.name || 'Unknown');
            recipeState.setCurrentRecipe(message.data || message);
            break;
        case 'MetricsDto':
        case 'metrics':
            recipeState.setMetrics(message.data || message);
            break;
        default:
            console.warn('Unknown message type:', message.type);
    }
}

function routeUntypedMessage(message: any): void {
    console.log('[RecipeManagement] routeUntypedMessage, analyzing structure:', Object.keys(message));
    // Infer type from structure
    if (message.recipeStatus && message.currentStepIndex !== undefined) {
        console.log('[RecipeManagement] Detected as LiveViewDto');
        recipeState.setLiveView(message);
    } else if (message.recipes && Array.isArray(message.recipes)) {
        console.log('[RecipeManagement] Detected as AvailableRecipesDto');
        recipeState.setAvailableRecipes(message);
    } else if (message.steps && Array.isArray(message.steps) && message.steps[0]?.typeId) {
        console.log('[RecipeManagement] Detected as AvailableStepsDto with', message.steps.length, 'steps');
        recipeState.setAvailableSteps(message);
    } else if (message.id && message.name && message.steps) {
        console.log('[RecipeManagement] Detected as RecipeDto');
        recipeState.setCurrentRecipe(message);
    } else if (message.series && Array.isArray(message.series)) {
        console.log('[RecipeManagement] Detected as MetricsDto');
        recipeState.setMetrics(message);
    } else {
        console.warn('[RecipeManagement] Could not infer message type from structure:', message);
    }
}

// ========== Render Functions (use persistent renderers) ==========

/**
 * Render the Live View (real-time recipe execution monitoring)
 * Uses persistent renderer - safe to call multiple times (e.g., OnRestart)
 * @param container HTML element to render into
 */
export function renderLiveView(container: HTMLElement): void {
    if (!liveViewRenderer) {
        throw new Error('Recipe Management not initialized. Call setupRecipeManagement() first.');
    }
    liveViewRenderer.setContainer(container);
    liveViewRenderer.render();
}

/**
 * Render the Dashboard (available recipes overview)
 * Uses persistent renderer - safe to call multiple times (e.g., OnRestart)
 * @param container HTML element to render into
 */
export function renderDashboard(container: HTMLElement): void {
    if (!dashboardRenderer) {
        throw new Error('Recipe Management not initialized. Call setupRecipeManagement() first.');
    }
    dashboardRenderer.setContainer(container);
    dashboardRenderer.render();
}

/**
 * Render the Recipe Editor (create/edit recipes)
 * Uses persistent renderer - safe to call multiple times (e.g., OnRestart)
 * @param container HTML element to render into
 */
export function renderEditor(container: HTMLElement): void {
    if (!editorRenderer) {
        throw new Error('Recipe Management not initialized. Call setupRecipeManagement() first.');
    }
    editorRenderer.setContainer(container);
    editorRenderer.render();
}

/**
 * Render the Analytics View (metrics and charts - dummy implementation)
 * Uses persistent renderer - safe to call multiple times (e.g., OnRestart)
 * @param container HTML element to render into
 */
export function renderAnalytics(container: HTMLElement): void {
    if (!analyticsRenderer) {
        throw new Error('Recipe Management not initialized. Call setupRecipeManagement() first.');
    }
    analyticsRenderer.setContainer(container);
    analyticsRenderer.render();
}

// ========== Manual Command Sending ==========

/**
 * Send a command manually (alternative to UI interactions)
 * @param command CommandDto to send
 */
export function sendCommand(command: CommandDto): void {
    if (!globalSendFunction) {
        throw new Error('Recipe Management not initialized. Call setupRecipeManagement() first.');
    }
    console.log('%c[RecipeManagement] ⬆️ SENDEN:', 'color: #FF9800; font-weight: bold', command);
    globalSendFunction(command);
}

// ========== State Access (for advanced usage) ==========

/**
 * Get direct access to the state (for debugging or custom integrations)
 */
export function getState() {
    return recipeState;
}

/**
 * Reset all state (clears all data)
 */
export function resetState(): void {
    recipeState.reset();
}

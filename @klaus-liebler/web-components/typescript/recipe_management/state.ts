/**
 * Centralized State Management for Recipe Management
 * Handles automatic re-rendering when state changes
 */

import type {
    LiveViewDto,
    AvailableRecipesDto,
    AvailableStepsDto,
    RecipeDto,
    MetricsDto,
} from './types';

type StateChangeListener = () => void;

export class RecipeState {
    private liveView: LiveViewDto | null = null;
    private availableRecipes: AvailableRecipesDto | null = null;
    private availableSteps: AvailableStepsDto | null = null;
    private currentRecipe: RecipeDto | null = null;
    private metrics: MetricsDto | null = null;
    
    private listeners: Set<StateChangeListener> = new Set();

    // ========== Getters ==========

    getLiveView(): LiveViewDto | null {
        return this.liveView;
    }

    getAvailableRecipes(): AvailableRecipesDto | null {
        return this.availableRecipes;
    }

    getAvailableSteps(): AvailableStepsDto | null {
        return this.availableSteps;
    }

    getCurrentRecipe(): RecipeDto | null {
        return this.currentRecipe;
    }

    getMetrics(): MetricsDto | null {
        return this.metrics;
    }

    // ========== Setters (with auto-notify) ==========

    setLiveView(data: LiveViewDto): void {
        this.liveView = data;
        this.notifyListeners();
    }

    setAvailableRecipes(data: AvailableRecipesDto): void {
        console.log('[RecipeState] setAvailableRecipes called with', data.recipes?.length || 0, 'recipes');
        this.availableRecipes = data;
        this.notifyListeners();
        console.log('[RecipeState] Listeners notified');
    }

    setAvailableSteps(data: AvailableStepsDto): void {
        console.log('[RecipeState] setAvailableSteps called with', data.steps?.length || 0, 'steps');
        this.availableSteps = data;
        this.notifyListeners();
        console.log('[RecipeState] Listeners notified');
    }

    setCurrentRecipe(data: RecipeDto): void {
        console.log('[RecipeState] setCurrentRecipe called:', data.name || data.id || 'Unknown');
        this.currentRecipe = data;
        this.notifyListeners();
        console.log('[RecipeState] Listeners notified');
    }

    setMetrics(data: MetricsDto): void {
        this.metrics = data;
        this.notifyListeners();
    }

    // ========== Listener Management ==========

    subscribe(listener: StateChangeListener): () => void {
        this.listeners.add(listener);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener());
    }

    // ========== Reset ==========

    reset(): void {
        this.liveView = null;
        this.availableRecipes = null;
        this.availableSteps = null;
        this.currentRecipe = null;
        this.metrics = null;
        this.notifyListeners();
    }
}

// Global state instance
export const recipeState = new RecipeState();

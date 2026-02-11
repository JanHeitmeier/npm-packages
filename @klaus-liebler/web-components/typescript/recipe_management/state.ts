import type {
    LiveViewDto,
    AvailableRecipesDto,
    AvailableStepsDto,
    RecipeDto,
    ExecutionHistoryDto,
    TimeSeriesDataDto,
} from './types';

import type { LiveViewDto, AvailableRecipesDto, AvailableStepsDto, RecipeDto, ExecutionHistoryDto, TimeSeriesDataDto } from './types';

type StateChangeListener = () => void;

export class RecipeState {
    private liveView: LiveViewDto | null = null;
    private availableRecipes: AvailableRecipesDto | null = null;
    private availableSteps: AvailableStepsDto | null = null;
    private currentRecipe: RecipeDto | null = null;
    private executionHistory: ExecutionHistoryDto | null = null;
    private timeSeriesData: TimeSeriesDataDto | null = null;
    private selectedExecutionId: string | null = null;
    
    private sessionToken: string = '';
    private currentRole: 'Admin' | 'RecipeEditor' | 'RecipeStarter' | 'Observer' = 'Observer';
    
    private listeners: Set<StateChangeListener> = new Set();

    constructor() {
        this.loadSessionFromStorage();
    }

    private loadSessionFromStorage(): void {
        const token = sessionStorage.getItem('recipeSessionToken');
        const role = sessionStorage.getItem('recipeUserRole');
        if (token && role) {
            this.sessionToken = token;
            this.currentRole = role as any;
            console.log('%c[RecipeState] Session loaded from storage:', 'color: #2196F3', { role, tokenLength: token.length });
        } else {
            console.log('%c[RecipeState] No session in storage', 'color: #9E9E9E');
        }
    }

    private saveSessionToStorage(): void {
        if (this.sessionToken) {
            sessionStorage.setItem('recipeSessionToken', this.sessionToken);
            sessionStorage.setItem('recipeUserRole', this.currentRole);
            console.log('%c[RecipeState] Session saved to storage:', 'color: #4CAF50', { role: this.currentRole, tokenLength: this.sessionToken.length });
        } else {
            sessionStorage.removeItem('recipeSessionToken');
            sessionStorage.removeItem('recipeUserRole');
            console.log('%c[RecipeState] Session cleared from storage', 'color: #FF5722');
        }
    }

    // Session management
    setSession(token: string, role: 'Admin' | 'RecipeEditor' | 'RecipeStarter' | 'Observer'): void {
        this.sessionToken = token;
        this.currentRole = role;
        this.saveSessionToStorage();
        this.notifyListeners();
    }

    clearSession(): void {
        this.sessionToken = '';
        this.currentRole = 'Observer';
        this.saveSessionToStorage();
        this.notifyListeners();
    }

    getSessionToken(): string {
        return this.sessionToken;
    }

    getCurrentRole(): 'Admin' | 'RecipeEditor' | 'RecipeStarter' | 'Observer' {
        return this.currentRole;
    }

    isLoggedIn(): boolean {
        return this.sessionToken !== '';
    }

    hasPermission(requiredRole: 'Admin' | 'RecipeEditor' | 'RecipeStarter' | 'Observer'): boolean {
        const roleHierarchy = { Observer: 0, RecipeStarter: 1, RecipeEditor: 2, Admin: 3 };
        return roleHierarchy[this.currentRole] >= roleHierarchy[requiredRole];
    }

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

    getExecutionHistory(): ExecutionHistoryDto | null {
        return this.executionHistory;
    }

    getTimeSeriesData(): TimeSeriesDataDto | null {
        return this.timeSeriesData;
    }

    getSelectedExecutionId(): string | null {
        return this.selectedExecutionId;
    }

    getState() {
        return {
            liveView: this.liveView,
            availableRecipes: this.availableRecipes,
            availableSteps: this.availableSteps,
            currentRecipe: this.currentRecipe,
            executionHistory: this.executionHistory,
            timeSeriesData: this.timeSeriesData,
        };
    }

    setLiveView(data: LiveViewDto): void {
        this.liveView = data;
        this.notifyListeners();
    }

    setAvailableRecipes(data: AvailableRecipesDto): void {
        this.availableRecipes = data;
        this.notifyListeners();
    }

    setAvailableSteps(data: AvailableStepsDto): void {
        this.availableSteps = data;
        this.notifyListeners();
    }

    setCurrentRecipe(data: RecipeDto): void {
        this.currentRecipe = data;
        this.notifyListeners();
    }

    setExecutionHistory(data: ExecutionHistoryDto): void {
        this.executionHistory = data;
        this.notifyListeners();
    }

    setTimeSeriesData(data: TimeSeriesDataDto): void {
        this.timeSeriesData = data;
        this.notifyListeners();
    }

    setSelectedExecutionId(executionId: string | null): void {
        this.selectedExecutionId = executionId;
        this.notifyListeners();
    }


    subscribe(listener: StateChangeListener): () => void {
        this.listeners.add(listener);
        
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener());
    }


    reset(): void {
        this.liveView = null;
        this.availableRecipes = null;
        this.availableSteps = null;
        this.currentRecipe = null;
        this.executionHistory = null;
        this.timeSeriesData = null;
        this.notifyListeners();
    }
}

export const recipeState = new RecipeState();

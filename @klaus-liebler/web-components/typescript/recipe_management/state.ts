import type {
    LiveViewDto,
    AvailableRecipesDto,
    AvailableStepsDto,
    RecipeDto,
    ExecutionHistoryDto,
    TimeSeriesDataDto,
} from './types';

type StateChangeListener = () => void;

export class RecipeState {
    private liveView: LiveViewDto | null = null;
    private availableRecipes: AvailableRecipesDto | null = null;
    private availableSteps: AvailableStepsDto | null = null;
    private currentRecipe: RecipeDto | null = null;
    private executionHistory: ExecutionHistoryDto | null = null;
    private timeSeriesData: TimeSeriesDataDto | null = null;
    private selectedExecutionId: string | null = null;
    
    private listeners: Set<StateChangeListener> = new Set();

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

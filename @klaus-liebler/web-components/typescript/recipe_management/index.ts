/**
 * Recipe Management Library - Public API
 * 
 * Export all public functions and types for external use
 */

// Main API
export {
    setupRecipeManagement,
    receiveMessage,
    renderLiveView,
    renderDashboard,
    renderEditor,
    renderAnalytics,
    sendCommand,
    getState,
    resetState,
    type RecipeManagementConfig,
} from './RecipeManagement';

// Types (for TypeScript users)
export type {
    CommandDto,
    LiveViewDto,
    RecipeInfoDto,
    AvailableRecipesDto,
    RecipeListDto,
    ParameterMetadataDto,
    IoAliasMetadataDto,
    StepMetadataDto,
    AvailableStepsDto,
    StepConfigDto,
    RecipeDto,
    MetricDataPointDto,
    MetricSeriesDto,
    MetricsDto,
    RecipeMessage,
} from './types';

// State (for advanced usage)
export { recipeState, RecipeState } from './state';

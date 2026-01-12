/**
 * TypeScript DTOs derived from C++ structs
 * Source: labathome_firmware/main/recipemanagement/application/dtos/
 */

// ========== CommandDto (Frontend → Backend) ==========

export interface CommandDto {
    command: string;
    recipeId?: string;
    payload?: any;  // Can be object or string
    requestId?: string;
}

// ========== LiveViewDto (Backend → Frontend) ==========

export interface LiveViewDto {
    recipeId: string;
    recipeName: string;
    currentStepIndex: number;
    totalSteps: number;
    currentStepName: string;
    stepState: 'activating' | 'active' | 'deactivating' | 'idle';
    recipeStatus: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
    userInstruction: string;
    awaitingUserAcknowledgment: boolean;
    progress: number;
    timestamp: number;
    errorMessage: string;
    sensorValues: Record<string, number>;
}

// ========== AvailableRecipesDto (Backend → Frontend) ==========

export interface RecipeInfoDto {
    id: string;
    name: string;
    description: string;
    createdAt: number;
    lastModified: number;
}

export interface AvailableRecipesDto {
    recipes: RecipeInfoDto[];
}

export type RecipeListDto = AvailableRecipesDto;

// ========== AvailableStepsDto (Backend → Frontend) ==========

export interface ParameterMetadataDto {
    name: string;
    type: 'int' | 'float' | 'string' | 'bool';
    description: string;
    defaultValue: string;
    minValue: string;
    maxValue: string;
    required: boolean;
    unit: string;
}

export interface IoAliasMetadataDto {
    aliasName: string;
    ioType: 'input' | 'output' | 'sensor';
    valueType: 'bool' | 'int' | 'float';
    description: string;
    defaultPhysicalName: string;  // Default physical resource (z.B. LED → LED0)
}

export interface StepMetadataDto {
    typeId: string;
    displayName: string;
    description: string;
    category: string;
    parameters: ParameterMetadataDto[];
    ioAliases: IoAliasMetadataDto[];
}

export interface AvailableStepsDto {
    steps: StepMetadataDto[];
}

// ========== RecipeDto (Bidirectional) ==========

export interface StepConfigDto {
    stepTypeId: string;
    parameters: Record<string, string>;
    aliases: Record<string, string>;  // Hardware resource aliases (z.B. LED→LED0)
    order: number;
}

export interface RecipeDto {
    id: string;
    name: string;
    description: string;
    steps: StepConfigDto[];
    author: string;
    version: string;
}

// ========== MetricsDto (Backend → Frontend) ==========

export interface MetricDataPointDto {
    timestamp: number;
    value: number;
}

export interface MetricSeriesDto {
    name: string;
    unit: string;
    data: MetricDataPointDto[];
}

export interface MetricsDto {
    recipeId: string;
    series: MetricSeriesDto[];
}

// ========== Message Envelope ==========

export interface RecipeMessage {
    type: 'LiveViewDto' | 'AvailableRecipesDto' | 'AvailableStepsDto' | 'RecipeDto' | 'MetricsDto';
    data: LiveViewDto | AvailableRecipesDto | AvailableStepsDto | RecipeDto | MetricsDto;
}

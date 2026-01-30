export interface CommandDto {
    command: string;
    recipeId?: string;
    payload?: any;  // Can be object or string
    requestId?: string;
}

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

export interface RecipeInfoDto {
    id: string;
    name: string;
    description: string;
    version: string;
    createdAt: number;  // Unix timestamp in milliseconds
    lastModified: number;  // Unix timestamp in milliseconds
}

export interface AvailableRecipesDto {
    recipes: RecipeInfoDto[];
}

export type RecipeListDto = AvailableRecipesDto;

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
    createdAt?: number;  // Unix timestamp in milliseconds
    lastModified?: number;  // Unix timestamp in milliseconds
}

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

export interface RecipeMessage {
    type: 'LiveViewDto' | 'AvailableRecipesDto' | 'AvailableStepsDto' | 'RecipeDto' | 'MetricsDto';
    data: LiveViewDto | AvailableRecipesDto | AvailableStepsDto | RecipeDto | MetricsDto;
}

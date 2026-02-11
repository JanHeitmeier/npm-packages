export interface CommandDto {
    command: string;
    recipeId?: string;
    executionId?: string;  // For get_timeseries, delete_execution commands
    payload?: any;  // Can be object or string
    requestId?: string;
    sessionToken?: string;  // Session token from login
    pin?: string;  // Only for login command
    loginRole?: string;  // Role for login (Admin, RecipeEditor, RecipeStarter, Observer)
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
    isGlobal?: boolean;  // Rezeptweiter Parameter (z.B. Batch-Größe)
}

export interface IoAliasMetadataDto {
    aliasName: string;
    isInput: boolean;
    isOutput: boolean;
    isSensor: boolean;
    valueType: 'bool' | 'int' | 'float';
    description: string;
    defaultPhysicalName: string;  // Default physical resource (z.B. LED → LED0)
    unit: string;  // Unit for sensor values (e.g. "°C", "%", "RPM")
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
    createdAt?: number;
    lastModified?: number;
    globalParameters?: Record<string, string>;
}

export interface RecipeExecutionDto {
    executionId: string;
    recipeId: string;
    recipeName: string;
    startTime: number;
    endTime: number;
    duration: number;
    status: string;
    errorMessage: string;
    globalParameters?: Record<string, string>;
}

export interface ExecutionHistoryDto {
    executions: RecipeExecutionDto[];
}

export interface TimeSeriesPointDto {
    timestamp: number;
    value: number;
}

export interface SensorTimeSeriesDto {
    sensorName: string;
    unit: string;
    dataPoints: TimeSeriesPointDto[];
}

export interface TimeSeriesDataDto {
    executionId: string;
    series: SensorTimeSeriesDto[];
}

export interface AuthResponseDto {
    success: boolean;
    role: 'Admin' | 'RecipeEditor' | 'RecipeStarter' | 'Observer';
    sessionToken: string;
    errorMessage: string;
}

export interface CommandResponseDto {
    success: boolean;
    errorCode: number;  // 0 = OK, 401 = Unauthorized, 403 = Forbidden
    errorMessage: string;
    requestId: string;
}

export interface RecipeMessage {
    type: 'LiveViewDto' | 'AvailableRecipesDto' | 'AvailableStepsDto' | 'RecipeDto' | 'ExecutionHistoryDto' | 'TimeSeriesDataDto' | 'AuthResponseDto' | 'CommandResponseDto';
    data: LiveViewDto | AvailableRecipesDto | AvailableStepsDto | RecipeDto | ExecutionHistoryDto | TimeSeriesDataDto | AuthResponseDto | CommandResponseDto;
}

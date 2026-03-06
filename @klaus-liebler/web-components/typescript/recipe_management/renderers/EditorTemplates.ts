import { escapeHtml } from '../utils';

export function renderRecipeLoader(availableRecipes: any): string {
    if (!availableRecipes || !availableRecipes.recipes || availableRecipes.recipes.length === 0) {
        return '<p class="loading">No recipes available. Create a recipe and save it first.</p>';
    }

    return `
        <div class="step-type-list">
            ${availableRecipes.recipes.map((recipe: any) => {
                const createdDate = recipe.createdAt ? new Date(recipe.createdAt).toLocaleString('de-DE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A';
                const modifiedDate = recipe.lastModified ? new Date(recipe.lastModified).toLocaleString('de-DE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A';
                
                return `
                <div class="step-type-item" data-action="load-recipe" data-recipe-id="${escapeHtml(recipe.id)}">
                    <h4>${escapeHtml(recipe.name)} <span style="font-size: 0.8em; color: #999;">v${escapeHtml(recipe.version || '1.0')}</span></h4>
                    <p>${escapeHtml(recipe.description || 'No description')}</p>
                    <div style="font-size: 0.75em; color: #666; margin-top: 8px;">
                        <div>Created: ${createdDate}</div>
                        <div>Modified: ${modifiedDate}</div>
                    </div>
                    <span class="step-type-category">ID: ${escapeHtml(recipe.id)}</span>
                </div>
                `;
            }).join('')}
        </div>
    `;
}

export function renderStepsList(steps: any[], selectedStepIndex: number, getStepDisplayName: (typeId: string) => string): string {
    if (steps.length === 0) {
        return '<div class="empty-steps">No steps defined yet. Click "+ Add" to add a step.</div>';
    }

    return steps
        .sort((a, b) => a.order - b.order)
        .map((step, index) => `
            <div class="step-item ${selectedStepIndex === index ? 'selected' : ''}" data-action="select-step-item" data-step-index="${index}">
                <div class="step-item-header">
                    <span class="step-number">${step.order + 1}</span>
                    <span class="step-type-name">${escapeHtml(getStepDisplayName(step.stepTypeId))}</span>
                </div>
                <div class="step-footer">
                    <div class="step-category">${escapeHtml(step.stepTypeId)}</div>
                    <div class="step-actions">
                        <button class="btn-icon btn-arrow" data-action="move-up" data-step-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
                        <button class="btn-icon btn-arrow" data-action="move-down" data-step-index="${index}" ${index === steps.length - 1 ? 'disabled' : ''}>↓</button>
                        <button class="btn-icon btn-danger btn-delete" data-action="delete-step" data-step-index="${index}">🗑</button>
                    </div>
                </div>
            </div>
        `).join('');
}

export function renderStepParameters(step: any, stepMeta: any): string {
    if (!stepMeta || !stepMeta.parameters || stepMeta.parameters.length === 0) {
        return '<div class="no-step-selected">This step has no configurable parameters</div>';
    }

    // Filter out global parameters - they are shown in the global section
    const nonGlobalParams = stepMeta.parameters.filter((p: any) => !p.isGlobal);
    
    if (nonGlobalParams.length === 0) {
        return '<div class="no-step-selected">This step has only global parameters (shown above)</div>';
    }

    return nonGlobalParams.map((paramMeta: any) => {
        const currentValue = step.parameters[paramMeta.name] || paramMeta.defaultValue || '';
        
        // Determine input type and attributes
        let inputType = 'text';
        let minAttr = '';
        let maxAttr = '';
        let stepAttr = '';
        let inputValue = currentValue;
        
        // Color type stays as text - no special handling needed
        if (paramMeta.type === 'int' || paramMeta.type === 'float') {
            inputType = 'number';
            if (paramMeta.minValue !== undefined && paramMeta.minValue !== '') {
                minAttr = `min="${escapeHtml(paramMeta.minValue)}"`;
            }
            if (paramMeta.maxValue !== undefined && paramMeta.maxValue !== '') {
                maxAttr = `max="${escapeHtml(paramMeta.maxValue)}"`;
            }
            stepAttr = paramMeta.type === 'float' ? 'step="any"' : 'step="1"';
        } else if (paramMeta.type === 'bool') {
            inputType = 'checkbox';
        }
        
        // Format range display
        console.log(`[Parameter ${paramMeta.name}] minValue:`, paramMeta.minValue, 'maxValue:', paramMeta.maxValue, 'type:', typeof paramMeta.minValue, typeof paramMeta.maxValue);
        
        let rangeText = '';
        const hasMin = paramMeta.minValue !== undefined && paramMeta.minValue !== null && paramMeta.minValue !== '';
        const hasMax = paramMeta.maxValue !== undefined && paramMeta.maxValue !== null && paramMeta.maxValue !== '';
        
        if (hasMin && hasMax) {
            rangeText = `Range: ${paramMeta.minValue} - ${paramMeta.maxValue}`;
        } else if (hasMin) {
            rangeText = `Min: ${paramMeta.minValue}`;
        } else if (hasMax) {
            rangeText = `Max: ${paramMeta.maxValue}`;
        }
        
        // Build tooltip text for parameter
        let tooltipText = '';
        if (paramMeta.description) {
            tooltipText += escapeHtml(paramMeta.description);
        }
        if (hasMin || hasMax || paramMeta.unit) {
            if (tooltipText) tooltipText += '&#10;&#10;';
            if (hasMin && hasMax) {
                tooltipText += `Range: ${paramMeta.minValue} - ${paramMeta.maxValue}`;
            } else if (hasMin) {
                tooltipText += `Min: ${paramMeta.minValue}`;
            } else if (hasMax) {
                tooltipText += `Max: ${paramMeta.maxValue}`;
            }
            if (paramMeta.unit) {
                tooltipText += `&#10;Unit: ${escapeHtml(paramMeta.unit)}`;
            }
        }
        
        return `
            <div class="parameter-item-wide">
                <div class="parameter-label-section">
                    <label>
                        ${escapeHtml(paramMeta.name)}
                        ${tooltipText ? `<span class="info-icon" title="${tooltipText}">ℹ️</span>` : ''}
                    </label>
                </div>
                <div class="parameter-input-section">
                    <div class="parameter-input-group">
                        <input 
                            type="${inputType}" 
                            value="${escapeHtml(inputValue)}" 
                            data-param-key="${escapeHtml(paramMeta.name)}"
                            placeholder="${escapeHtml(paramMeta.defaultValue || '')}"
                            ${minAttr}
                            ${maxAttr}
                            ${stepAttr}
                        />
                        ${paramMeta.unit ? `<span class="parameter-unit">${escapeHtml(paramMeta.unit)}</span>` : ''}
                    </div>
                    ${rangeText ? `<div class="parameter-limits">${rangeText}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

export function renderStepSelector(availableSteps: any): string {
    if (!availableSteps.steps || availableSteps.steps.length === 0) {
        return '<p>No step types available</p>';
    }

    return `
        <div class="step-type-list">
            ${availableSteps.steps.map((stepMeta: any) => `
                <div class="step-type-item" data-action="select-step" data-step-type="${escapeHtml(stepMeta.typeId)}">
                    <h3>${escapeHtml(stepMeta.displayName)}</h3>
                    <p>${escapeHtml(stepMeta.description)}</p>
                    <span class="category">${escapeHtml(stepMeta.category)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

export function renderMainEditor(
    currentRecipe: any,
    selectedStepIndex: number,
    isStepSelectorOpen: boolean,
    isRecipeLoaderOpen: boolean,
    availableSteps: any,
    availableRecipes: any,
    renderGlobalParametersHtml: string,
    renderStepParametersHtml: string,
    getStepDisplayName: (typeId: string) => string
): string {
    return `
        <div class="editor-grid-container">
            <!-- Header: Title -->
            <div class="editor-title">
                <h1>Recipe Editor</h1>
            </div>

            <!-- Header: Action Buttons -->
            <div class="editor-actions">
                <button class="btn-secondary" data-action="open-recipe-loader">📂 Load</button>
                <button class="btn-secondary" data-action="new">📄 New</button>
                <button class="btn-primary" data-action="save">💾 Save</button>
                <button class="btn-danger" data-action="delete">🗑 Delete</button>
                <button class="btn-secondary" data-action="import">📥 Import</button>
                <button class="btn-secondary" data-action="export">📤 Export</button>
            </div>

            <!-- Left: Recipe Details (Fixed, Non-Scrollable) -->
            <div class="editor-details">
                <h2>Details</h2>
                <div class="details-form">
                    <div class="form-group">
                        <label for="recipe-name">
                            Name: 
                            <span class="info-icon" title="The recipe name is used to create the file ID in the format: NAME_vX_Y_recipe_timestamp.&#10;• Special characters are replaced with underscores&#10;• Multiple consecutive underscores are merged&#10;• Maximum length: 30 characters&#10;• Avoid dots and special characters for best results">ℹ️</span>
                        </label>
                        <input type="text" id="recipe-name" value="${escapeHtml(currentRecipe.name)}" placeholder="Recipe name" required maxlength="50" />
                    </div>
                    <div class="form-group">
                        <label for="recipe-description">
                            Description: *
                            <span class="info-icon" title="Brief description of what this recipe does.&#10;• Required field&#10;• Maximum length: 500 characters&#10;• Helps identify the recipe in the list&#10;• Supports multiple lines">ℹ️</span>
                        </label>
                        <textarea id="recipe-description" placeholder="Description" rows="3" maxlength="500" required style="resize: none;">${escapeHtml(currentRecipe.description)}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="recipe-author">
                            Author: *
                            <span class="info-icon" title="Name of the recipe creator.&#10;• Required field&#10;• Maximum length: 50 characters&#10;• Use your name or team name">ℹ️</span>
                        </label>
                        <input type="text" id="recipe-author" value="${escapeHtml(currentRecipe.author)}" placeholder="Author" maxlength="50" required />
                    </div>
                    <div class="form-group">
                        <label for="recipe-version">
                            Version: *
                            <span class="info-icon" title="Recipe version number (used in file ID).&#10;• Required field&#10;• Format: X.Y or X.Y.Z (e.g., 1.0 or 1.2.3)&#10;• Dots will be converted to underscores in file ID">ℹ️</span>
                        </label>
                        <input type="text" id="recipe-version" value="${escapeHtml(currentRecipe.version)}" placeholder="1.0" pattern="^\\d+(\\.\\d+){0,2}$" title="Version format: X.Y or X.Y.Z" required />
                    </div>
                    ${currentRecipe.createdAt ? `
                    <div class="form-group">
                        <label>Created:</label>
                        <div class="timestamp-display">${new Date(currentRecipe.createdAt).toLocaleString('de-DE', {
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                        })}</div>
                    </div>
                    ` : ''}
                    ${currentRecipe.lastModified ? `
                    <div class="form-group">
                        <label>Last Modified:</label>
                        <div class="timestamp-display">${new Date(currentRecipe.lastModified).toLocaleString('de-DE', {
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                        })}</div>
                    </div>
                    ` : ''}
                </div>
                ${renderGlobalParametersHtml}
            </div>

            <!-- Center: Steps List (Scrollable) -->
            <div class="editor-steps-list">
                <div class="steps-list-header">
                    <h2>Steps (${currentRecipe.steps.length})</h2>
                    <button class="btn-success" data-action="open-step-selector">+ Add</button>
                </div>
                <div class="steps-list-content">
                    ${renderStepsList(currentRecipe.steps, selectedStepIndex, getStepDisplayName)}
                </div>
            </div>

            <!-- Right: Parameters (Scrollable if needed) -->
            <div class="editor-step-parameters">
                <div class="parameters-header">
                    <h2>Parameter</h2>
                </div>
                <div class="parameters-content">
                    ${renderStepParametersHtml}
                </div>
            </div>
        </div>

        <!-- Step Selector Modal -->
        <div class="step-selector-modal ${isStepSelectorOpen ? 'active' : ''}" data-modal="step-selector">
            <div class="step-selector-content">
                <div class="step-selector-header">
                    <h2>Select step type</h2>
                    <button class="btn-secondary" data-action="close-step-selector" style="background:red;color:white;">✕ Close</button>
                </div>
                <div class="step-selector-body">
                    ${availableSteps ? renderStepSelector(availableSteps) : '<p class="loading">Loading available step types...</p>'}
                </div>
            </div>
        </div>

        <!-- Recipe Loader Modal -->
        <div class="step-selector-modal ${isRecipeLoaderOpen ? 'active' : ''}" data-modal="recipe-loader">
            <div class="step-selector-content">
                <div class="step-selector-header">
                    <h2>Select recipe to edit</h2>
                    <button class="btn-secondary" data-action="close-recipe-loader" style="background:red;color:white;">✕ Close</button>
                </div>
                <div class="step-selector-body">
                    ${renderRecipeLoader(availableRecipes)}
                </div>
            </div>
        </div>
    `;
}

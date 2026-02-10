import { recipeState } from '../state';
import type { ViewHandle } from './LiveViewRenderer';
import type { ExecutionHistoryDto, RecipeExecutionDto } from '../types';
import { PrintReportRenderer } from './PrintReportRenderer';

type SortField = 'date' | 'recipe' | 'status' | 'duration';
type SortDirection = 'asc' | 'desc';

export class AnalyticsRenderer implements ViewHandle {
    private container: HTMLElement;
    private unsubscribe: (() => void) | null = null;
    private sendCommandFn: ((cmd: any) => void) | null = null;
    
    private sortField: SortField = 'date';
    private sortDirection: SortDirection = 'desc';

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.classList.add('recipe-mgmt-analytics');
        this.unsubscribe = recipeState.subscribe(() => this.render());
    }

    setSendFunction(sendFn: (cmd: any) => void): void {
        this.sendCommandFn = sendFn;
        this.sendCommandFn({ command: 'get_execution_history' });
    }

    setContainer(container: HTMLElement): void {
        this.container = container;
        this.container.classList.add('recipe-mgmt-analytics');
        
        // Request execution history when container is set
        if (this.sendCommandFn) {
            this.sendCommandFn({ command: 'get_execution_history' });
        }
    }

    private getSortedExecutions(): RecipeExecutionDto[] {
        const history = recipeState.getState().executionHistory;
        if (!history || !history.executions) return [];
        
        const sorted = [...history.executions];
        sorted.sort((a, b) => {
            let comparison = 0;
            
            switch (this.sortField) {
                case 'date':
                    comparison = a.startTime - b.startTime;
                    break;
                case 'recipe':
                    comparison = a.recipeName.localeCompare(b.recipeName);
                    break;
                case 'status':
                    comparison = a.status.localeCompare(b.status);
                    break;
                case 'duration':
                    comparison = a.duration - b.duration;
                    break;
            }
            
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
        
        return sorted;
    }

    private formatTimestamp(ts: number): string {
        const date = new Date(ts);
        return date.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    private getStatusColor(status: string): string {
        switch (status.toLowerCase()) {
            case 'completed': return 'var(--success-green)';
            case 'running': return 'var(--blue-base)';
            case 'failed': return 'var(--error-red)';
            case 'aborted': return 'var(--warning-yellow)';
            default: return 'var(--text-light)';
        }
    }

    private handleSort(field: SortField): void {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'desc';
        }
        this.render();
    }

    private handleOpenPrintView(execution: RecipeExecutionDto): void {
        if (!this.sendCommandFn) {
            console.error('[Analytics] No send function available');
            return;
        }
        
        // Open print view in new window
        const printRenderer = new PrintReportRenderer(this.sendCommandFn);
        printRenderer.openPrintView(execution);
    }

    private handleDeleteExecution(executionId: string): void {
        if (confirm('Really delete execution?')) {
            if (this.sendCommandFn) {
                this.sendCommandFn({
                    command: 'delete_execution',
                    executionId: executionId
                });
            }
            this.render();
        }
    }

    render(): void {
        const executions = this.getSortedExecutions();
        
        this.container.innerHTML = `
            <div class="analytics-layout">
                <div class="analytics-header">
                    <h1 class="analytics-title">Analytics</h1>
                    
                    <div class="sort-controls">
                        <label>Sort:</label>
                        <select id="sort-field">
                            <option value="date" ${this.sortField === 'date' ? 'selected' : ''}>Date</option>
                            <option value="recipe" ${this.sortField === 'recipe' ? 'selected' : ''}>Recipe</option>
                            <option value="status" ${this.sortField === 'status' ? 'selected' : ''}>Status</option>
                            <option value="duration" ${this.sortField === 'duration' ? 'selected' : ''}>Duration</option>
                        </select>
                        <select id="sort-direction">
                            <option value="desc" ${this.sortDirection === 'desc' ? 'selected' : ''}>Descending ↓</option>
                            <option value="asc" ${this.sortDirection === 'asc' ? 'selected' : ''}>Ascending ↑</option>
                        </select>
                    </div>
                </div>
                
                <div class="execution-cards">
                    ${executions.length === 0 ? `
                        <div class="empty-state">
                            <p>No executions available</p>
                            <p class="hint">Executed recipes will be displayed here</p>
                        </div>
                    ` : executions.map(exec => this.renderExecutionCard(exec)).join('')}
                </div>
            </div>
        `;
        
        this.attachEventListeners();
    }

    private renderExecutionCard(exec: RecipeExecutionDto): string {
        const statusIcon = exec.status === 'completed' ? '✓' : exec.status === 'error' ? '✗' : '●';
        const statusColor = this.getStatusColor(exec.status);
        const hasError = exec.errorMessage && exec.errorMessage.trim() !== '';
        
        return `
            <div class="execution-card">
                <div class="card-header">
                    <div class="card-title-row">
                        <span class="status-icon" style="color: ${statusColor}">${statusIcon}</span>
                        <h3 class="recipe-name">${exec.recipeName || 'Unnamed Recipe'}</h3>
                        <span class="status-badge" style="background-color: ${statusColor}">${exec.status}</span>
                    </div>
                </div>
                
                <div class="card-body">
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Execution ID:</span>
                            <span class="info-value">${exec.executionId}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Recipe ID:</span>
                            <span class="info-value">${exec.recipeId}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Start Time:</span>
                            <span class="info-value">${this.formatTimestamp(exec.startTime)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">End Time:</span>
                            <span class="info-value">${this.formatTimestamp(exec.endTime)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Duration:</span>
                            <span class="info-value">${this.formatDuration(exec.duration)}</span>
                        </div>
                        ${hasError ? `
                        <div class="info-item info-item-error">
                            <span class="info-label">Error:</span>
                            <span class="info-value">${exec.errorMessage}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="card-footer">
                    <button class="btn-print" data-exec-id="${exec.executionId}">
                        📄 Open Print View
                    </button>
                    <button class="btn-delete" data-exec-id="${exec.executionId}">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }

    private attachEventListeners(): void {
        const sortFieldSelect = this.container.querySelector('#sort-field') as HTMLSelectElement;
        if (sortFieldSelect) {
            sortFieldSelect.addEventListener('change', () => {
                this.sortField = sortFieldSelect.value as SortField;
                this.render();
            });
        }
        
        const sortDirectionSelect = this.container.querySelector('#sort-direction') as HTMLSelectElement;
        if (sortDirectionSelect) {
            sortDirectionSelect.addEventListener('change', () => {
                this.sortDirection = sortDirectionSelect.value as SortDirection;
                this.render();
            });
        }
        
        // Print buttons
        this.container.querySelectorAll('.btn-print').forEach(btn => {
            btn.addEventListener('click', () => {
                const execId = (btn as HTMLElement).dataset.execId;
                const exec = this.getSortedExecutions().find(e => e.executionId === execId);
                if (exec) this.handleOpenPrintView(exec);
            });
        });
        
        // Delete buttons
        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const execId = (btn as HTMLElement).dataset.execId;
                if (execId) this.handleDeleteExecution(execId);
            });
        });
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.container.innerHTML = '';
        this.container.classList.remove('recipe-mgmt-analytics');
    }

    isVisible(): boolean {
        return this.container.offsetParent !== null;
    }
}

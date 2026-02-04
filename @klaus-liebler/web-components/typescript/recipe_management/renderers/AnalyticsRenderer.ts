import { recipeState } from '../state';
import type { ViewHandle } from './LiveViewRenderer';
import type { ExecutionHistoryDto, RecipeExecutionDto, TimeSeriesDataDto, SensorTimeSeriesDto } from '../types';

type SortField = 'date' | 'recipe' | 'status' | 'duration';
type SortDirection = 'asc' | 'desc';

export class AnalyticsRenderer implements ViewHandle {
    private container: HTMLElement;
    private unsubscribe: (() => void) | null = null;
    private sendCommandFn: ((cmd: any) => void) | null = null;
    
    private sortField: SortField = 'date';
    private sortDirection: SortDirection = 'desc';
    private selectedExecution: RecipeExecutionDto | null = null;
    private selectedSensor: string | null = null;
    private timeSeriesData: TimeSeriesDataDto | null = null;

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
        
        // Check if there's a pre-selected execution from navigation
        const preSelectedExecutionId = recipeState.getSelectedExecutionId();
        if (preSelectedExecutionId && this.sendCommandFn) {
            const history = recipeState.getExecutionHistory();
            if (history && history.executions) {
                const execution = history.executions.find(e => e.executionId === preSelectedExecutionId);
                if (execution) {
                    this.selectedExecution = execution;
                    this.sendCommandFn({ command: 'get_timeseries', executionId: preSelectedExecutionId });
                }
            }
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

    private handleSelectExecution(execution: RecipeExecutionDto): void {
        this.selectedExecution = execution;
        this.selectedSensor = null;
        this.timeSeriesData = null;
        
        if (this.sendCommandFn) {
            this.sendCommandFn({
                command: 'get_timeseries',
                executionId: execution.executionId
            });
        }
        
        this.render();
    }

    private handleDeleteExecution(executionId: string): void {
        if (confirm('Ausführung wirklich löschen?')) {
            if (this.sendCommandFn) {
                this.sendCommandFn({
                    command: 'delete_execution',
                    executionId: executionId
                });
            }
            if (this.selectedExecution?.executionId === executionId) {
                this.selectedExecution = null;
                this.timeSeriesData = null;
            }
            this.render();
        }
    }

    private handleSelectSensor(sensorName: string): void {
        this.selectedSensor = sensorName;
        this.render();
    }

    private handleExportExecution(executionId: string): void {
        if (!this.timeSeriesData || this.timeSeriesData.executionId !== executionId) {
            alert('Keine Sensor-Daten zum Exportieren verfügbar');
            return;
        }
        
        if (this.timeSeriesData.series.length === 0) {
            alert('Keine Sensor-Daten vorhanden');
            return;
        }
        
        this.exportChartsAsImages(executionId);
    }

    private exportChartsAsImages(executionId: string): void {
        if (!this.selectedExecution || !this.timeSeriesData) return;
        
        const startTimeStr = new Date(this.selectedExecution.startTime).toISOString().replace(/[:.]/g, '-').slice(0, 19);
        
        // Create a temporary canvas for export (larger resolution)
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 1200;
        exportCanvas.height = 600;
        
        this.timeSeriesData.series.forEach(sensor => {
            // Draw chart on temporary canvas
            this.drawChart(exportCanvas, sensor);
            
            // Convert canvas to blob and download
            exportCanvas.toBlob((blob) => {
                if (!blob) return;
                
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${executionId}_${startTimeStr}_${sensor.sensorName}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 'image/png');
        });
        
        console.log(`[ANALYTICS] Exported ${this.timeSeriesData.series.length} charts for execution ${executionId}`);
    }

    private drawChart(canvas: HTMLCanvasElement, sensor: SensorTimeSeriesDto): void {
        const ctx = canvas.getContext('2d');
        if (!ctx || sensor.dataPoints.length === 0) return;
        
        const width = canvas.width;
        const height = canvas.height;
        const padding = 60;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;
        
        ctx.clearRect(0, 0, width, height);
        
        const values = sensor.dataPoints.map(p => p.value);
        const timestamps = sensor.dataPoints.map(p => p.timestamp);
        
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const valueRange = maxValue - minValue || 1;
        
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        const timeRange = maxTime - minTime || 1;
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines (5 lines)
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }
        
        // Vertical grid lines (5 lines)
        for (let i = 0; i <= 5; i++) {
            const x = padding + (chartWidth / 5) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, height - padding);
            ctx.stroke();
        }
        
        // Y-Axis labels (values from min to max)
        ctx.fillStyle = '#333';
        ctx.font = '12px Dosis';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i <= 5; i++) {
            const value = minValue + (valueRange / 5) * (5 - i);
            const y = padding + (chartHeight / 5) * i;
            ctx.fillText(value.toFixed(2), padding - 10, y);
        }
        
        // X-Axis labels (time duration)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        const durationMs = timeRange;
        for (let i = 0; i <= 5; i++) {
            const timeMs = (durationMs / 5) * i;
            const x = padding + (chartWidth / 5) * i;
            
            // Format time as MM:SS or HH:MM:SS
            const seconds = Math.floor(timeMs / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            
            let timeLabel: string;
            if (hours > 0) {
                timeLabel = `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
            } else {
                timeLabel = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
            }
            
            ctx.fillText(timeLabel, x, height - padding + 10);
        }
        
        // Draw data line
        ctx.strokeStyle = 'var(--blue-base)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        sensor.dataPoints.forEach((point, index) => {
            const x = padding + ((point.timestamp - minTime) / timeRange) * chartWidth;
            const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw data points
        ctx.fillStyle = 'var(--blue-base)';
        sensor.dataPoints.forEach(point => {
            const x = padding + ((point.timestamp - minTime) / timeRange) * chartWidth;
            const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        // Title
        ctx.fillStyle = '#333';
        ctx.font = 'bold 16px Dosis';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${sensor.sensorName} (${sensor.unit})`, padding, 10);
    }

    render(): void {
        const executionHistory = recipeState.getExecutionHistory();
        const timeSeriesData = recipeState.getTimeSeriesData();
        const executions = this.getSortedExecutions();
        
        if (timeSeriesData && timeSeriesData.executionId === this.selectedExecution?.executionId) {
            this.timeSeriesData = timeSeriesData;
            if (this.timeSeriesData.series.length > 0 && !this.selectedSensor) {
                this.selectedSensor = this.timeSeriesData.series[0].sensorName;
            }
        }
        
        this.container.innerHTML = `
            <div class="analytics-layout">
                <!-- Analytics Title -->
                <div class="analytics-title">Analytics</div>
                
                <!-- Left: Execution List (30%) -->
                <div class="execution-list-panel">
                    <h2>Ausführungen</h2>
                    
                    <div class="sort-controls">
                        <select id="sort-field">
                            <option value="date" ${this.sortField === 'date' ? 'selected' : ''}>Datum</option>
                            <option value="recipe" ${this.sortField === 'recipe' ? 'selected' : ''}>Rezept</option>
                        </select>
                        <select id="sort-direction">
                            <option value="desc" ${this.sortDirection === 'desc' ? 'selected' : ''}>↓</option>
                            <option value="asc" ${this.sortDirection === 'asc' ? 'selected' : ''}>↑</option>
                        </select>
                    </div>
                    
                    <div class="execution-list">
                        ${executions.length === 0 ? `
                            <div class="empty-state">Keine Ausführungen</div>
                        ` : executions.map(exec => {
                            const statusIcon = exec.status === 'completed' ? '✓' : exec.status === 'error' ? '✗' : '●';
                            const statusColor = this.getStatusColor(exec.status);
                            const isSelected = this.selectedExecution?.executionId === exec.executionId;
                            
                            return `
                                <div class="execution-item ${isSelected ? 'selected' : ''}" data-exec-id="${exec.executionId}">
                                    <div class="execution-header">
                                        <span class="status-icon" style="color: ${statusColor}">${statusIcon}</span>
                                        <span class="recipe-name">${exec.recipeName || 'Unbenannt'}</span>
                                    </div>
                                    <div class="execution-time">${this.formatTimestamp(exec.startTime)}</div>
                                    <div class="execution-duration">${this.formatDuration(exec.duration)}</div>
                                    <div class="execution-actions">
                                        <button class="btn-view-small" data-exec-id="${exec.executionId}">Anzeigen</button>
                                        <button class="btn-delete-small" data-exec-id="${exec.executionId}">×</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <!-- Right: Details Panel (70%) -->
                <div class="details-panel">
                    ${this.selectedExecution ? `
                        <div class="details-content">
                            <h2>${this.selectedExecution.recipeName || 'Unbenanntes Rezept'}</h2>
                            
                            <div class="details-grid">
                                <div class="detail-item">
                                    <span class="detail-label">Execution-ID</span>
                                    <span class="detail-value">${this.selectedExecution.executionId}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Startzeit</span>
                                    <span class="detail-value">${this.formatTimestamp(this.selectedExecution.startTime)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Dauer</span>
                                    <span class="detail-value">${this.formatDuration(this.selectedExecution.duration)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Status</span>
                                    <span class="detail-value" style="color: ${this.getStatusColor(this.selectedExecution.status)}">${this.selectedExecution.status}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Aktionen</span>
                                    <div>
                                        <button class="btn-export" data-exec-id="${this.selectedExecution.executionId}">Exportieren</button>
                                        <button class="btn-delete-execution" data-exec-id="${this.selectedExecution.executionId}">Löschen</button>
                                    </div>
                                </div>
                            </div>
                            
                            ${this.timeSeriesData && this.timeSeriesData.series.length > 0 ? `
                                <div class="sensor-section">
                                    <h3>Sensor-Daten</h3>
                                    
                                    ${this.timeSeriesData.series.length > 1 ? `
                                        <div class="sensor-tabs">
                                            ${this.timeSeriesData.series.map(sensor => `
                                                <button class="sensor-tab ${this.selectedSensor === sensor.sensorName ? 'active' : ''}"
                                                        data-sensor="${sensor.sensorName}">
                                                    ${sensor.sensorName}
                                                </button>
                                            `).join('')}
                                        </div>
                                    ` : `
                                        <div class="single-sensor-title">${this.timeSeriesData.series[0].sensorName} (${this.timeSeriesData.series[0].unit})</div>
                                    `}
                                    
                                    <div class="chart-container">
                                        <canvas id="chart-canvas" width="800" height="400"></canvas>
                                    </div>
                                </div>
                            ` : `
                                <div class="no-data">
                                    ${this.timeSeriesData ? 'Keine Sensor-Daten verfügbar' : 'Lade Daten...'}
                                </div>
                            `}
                        </div>
                    ` : `
                        <div class="empty-selection">
                            <p>Keine Execution ausgewählt</p>
                            <p class="hint">Wählen Sie eine Execution aus der Liste, um Details anzuzeigen</p>
                        </div>
                    `}
                </div>
            </div>
        `;
        
        this.attachEventListeners();
        this.renderChart();
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
        
        // Execution item click (entire row)
        this.container.querySelectorAll('.execution-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Ignore if clicking on buttons
                if ((e.target as HTMLElement).closest('button')) return;
                
                const execId = (item as HTMLElement).dataset.execId;
                const exec = this.getSortedExecutions().find(e => e.executionId === execId);
                if (exec) this.handleSelectExecution(exec);
            });
        });
        
        // View buttons
        this.container.querySelectorAll('.btn-view-small').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const execId = (btn as HTMLElement).dataset.execId;
                const exec = this.getSortedExecutions().find(e => e.executionId === execId);
                if (exec) this.handleSelectExecution(exec);
            });
        });
        
        // Delete buttons
        this.container.querySelectorAll('.btn-delete-small').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const execId = (btn as HTMLElement).dataset.execId;
                if (execId) this.handleDeleteExecution(execId);
            });
        });
        
        // Sensor tabs
        this.container.querySelectorAll('.sensor-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const sensorName = (btn as HTMLElement).dataset.sensor;
                if (sensorName) this.handleSelectSensor(sensorName);
            });
        });
        
        // Export button
        this.container.querySelectorAll('.btn-export').forEach(btn => {
            btn.addEventListener('click', () => {
                const execId = (btn as HTMLElement).dataset.execId;
                if (execId) this.handleExportExecution(execId);
            });
        });
        
        // Delete execution button (in details)
        this.container.querySelectorAll('.btn-delete-execution').forEach(btn => {
            btn.addEventListener('click', () => {
                const execId = (btn as HTMLElement).dataset.execId;
                if (execId) this.handleDeleteExecution(execId);
            });
        });
    }

    private renderChart(): void {
        if (!this.timeSeriesData || !this.selectedSensor) {
            return;
        }
        
        const sensor = this.timeSeriesData.series.find(s => s.sensorName === this.selectedSensor);
        if (!sensor) {
            console.error('[ANALYTICS] Selected sensor not found:', this.selectedSensor);
            return;
        }
        
        const canvas = this.container.querySelector('#chart-canvas') as HTMLCanvasElement;
        if (canvas) {
            this.drawChart(canvas, sensor);
        }
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

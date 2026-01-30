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
        
        if (this.sendCommandFn) {
            this.sendCommandFn({ command: 'get_execution_history' });
        }
    }

    setSendFunction(sendFn: (cmd: any) => void): void {
        this.sendCommandFn = sendFn;
        this.sendCommandFn({ command: 'get_execution_history' });
    }

    setContainer(container: HTMLElement): void {
        this.container = container;
        this.container.classList.add('recipe-mgmt-analytics');
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
                recipeId: execution.executionId
            });
        }
        
        this.render();
    }

    private handleDeleteExecution(executionId: string): void {
        if (confirm('Ausführung wirklich löschen?')) {
            if (this.sendCommandFn) {
                this.sendCommandFn({
                    command: 'delete_execution',
                    recipeId: executionId
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

    private drawChart(canvas: HTMLCanvasElement, sensor: SensorTimeSeriesDto): void {
        const ctx = canvas.getContext('2d');
        if (!ctx || sensor.dataPoints.length === 0) return;
        
        const width = canvas.width;
        const height = canvas.height;
        const padding = 50;
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
        
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
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
        
        ctx.fillStyle = 'var(--blue-base)';
        sensor.dataPoints.forEach(point => {
            const x = padding + ((point.timestamp - minTime) / timeRange) * chartWidth;
            const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        ctx.fillStyle = 'var(--text-dark)';
        ctx.font = '12px Dosis';
        ctx.textAlign = 'left';
        ctx.fillText(`${sensor.sensorName} (${sensor.unit})`, padding, padding - 10);
        
        ctx.textAlign = 'right';
        ctx.fillText(`Max: ${maxValue.toFixed(2)} ${sensor.unit}`, width - padding, padding - 10);
        ctx.textAlign = 'left';
        ctx.fillText(`Min: ${minValue.toFixed(2)} ${sensor.unit}`, padding, height - padding + 30);
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
            <div class="analytics-container">
                <h1>Ausführungshistorie & Analytics</h1>
                
                <div class="analytics-view">
                    <h2>Rezept-Ausführungen</h2>
                    
                    <div class="analytics-filters">
                        <div class="filter-group">
                            <label>Sortierung</label>
                            <select id="sort-field">
                                <option value="date" ${this.sortField === 'date' ? 'selected' : ''}>Datum</option>
                                <option value="recipe" ${this.sortField === 'recipe' ? 'selected' : ''}>Rezept</option>
                                <option value="status" ${this.sortField === 'status' ? 'selected' : ''}>Status</option>
                                <option value="duration" ${this.sortField === 'duration' ? 'selected' : ''}>Dauer</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Richtung</label>
                            <select id="sort-direction">
                                <option value="desc" ${this.sortDirection === 'desc' ? 'selected' : ''}>Absteigend</option>
                                <option value="asc" ${this.sortDirection === 'asc' ? 'selected' : ''}>Aufsteigend</option>
                            </select>
                        </div>
                    </div>
                    
                    ${executions.length === 0 ? `
                        <div style="padding: 40px; text-align: center; color: var(--text-light);">
                            Keine Ausführungen gefunden
                        </div>
                    ` : `
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Datum</th>
                                    <th>Rezept</th>
                                    <th>Status</th>
                                    <th>Dauer</th>
                                    <th>Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${executions.map(exec => `
                                    <tr class="${this.selectedExecution?.executionId === exec.executionId ? 'selected-row' : ''}"
                                        style="cursor: pointer;"
                                        data-exec-id="${exec.executionId}">
                                        <td>${this.formatTimestamp(exec.startTime)}</td>
                                        <td>${exec.recipeName}</td>
                                        <td>
                                            <span style="color: ${this.getStatusColor(exec.status)}; font-weight: 600;">
                                                ${exec.status}
                                            </span>
                                        </td>
                                        <td>${this.formatDuration(exec.duration)}</td>
                                        <td>
                                            <button class="btn-view" data-exec-id="${exec.executionId}">Anzeigen</button>
                                            <button class="btn-delete" data-exec-id="${exec.executionId}">Löschen</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
                
                ${this.selectedExecution ? `
                    <div class="analytics-view" style="margin-top: 20px;">
                        <h2>Details: ${this.selectedExecution.recipeName}</h2>
                        
                        <div class="analytics-grid">
                            <div class="analytics-card">
                                <h3>Ausführungs-ID</h3>
                                <div class="analytics-value" style="font-size: 1rem;">${this.selectedExecution.executionId}</div>
                            </div>
                            <div class="analytics-card">
                                <h3>Startzeit</h3>
                                <div class="analytics-value" style="font-size: 1.2rem;">${this.formatTimestamp(this.selectedExecution.startTime)}</div>
                            </div>
                            <div class="analytics-card">
                                <h3>Endzeit</h3>
                                <div class="analytics-value" style="font-size: 1.2rem;">${this.formatTimestamp(this.selectedExecution.endTime)}</div>
                            </div>
                            <div class="analytics-card">
                                <h3>Gesamtdauer</h3>
                                <div class="analytics-value">${this.formatDuration(this.selectedExecution.duration)}</div>
                            </div>
                        </div>
                        
                        ${this.timeSeriesData && this.timeSeriesData.series.length > 0 ? `
                            <h3 style="margin-top: 30px; color: var(--blue-base);">Sensor-Daten</h3>
                            
                            ${this.timeSeriesData.series.length > 1 ? `
                                <div class="sensor-tabs" style="display: flex; gap: 10px; margin: 15px 0; flex-wrap: wrap;">
                                    ${this.timeSeriesData.series.map(sensor => `
                                        <button class="sensor-tab ${this.selectedSensor === sensor.sensorName ? 'active' : ''}"
                                                data-sensor="${sensor.sensorName}"
                                                style="padding: 8px 16px; 
                                                       border: 2px solid var(--blue-base);
                                                       background: ${this.selectedSensor === sensor.sensorName ? 'var(--blue-base)' : 'white'};
                                                       color: ${this.selectedSensor === sensor.sensorName ? 'white' : 'var(--blue-base)'};
                                                       border-radius: 4px;
                                                       cursor: pointer;
                                                       font-weight: 600;">
                                            ${sensor.sensorName}
                                        </button>
                                    `).join('')}
                                </div>
                            ` : ''}
                            
                            ${this.selectedSensor ? `
                                <div class="chart-container">
                                    <canvas id="chart-canvas" width="800" height="400"></canvas>
                                </div>
                            ` : ''}
                        ` : `
                            <div style="padding: 20px; text-align: center; color: var(--text-light); margin-top: 20px;">
                                ${this.timeSeriesData ? 'Keine Sensor-Daten verfügbar' : 'Lade Daten...'}
                            </div>
                        `}
                    </div>
                ` : ''}
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
        
        this.container.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const execId = (btn as HTMLElement).dataset.execId;
                const exec = this.getSortedExecutions().find(e => e.executionId === execId);
                if (exec) this.handleSelectExecution(exec);
            });
        });
        
        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const execId = (btn as HTMLElement).dataset.execId;
                if (execId) this.handleDeleteExecution(execId);
            });
        });
        
        this.container.querySelectorAll('.sensor-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const sensorName = (btn as HTMLElement).dataset.sensor;
                if (sensorName) this.handleSelectSensor(sensorName);
            });
        });
    }

    private renderChart(): void {
        if (!this.timeSeriesData || !this.selectedSensor) return;
        
        const sensor = this.timeSeriesData.series.find(s => s.sensorName === this.selectedSensor);
        if (!sensor) return;
        
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

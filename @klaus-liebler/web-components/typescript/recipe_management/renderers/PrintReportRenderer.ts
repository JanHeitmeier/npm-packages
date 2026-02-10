import type { RecipeExecutionDto, RecipeDto, TimeSeriesDataDto, SensorTimeSeriesDto, StepMetadataDto, CommandDto } from '../types';
import { recipeState } from '../state';

interface PrintData {
    execution: RecipeExecutionDto;
    recipe: RecipeDto | null;
    timeSeries: TimeSeriesDataDto | null;
    availableSteps: StepMetadataDto[];
}

export class PrintReportRenderer {
    private sendCommandFn: (cmd: CommandDto) => void;
    private printWindow: Window | null = null;

    constructor(sendCommandFn: (cmd: CommandDto) => void) {
        this.sendCommandFn = sendCommandFn;
    }

    public async openPrintView(execution: RecipeExecutionDto): Promise<void> {
        console.log('[PrintReport] Opening print view for execution:', execution.executionId);
        
        // Open new window immediately (must be in same event loop as user click)
        this.printWindow = window.open('', '_blank');
        if (!this.printWindow) {
            alert('Pop-up wurde blockiert. Bitte erlauben Sie Pop-ups für diese Seite.');
            return;
        }
        
        // Show loading message
        this.printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Laden...</title>
                <style>
                    body {
                        font-family: 'Dosis', sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .loading {
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="loading">
                    <h2>Lade Daten...</h2>
                    <p>Bitte warten Sie, während die Druckansicht vorbereitet wird.</p>
                </div>
            </body>
            </html>
        `);
        
        try {
            // Load all required data
            const data = await this.loadPrintData(execution);
            
            // Generate and render the print document
            this.renderPrintDocument(data);
        } catch (error) {
            console.error('[PrintReport] Error loading data:', error);
            if (this.printWindow && !this.printWindow.closed) {
                this.printWindow.document.body.innerHTML = `
                    <div class="error">
                        <h2>Fehler beim Laden der Daten</h2>
                        <p>${error}</p>
                    </div>
                `;
            }
        }
    }

    private async loadPrintData(execution: RecipeExecutionDto): Promise<PrintData> {
        console.log('[PrintReport] Loading data for execution:', execution.executionId);
        
        // Load recipe details
        this.sendCommandFn({ command: 'get_recipe', recipeId: execution.recipeId });
        
        // Load time series data
        this.sendCommandFn({ command: 'get_timeseries', executionId: execution.executionId });
        
        // Wait for data to be loaded into state
        await this.waitForData(execution.recipeId, execution.executionId);
        
        const recipe = recipeState.getCurrentRecipe();
        const timeSeries = recipeState.getTimeSeriesData();
        const availableSteps = recipeState.getAvailableSteps()?.steps || [];
        
        console.log('[PrintReport] Loaded recipe:', recipe?.name);
        console.log('[PrintReport] Loaded timeseries with', timeSeries?.series?.length || 0, 'sensors');
        
        return {
            execution,
            recipe,
            timeSeries,
            availableSteps
        };
    }

    private waitForData(recipeId: string, executionId: string): Promise<void> {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds timeout
            
            const checkData = () => {
                attempts++;
                const recipe = recipeState.getCurrentRecipe();
                const timeSeries = recipeState.getTimeSeriesData();
                
                const recipeLoaded = recipe && recipe.id === recipeId;
                const timeSeriesLoaded = timeSeries && timeSeries.executionId === executionId;
                
                if (recipeLoaded && timeSeriesLoaded) {
                    console.log('[PrintReport] Data loaded successfully');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.warn('[PrintReport] Timeout waiting for data. Proceeding with available data.');
                    resolve();
                } else {
                    setTimeout(checkData, 100);
                }
            };
            
            checkData();
        });
    }

    private renderPrintDocument(data: PrintData): void {
        if (!this.printWindow || this.printWindow.closed) {
            console.error('[PrintReport] Print window is closed');
            return;
        }

        const doc = this.printWindow.document;
        doc.open();
        doc.write(this.generateHTML(data));
        doc.close();
        
        // Wait for content to be fully rendered, then draw charts and trigger print
        this.printWindow.addEventListener('load', () => {
            this.drawAllCharts(data);
            // Trigger print dialog automatically
            setTimeout(() => {
                if (this.printWindow && !this.printWindow.closed) {
                    this.printWindow.print();
                }
            }, 500);
        });
    }

    private generateHTML(data: PrintData): string {
        const cssLink = new URL('../../../style/print-report.css', import.meta.url).href;
        
        return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report - ${data.execution.recipeName}</title>
    <link rel="stylesheet" href="${cssLink}">
</head>
<body>
    ${this.generateContent(data)}
    <div class="footer">
        <p>Erstellt am: ${new Date().toLocaleString('de-DE')}</p>
    </div>
</body>
</html>
        `;
    }

    private generateContent(data: PrintData): string {
        const { execution, recipe } = data;
        const statusIcon = execution.status === 'completed' ? '✓' : execution.status === 'error' ? '✗' : '●';
        
        return `
    <div class="container">
        <h1>Ausführungsbericht</h1>
        <h2>${this.escapeHtml(execution.recipeName)}</h2>
        
        <h3>Ausführungsinformationen</h3>
        <div class="info-list">
            <div><strong>Execution-ID:</strong> ${this.escapeHtml(execution.executionId)}</div>
            <div><strong>Recipe-ID:</strong> ${this.escapeHtml(execution.recipeId)}</div>
            <div><strong>Status:</strong> ${statusIcon} ${this.escapeHtml(execution.status)}</div>
            <div><strong>Startzeit:</strong> ${this.formatTimestamp(execution.startTime)}</div>
            <div><strong>Endzeit:</strong> ${this.formatTimestamp(execution.endTime)}</div>
            <div><strong>Dauer:</strong> ${this.formatDuration(execution.duration)}</div>
            ${execution.errorMessage && execution.errorMessage.trim() !== '' ? 
                `<div><strong>Fehler:</strong> ${this.escapeHtml(execution.errorMessage)}</div>` : ''}
        </div>
        
        ${this.generateRecipeDetails(data)}
        ${this.generateSensorData(data)}
    </div>
        `;
    }

    private generateRecipeDetails(data: PrintData): string {
        const { recipe, execution, availableSteps } = data;
        
        if (!recipe) {
            return '<h3>Rezeptdetails</h3><p>Keine Rezeptinformationen verfügbar</p>';
        }
        
        return `
        <h3>Rezeptdetails</h3>
        <div class="info-list">
            <div><strong>Name:</strong> ${this.escapeHtml(recipe.name)}</div>
            <div><strong>Beschreibung:</strong> ${this.escapeHtml(recipe.description || '-')}</div>
            <div><strong>Version:</strong> ${this.escapeHtml(recipe.version || '1.0')}</div>
            <div><strong>Autor:</strong> ${this.escapeHtml(recipe.author || '-')}</div>
            <div><strong>Anzahl Schritte:</strong> ${recipe.steps.length}</div>
        </div>
        
        ${this.generateGlobalParameters(execution)}
        
        <h4>Schritte</h4>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Step Type</th>
                    <th>Step Name</th>
                    <th>Parameter</th>
                </tr>
            </thead>
            <tbody>
                ${recipe.steps.map((step, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${this.escapeHtml(step.stepTypeId)}</td>
                    <td>${this.escapeHtml(this.getStepDisplayName(step.stepTypeId, availableSteps))}</td>
                    <td>${this.formatStepParameters(step.parameters, execution.globalParameters)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        `;
    }

    private generateGlobalParameters(execution: RecipeExecutionDto): string {
        if (!execution.globalParameters || Object.keys(execution.globalParameters).length === 0) {
            return '';
        }
        
        return `
        <h4>Recipe-Wide Parameters</h4>
        <div class="info-list">
            ${Object.entries(execution.globalParameters).map(([key, val]) => 
                `<div><strong>${this.escapeHtml(key)}:</strong> ${this.escapeHtml(String(val))}</div>`
            ).join('')}
        </div>
        `;
    }

    private formatStepParameters(parameters: Record<string, string>, globalParameters?: Record<string, string>): string {
        if (!parameters || Object.keys(parameters).length === 0) {
            return '-';
        }
        
        // Override step parameters with execution's globalParameters if they have the same name
        const effectiveParams = { ...parameters };
        if (globalParameters) {
            for (const key in effectiveParams) {
                if (globalParameters.hasOwnProperty(key)) {
                    effectiveParams[key] = globalParameters[key];
                }
            }
        }
        
        return Object.entries(effectiveParams).map(([key, val]) => 
            `${this.escapeHtml(key)}: ${this.escapeHtml(String(val))}`
        ).join(', ');
    }

    private getStepDisplayName(stepTypeId: string, availableSteps: StepMetadataDto[]): string {
        const stepMeta = availableSteps.find(s => s.typeId === stepTypeId);
        return stepMeta?.displayName || stepTypeId;
    }

    private generateSensorData(data: PrintData): string {
        const { timeSeries } = data;
        
        if (!timeSeries || !timeSeries.series || timeSeries.series.length === 0) {
            return '<h3>Sensordaten</h3><p>Keine Sensordaten verfügbar</p>';
        }
        
        return `
        <h3>Sensordaten</h3>
        ${timeSeries.series.map((sensor, index) => `
        <div class="sensor-section">
            <h4>${this.escapeHtml(sensor.sensorName)}${sensor.unit ? ` (${this.escapeHtml(sensor.unit)})` : ''}</h4>
            <canvas id="chart-${index}" width="700" height="300"></canvas>
            ${this.generateSensorStats(sensor)}
        </div>
        `).join('')}
        `;
    }

    private generateSensorStats(sensor: SensorTimeSeriesDto): string {
        if (sensor.dataPoints.length === 0) {
            return '<p>Keine Datenpunkte</p>';
        }
        
        const values = sensor.dataPoints.map(p => p.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        
        return `
        <div class="stats">
            <div><strong>Min:</strong> ${min.toFixed(2)}</div>
            <div><strong>Max:</strong> ${max.toFixed(2)}</div>
            <div><strong>Durchschnitt:</strong> ${avg.toFixed(2)}</div>
            <div><strong>Datenpunkte:</strong> ${values.length}</div>
        </div>
        `;
    }

    private drawAllCharts(data: PrintData): void {
        if (!this.printWindow || this.printWindow.closed) return;
        if (!data.timeSeries || !data.timeSeries.series) return;
        
        data.timeSeries.series.forEach((sensor, index) => {
            const canvas = this.printWindow!.document.getElementById(`chart-${index}`) as HTMLCanvasElement;
            if (canvas) {
                this.drawChart(canvas, sensor);
            }
        });
        
        console.log('[PrintReport] All charts rendered');
    }

    private drawChart(canvas: HTMLCanvasElement, sensor: SensorTimeSeriesDto): void {
        const ctx = canvas.getContext('2d');
        if (!ctx || sensor.dataPoints.length === 0) return;
        
        const width = canvas.width;
        const height = canvas.height;
        const padding = 80;
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
        
        // Horizontal grid lines
        for (let i = 0; i <= 10; i++) {
            const y = padding + (chartHeight / 10) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }
        
        // Vertical grid lines
        for (let i = 0; i <= 10; i++) {
            const x = padding + (chartWidth / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, height - padding);
            ctx.stroke();
        }
        
        // Y-Axis labels
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i <= 10; i++) {
            const value = minValue + (valueRange / 10) * (10 - i);
            const y = padding + (chartHeight / 10) * i;
            ctx.fillText(value.toFixed(2), padding - 10, y);
        }
        
        // X-Axis labels (time duration)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        for (let i = 0; i <= 10; i++) {
            const timeMs = (timeRange / 10) * i;
            const x = padding + (chartWidth / 10) * i;
            
            const seconds = Math.floor(timeMs / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            
            let timeLabel: string;
            if (hours > 0) {
                timeLabel = `${hours}:${String(minutes % 60).padStart(2, '0')}`;
            } else if (minutes > 0) {
                timeLabel = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
            } else {
                timeLabel = `${seconds}s`;
            }
            
            ctx.fillText(timeLabel, x, height - padding + 10);
        }
        
        // Y-Axis label
        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = '14px Arial';
        ctx.fillText(sensor.unit || 'Wert', 0, 0);
        ctx.restore();
        
        // X-Axis label
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Zeit', width / 2, height - 30);
        
        // Draw data line
        ctx.strokeStyle = '#000';
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
        ctx.fillStyle = '#000';
        sensor.dataPoints.forEach(point => {
            const x = padding + ((point.timestamp - minTime) / timeRange) * chartWidth;
            const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    private formatTimestamp(ts: number): string {
        const date = new Date(ts);
        return date.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    private getStatusColor(status: string): string {
        switch (status.toLowerCase()) {
            case 'completed': return '#4CAF50';
            case 'running': return '#2196F3';
            case 'failed': return '#f44336';
            case 'error': return '#f44336';
            case 'aborted': return '#FF9800';
            default: return '#9E9E9E';
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

import { recipeState } from '../state';
import type { ViewHandle } from './LiveViewRenderer';

export class AnalyticsRenderer implements ViewHandle {
    private container: HTMLElement;
    private unsubscribe: (() => void) | null = null;
    private sendCommandFn: ((cmd: any) => void) | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.classList.add('recipe-mgmt-analytics');
        
        // Subscribe to state changes
        this.unsubscribe = recipeState.subscribe(() => this.render());
    }

    setSendFunction(sendFn: (cmd: any) => void): void {
        this.sendCommandFn = sendFn;
    }

    setContainer(container: HTMLElement): void {
        this.container = container;
        this.container.classList.add('recipe-mgmt-analytics');
    }

    render(): void {
        this.container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 2rem; color: #333;">
                Analytics coming soon
            </div>
        `;
    }


    private handleAction(action: string): void {
        if (action === 'refresh') {
            // Request metrics update
            if (this.sendCommandFn) {
                // TODO: Implement metrics request command
                console.log('Metrics refresh requested');
            }
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

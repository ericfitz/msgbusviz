import { type NormalizedConfig, type RawConfigOutput } from '@msgbusviz/core';
import type { Scene } from 'three';
import { EdgeManager } from './edges/edgeManager.js';
import { MessageAnimator } from './messages/messageAnimator.js';
export interface ViewerOptions {
    container: HTMLElement;
    config: NormalizedConfig | RawConfigOutput | string;
    baseUrl?: string;
    edit?: boolean;
    ws?: {
        url: string;
    };
    onSave?: (config: NormalizedConfig) => void;
}
export declare class Viewer {
    private opts;
    private sceneRoot;
    private orbit;
    private loop;
    private nodes;
    private edges;
    private animator;
    private ws;
    private current;
    private graph;
    private positions;
    private labelsVisible;
    private readyPromise;
    constructor(opts: ViewerOptions);
    ready(): Promise<void>;
    toggleLabels(): void;
    fitToGraph(): void;
    resetView(): void;
    dispose(): void;
    __internals(): {
        scene: Scene;
        edges: EdgeManager;
        animator: MessageAnimator;
    };
    private boot;
    private resolveConfig;
    private normalizeFromUnknown;
}
//# sourceMappingURL=viewer.d.ts.map
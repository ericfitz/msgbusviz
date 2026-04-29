import * as THREE from 'three';
import type { MessageSentMessage } from '@msgbusviz/protocol';
import type { NormalizedConfig } from '@msgbusviz/core';
import type { EdgeManager } from '../edges/edgeManager.js';
export declare class MessageAnimator {
    private edges;
    private baseUrl;
    private root;
    private active;
    private pool;
    constructor(edges: EdgeManager, baseUrl: string);
    attach(scene: THREE.Scene): void;
    detach(scene: THREE.Scene): void;
    spawn(msg: MessageSentMessage, config: NormalizedConfig): Promise<void>;
    tick(_deltaSeconds: number, nowMs: number, config: NormalizedConfig): void;
    activeCount(): number;
    private retire;
}
//# sourceMappingURL=messageAnimator.d.ts.map
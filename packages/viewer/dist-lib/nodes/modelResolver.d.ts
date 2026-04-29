import * as THREE from 'three';
import { type MessagePrimitive } from '@msgbusviz/core';
export declare function resolveNodeModel(model: string, color: string, baseUrl: string): Promise<THREE.Object3D>;
export declare function resolveMessageModel(model: string, color: string, baseUrl: string): Promise<THREE.Object3D>;
export declare function resolveMessageModelSync(model: string, color: string): THREE.Object3D | null;
export declare function createMessagePrimitive(name: MessagePrimitive, color: string): THREE.Object3D;
export declare function clearModelCache(): void;
//# sourceMappingURL=modelResolver.d.ts.map
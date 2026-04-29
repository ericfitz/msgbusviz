export type FrameCallback = (deltaSeconds: number, nowMs: number) => void;
export interface AnimationLoop {
    add(fn: FrameCallback): void;
    remove(fn: FrameCallback): void;
    stop(): void;
}
export declare function startAnimationLoop(): AnimationLoop;
//# sourceMappingURL=loop.d.ts.map
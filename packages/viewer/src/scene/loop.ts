export type FrameCallback = (deltaSeconds: number, nowMs: number) => void;

export interface AnimationLoop {
  add(fn: FrameCallback): void;
  remove(fn: FrameCallback): void;
  stop(): void;
}

export function startAnimationLoop(): AnimationLoop {
  const callbacks = new Set<FrameCallback>();
  let stopped = false;
  let last = performance.now();

  function tick(now: number): void {
    if (stopped) return;
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const cb of callbacks) cb(delta, now);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    add: (fn) => { callbacks.add(fn); },
    remove: (fn) => { callbacks.delete(fn); },
    stop: () => { stopped = true; callbacks.clear(); },
  };
}

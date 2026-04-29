export function startAnimationLoop() {
    const callbacks = new Set();
    let stopped = false;
    let last = performance.now();
    function tick(now) {
        if (stopped)
            return;
        const delta = Math.min(0.1, (now - last) / 1000);
        last = now;
        for (const cb of callbacks)
            cb(delta, now);
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {
        add: (fn) => { callbacks.add(fn); },
        remove: (fn) => { callbacks.delete(fn); },
        stop: () => { stopped = true; callbacks.clear(); },
    };
}
//# sourceMappingURL=loop.js.map
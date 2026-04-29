export class ObjectPool {
    pools = new Map();
    acquire(key, factory) {
        const list = this.pools.get(key);
        if (list && list.length > 0) {
            const obj = list.pop();
            obj.visible = true;
            return obj;
        }
        return factory();
    }
    release(key, obj) {
        obj.visible = false;
        const list = this.pools.get(key) ?? [];
        list.push(obj);
        this.pools.set(key, list);
    }
    clear() { this.pools.clear(); }
}
//# sourceMappingURL=pool.js.map
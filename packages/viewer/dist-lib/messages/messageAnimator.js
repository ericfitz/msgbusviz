import * as THREE from 'three';
import { ObjectPool } from './pool.js';
import { resolveMessageModelSync } from '../nodes/modelResolver.js';
import { createLabelSprite } from '../nodes/label.js';
import { easeInOutQuad, jitterRgb, jitterVec, wanderOffset } from './math.js';
export class MessageAnimator {
    edges;
    baseUrl;
    root = new THREE.Group();
    active = new Map();
    pool = new ObjectPool();
    constructor(edges, baseUrl) {
        this.edges = edges;
        this.baseUrl = baseUrl;
    }
    attach(scene) { scene.add(this.root); }
    detach(scene) { scene.remove(this.root); }
    async spawn(msg, config) {
        const channel = config.channels[msg.channel];
        if (!channel)
            return;
        const poolKey = `${msg.channel}::${channel.messageModel}`;
        const baseColor = jitterRgb(msg.color, 16);
        const mesh = this.pool.acquire(poolKey, () => {
            const m = resolveMessageModelSync(channel.messageModel, baseColor);
            if (!m)
                throw new Error(`messageModel "${channel.messageModel}" must be a primitive in v1`);
            return m;
        });
        applyColor(mesh, baseColor);
        mesh.scale.setScalar(channel.size);
        const curve = this.edges.getCurve(msg.channel, msg.from, msg.to);
        if (!curve) {
            this.pool.release(poolKey, mesh);
            return;
        }
        const start = curve.getPoint(0);
        const j = jitterVec(0.1);
        mesh.position.set(start.x + j[0], start.y + j[1], start.z + j[2]);
        this.root.add(mesh);
        let label;
        if (msg.label) {
            label = createLabelSprite(msg.label);
            label.position.copy(mesh.position).add(new THREE.Vector3(0, 0.5, 0));
            this.root.add(label);
        }
        this.active.set(msg.id, {
            id: msg.id,
            channel: msg.channel,
            publisher: msg.from,
            subscriber: msg.to,
            startMs: msg.spawnedAt,
            durationMs: channel.speed,
            mesh,
            poolKey,
            ...(label ? { label } : {}),
        });
    }
    tick(_deltaSeconds, nowMs, config) {
        for (const am of [...this.active.values()]) {
            const elapsed = nowMs - am.startMs;
            const t = Math.max(0, Math.min(1, elapsed / am.durationMs));
            const eased = easeInOutQuad(t);
            const curve = this.edges.getCurve(am.channel, am.publisher, am.subscriber);
            if (!curve) {
                this.retire(am);
                continue;
            }
            const p = curve.getPoint(eased);
            const w = wanderOffset(t, config.channels[am.channel]?.size ?? 0.3);
            am.mesh.position.set(p.x + w[0], p.y + w[1], p.z + w[2]);
            if (am.label)
                am.label.position.copy(am.mesh.position).add(new THREE.Vector3(0, 0.5, 0));
            if (t >= 1)
                this.retire(am);
        }
    }
    activeCount() { return this.active.size; }
    retire(am) {
        this.root.remove(am.mesh);
        this.pool.release(am.poolKey, am.mesh);
        if (am.label) {
            this.root.remove(am.label);
        }
        this.active.delete(am.id);
    }
}
function applyColor(obj, color) {
    obj.traverse((child) => {
        const mesh = child;
        if (mesh.isMesh && mesh.material) {
            const mat = mesh.material;
            if (mat.color)
                mat.color.set(color);
        }
    });
}
//# sourceMappingURL=messageAnimator.js.map
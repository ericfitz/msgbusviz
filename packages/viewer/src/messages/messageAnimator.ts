import * as THREE from 'three';
import type { MessageSentMessage } from '@msgbusviz/protocol';
import type { NormalizedConfig } from '@msgbusviz/core';
import type { EdgeManager } from '../edges/edgeManager.js';
import { ObjectPool } from './pool.js';
import { resolveMessageModelSync } from '../nodes/modelResolver.js';
import { createLabelSprite } from '../nodes/label.js';
import { easeInOutQuad, jitterRgb } from './math.js';

interface ActiveMessage {
  id: string;
  channel: string;
  publisher: string;
  subscriber: string;
  startMs: number;
  durationMs: number;
  mesh: THREE.Object3D;
  poolKey: string;
  label?: THREE.Sprite;
}

export class MessageAnimator {
  private root = new THREE.Group();
  private active = new Map<string, ActiveMessage>();
  private pool = new ObjectPool();
  private labelsVisible = true;

  constructor(private edges: EdgeManager, private baseUrl: string) {}

  attach(scene: THREE.Scene): void { scene.add(this.root); }
  detach(scene: THREE.Scene): void { scene.remove(this.root); }

  setLabelsVisible(v: boolean): void {
    this.labelsVisible = v;
    for (const am of this.active.values()) {
      if (am.label) am.label.visible = v;
    }
  }

  async spawn(msg: MessageSentMessage, config: NormalizedConfig): Promise<void> {
    const channel = config.channels[msg.channel];
    if (!channel) return;

    const poolKey = `${msg.channel}::${channel.messageModel}`;
    const baseColor = jitterRgb(msg.color, 0);
    const mesh = this.pool.acquire(
      poolKey,
      () => {
        const m = resolveMessageModelSync(channel.messageModel, baseColor);
        if (!m) throw new Error(`messageModel "${channel.messageModel}" must be a primitive in v1`);
        return m;
      },
    );
    applyColor(mesh, baseColor);
    mesh.scale.setScalar(channel.size);

    const curve = this.edges.getCurve(msg.channel, msg.from, msg.to);
    if (!curve) { this.pool.release(poolKey, mesh); return; }

    const start = curve.getPoint(0);
    mesh.position.set(start.x, start.y, start.z);
    this.root.add(mesh);

    let label: THREE.Sprite | undefined;
    if (msg.label) {
      label = createLabelSprite(msg.label);
      label.position.set(start.x, start.y + 0.5, start.z);
      label.visible = this.labelsVisible;
      this.root.add(label);
    }

    this.active.set(msg.id, {
      id: msg.id,
      channel: msg.channel,
      publisher: msg.from,
      subscriber: msg.to,
      startMs: performance.now(),
      durationMs: channel.speed,
      mesh,
      poolKey,
      ...(label ? { label } : {}),
    });
  }

  tick(_deltaSeconds: number, nowMs: number, config: NormalizedConfig): void {
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
      const speedShape = 4 * t * (1 - t);
      const size = Math.max(0.1, config.channels[am.channel]?.size ?? 1);
      const wanderMag = 0 * speedShape / size;
      const wx = (Math.random() - 0.5) * 2 * wanderMag;
      const wy = (Math.random() - 0.5) * 2 * wanderMag;
      const wz = (Math.random() - 0.5) * 2 * wanderMag;
      am.mesh.position.set(p.x + wx, p.y + wy, p.z + wz);
      if (am.label) am.label.position.set(p.x, p.y + 0.5, p.z);
      if (t >= 1) this.retire(am);
    }
  }

  activeCount(): number { return this.active.size; }

  private retire(am: ActiveMessage): void {
    this.root.remove(am.mesh);
    this.pool.release(am.poolKey, am.mesh);
    if (am.label) { this.root.remove(am.label); }
    this.active.delete(am.id);
  }
}

function applyColor(obj: THREE.Object3D, color: string): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if ((mesh as { isMesh?: boolean }).isMesh && mesh.material) {
      const mat = mesh.material as THREE.MeshLambertMaterial;
      if (mat.color) mat.color.set(color);
    }
  });
}

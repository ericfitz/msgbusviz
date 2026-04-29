import * as THREE from 'three';
import type { NormalizedConfig, NormalizedNode, Vec3 } from '@msgbusviz/core';
import { resolveNodeModel } from './modelResolver.js';
import { createLabelSprite } from './label.js';

export interface NodeView {
  key: string;
  group: THREE.Group;
  labelSprite: THREE.Sprite;
}

export class NodeManager {
  private root = new THREE.Group();
  private views = new Map<string, NodeView>();
  private labelsVisible = true;

  constructor(private baseUrl: string) {}

  attach(scene: THREE.Scene): void { scene.add(this.root); }
  detach(scene: THREE.Scene): void { scene.remove(this.root); }
  getNodeGroup(key: string): THREE.Group | undefined { return this.views.get(key)?.group; }
  toggleLabels(): void {
    this.labelsVisible = !this.labelsVisible;
    for (const v of this.views.values()) v.labelSprite.visible = this.labelsVisible;
  }
  setLabelsVisible(v: boolean): void {
    this.labelsVisible = v;
    for (const view of this.views.values()) view.labelSprite.visible = v;
  }

  async sync(config: NormalizedConfig, positions: Map<string, Vec3>): Promise<void> {
    for (const key of [...this.views.keys()]) {
      if (!config.nodes[key]) {
        const v = this.views.get(key)!;
        this.root.remove(v.group);
        this.views.delete(key);
      }
    }

    for (const [key, node] of Object.entries(config.nodes)) {
      const pos = positions.get(key) ?? [0, 0, 0];
      const existing = this.views.get(key);
      if (existing) {
        existing.group.position.set(pos[0], pos[1], pos[2]);
        existing.group.scale.setScalar(node.scale);
        continue;
      }
      const view = await this.createView(key, node, pos);
      this.views.set(key, view);
      this.root.add(view.group);
    }
  }

  updateWorldMatrices(): void {
    this.root.updateMatrixWorld(true);
  }

  computeBoundingBox(): THREE.Box3 {
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    const tmpVec = new THREE.Vector3();
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      mesh.geometry.computeBoundingBox?.();
      const local = mesh.geometry.boundingBox;
      if (!local) return;
      tmp.copy(local).applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(tmp.min);
      box.expandByPoint(tmp.max);
      void tmpVec;
    });
    return box;
  }

  private async createView(key: string, node: NormalizedNode, pos: Vec3): Promise<NodeView> {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);
    group.scale.setScalar(node.scale);

    const model = await resolveNodeModel(node.model, node.color, this.baseUrl);
    group.add(model);

    const sprite = createLabelSprite(node.label);
    sprite.position.set(0, 1.2, 0);
    sprite.visible = this.labelsVisible;
    group.add(sprite);

    return { key, group, labelSprite: sprite };
  }
}

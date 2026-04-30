import * as THREE from 'three';
import type { NormalizedConfig, NormalizedNode, Vec3 } from '@msgbusviz/core';
import { resolveNodeModel } from './modelResolver.js';
import { createLabelSprite } from './label.js';

const HIGHLIGHT_EMISSIVE_HEX = 0x444444;

export interface NodeView {
  key: string;
  group: THREE.Group;
  labelSprite: THREE.Sprite;
}

export class NodeManager {
  private root = new THREE.Group();
  private views = new Map<string, NodeView>();
  private labelsVisible = true;
  private highlightSaves = new Map<string, Map<THREE.Material, number>>();

  constructor(private baseUrl: string) {}

  attach(scene: THREE.Scene): void { scene.add(this.root); }
  detach(scene: THREE.Scene): void { scene.remove(this.root); }
  getRoot(): THREE.Group { return this.root; }
  getNodeGroup(key: string): THREE.Group | undefined { return this.views.get(key)?.group; }

  /** @internal Drag-support primitive; intended for DragController. */
  applyPosition(key: string, p: Vec3): void {
    const view = this.views.get(key);
    if (!view) return;
    view.group.position.set(p[0], p[1], p[2]);
  }

  /** @internal Drag-support primitive; intended for DragController. */
  setHighlighted(key: string, on: boolean): void {
    const view = this.views.get(key);
    if (!view) return;

    if (on) {
      const saves = new Map<THREE.Material, number>();
      view.group.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!(m as { isMesh?: boolean }).isMesh || !m.material) return;
        const mat = m.material as THREE.MeshLambertMaterial;
        if (!mat.emissive) return;
        saves.set(mat, mat.emissive.getHex());
        mat.emissive.setHex(HIGHLIGHT_EMISSIVE_HEX);
      });
      this.highlightSaves.set(key, saves);
    } else {
      const saves = this.highlightSaves.get(key);
      if (!saves) return;
      for (const [mat, hex] of saves) {
        const m = mat as THREE.MeshLambertMaterial;
        if (m.emissive) m.emissive.setHex(hex);
      }
      this.highlightSaves.delete(key);
    }
  }
  /** @internal Color-edit primitive; intended for ColorEditor. */
  applyColor(key: string, hex: string): void {
    const view = this.views.get(key);
    if (!view) return;
    view.group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!(m as { isMesh?: boolean }).isMesh || !m.material) return;
      const mat = m.material as THREE.MeshLambertMaterial;
      if (!mat.color) return;
      mat.color.set(hex);
    });
  }

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
      view.group.userData.nodeName = key;
      this.views.set(key, view);
      this.root.add(view.group);
    }
  }

  updateWorldMatrices(): void {
    this.root.updateMatrixWorld(true);
  }

  computeBoundingBox(): THREE.Box3 {
    return this.computeNodeBox();
  }

  computeNodeBox(): THREE.Box3 {
    const box = new THREE.Box3();
    for (const view of this.views.values()) {
      const p = view.group.position;
      const halfX = 0.6 * view.group.scale.x;
      const halfY = 0.6 * view.group.scale.y;
      const halfZ = 0.6 * view.group.scale.z;
      box.expandByPoint(new THREE.Vector3(p.x - halfX, p.y - halfY, p.z - halfZ));
      box.expandByPoint(new THREE.Vector3(p.x + halfX, p.y + halfY, p.z + halfZ));
    }
    return box;
  }

  computeFitBox(): THREE.Box3 {
    const box = new THREE.Box3();
    const labelPad = 1.4;
    for (const view of this.views.values()) {
      const p = view.group.position;
      const halfX = 0.6 * view.group.scale.x;
      const halfY = 0.6 * view.group.scale.y;
      const halfZ = 0.6 * view.group.scale.z;
      box.expandByPoint(new THREE.Vector3(p.x - halfX, p.y - halfY, p.z - halfZ));
      box.expandByPoint(new THREE.Vector3(p.x + halfX, p.y + halfY + labelPad, p.z + halfZ));
    }
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

import * as THREE from 'three';
import { resolveNodeName } from './dragNodes.js';

export interface ColorEditorCallbacks {
  onPreview: (name: string, hex: string) => void;
  onCommit: (name: string, hex: string) => void;
  getCurrentHex: (name: string) => string;
  isDragging?: () => boolean;
}

type HitResult =
  | { kind: 'node'; name: string }
  | { kind: 'background' }
  | { kind: 'none' };

export class ColorEditor {
  private enabled = false;
  private menuEl: HTMLDivElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private selectedNodeName: string | null = null;
  private originalHex = '#888888';
  private windowPointerDownHandler: ((ev: PointerEvent) => void) | null = null;
  private windowKeydownHandler: ((ev: KeyboardEvent) => void) | null = null;

  constructor(
    private camera: THREE.Camera,
    private domElement: HTMLElement,
    private nodeRoot: THREE.Object3D,
    private callbacks: ColorEditorCallbacks,
  ) {
    this.onContextMenu = this.onContextMenu.bind(this);
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) {
      this.domElement.addEventListener('contextmenu', this.onContextMenu);
    } else {
      this.domElement.removeEventListener('contextmenu', this.onContextMenu);
      this.dismissMenu();
    }
  }

  dispose(): void {
    this.setEnabled(false);
    if (this.inputEl?.parentElement) this.inputEl.parentElement.removeChild(this.inputEl);
    this.inputEl = null;
  }

  private toNdc(ev: MouseEvent): THREE.Vector2 {
    const rect = this.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    return new THREE.Vector2(x, y);
  }

  private hitTest(ev: MouseEvent): HitResult {
    const ndc = this.toNdc(ev);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObject(this.nodeRoot, true);
    for (const h of hits) {
      const name = resolveNodeName(h.object);
      if (name) return { kind: 'node', name };
    }
    return { kind: 'none' };
  }

  private onContextMenu(ev: Event): void {
    const me = ev as MouseEvent;
    if (this.callbacks.isDragging?.()) return;
    const hit = this.hitTest(me);
    if (hit.kind !== 'node') {
      // v1: off-node right-click falls through to browser default.
      // Future: open background-color menu here.
      return;
    }
    me.preventDefault();
    this.dismissMenu();  // close any prior menu before opening a new one
    this.openMenuForNode(hit.name, me.clientX, me.clientY);
  }

  private openMenuForNode(name: string, clientX: number, clientY: number): void {
    const parent = this.domElement.parentElement;
    if (!parent) return;
    const menu = document.createElement('div');
    menu.className = 'ce-menu';
    const item = document.createElement('button');
    item.className = 'ce-menu-item';
    item.dataset.action = 'change-color';
    item.textContent = 'Change color…';
    item.addEventListener('click', () => this.onChangeColorItemClick(name));
    menu.appendChild(item);

    const rect = parent.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 36;
    const x = Math.min(clientX - rect.left, rect.width - menuWidth);
    const y = Math.min(clientY - rect.top, rect.height - menuHeight);
    menu.style.left = `${Math.max(0, x)}px`;
    menu.style.top = `${Math.max(0, y)}px`;
    parent.appendChild(menu);
    this.menuEl = menu;

    // Outside-click dismissal (capture-phase so we can stopPropagation before drag/orbit).
    this.windowPointerDownHandler = (pdev: PointerEvent) => {
      if (this.menuEl && !this.menuEl.contains(pdev.target as Node)) {
        pdev.stopPropagation();
        this.dismissMenu();
      }
    };
    window.addEventListener('pointerdown', this.windowPointerDownHandler, { capture: true });

    // Esc to dismiss.
    this.windowKeydownHandler = (kev: KeyboardEvent) => {
      if (kev.key === 'Escape') this.dismissMenu();
    };
    window.addEventListener('keydown', this.windowKeydownHandler);
  }

  private onChangeColorItemClick(_name: string): void {
    // Filled in by Task 9.
  }

  private dismissMenu(): void {
    if (this.menuEl?.parentElement) this.menuEl.parentElement.removeChild(this.menuEl);
    this.menuEl = null;
    if (this.windowPointerDownHandler) {
      window.removeEventListener('pointerdown', this.windowPointerDownHandler, { capture: true });
      this.windowPointerDownHandler = null;
    }
    if (this.windowKeydownHandler) {
      window.removeEventListener('keydown', this.windowKeydownHandler);
      this.windowKeydownHandler = null;
    }
  }
}

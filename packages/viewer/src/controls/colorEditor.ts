import * as THREE from 'three';
import type { HexColor } from '@msgbusviz/core';
import { resolveNodeName } from './dragNodes.js';

export interface ColorEditorCallbacks {
  onPreview: (name: string, hex: HexColor) => void;
  onCommit: (name: string, hex: HexColor) => void;
  getCurrentHex: (name: string) => HexColor;
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
  private originalHex: HexColor = '#888888';
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

  private ensureInputEl(): HTMLInputElement {
    if (this.inputEl) return this.inputEl;
    const input = document.createElement('input');
    input.type = 'color';
    input.id = 'ce-color-input';
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    // <input type="color">.value is always '#rrggbb' per the HTML spec, so the
    // cast to HexColor at the DOM boundary is sound.
    input.addEventListener('input', (e) => {
      if (!this.selectedNodeName) return;
      const v = (e.target as HTMLInputElement).value as HexColor;
      this.callbacks.onPreview(this.selectedNodeName, v);
    });
    input.addEventListener('change', (e) => {
      if (!this.selectedNodeName) return;
      const v = (e.target as HTMLInputElement).value as HexColor;
      const name = this.selectedNodeName;
      // Clear before the diff check so a stray re-fire is a guarded no-op.
      // Linux/Windows native Cancel does not fire `change` at all (v1 quirk:
      // live preview persists until reload).
      this.selectedNodeName = null;
      if (v !== this.originalHex) {
        this.callbacks.onCommit(name, v);
      }
    });
    const parent = this.domElement.parentElement ?? document.body;
    parent.appendChild(input);
    this.inputEl = input;
    return input;
  }

  private onChangeColorItemClick(name: string): void {
    this.selectedNodeName = name;
    this.originalHex = this.callbacks.getCurrentHex(name);
    const input = this.ensureInputEl();
    input.value = this.originalHex;
    this.dismissMenu();  // close menu BEFORE opening picker so it isn't visible during picker session
    input.click();
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

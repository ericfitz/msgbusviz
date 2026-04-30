import type * as THREE from 'three';
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

  private onContextMenu(_ev: Event): void {
    // Filled in by Task 6.
  }

  private hitTest(_ev: MouseEvent): HitResult {
    // Filled in by Task 6.
    void resolveNodeName(this.nodeRoot);
    return { kind: 'none' };
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

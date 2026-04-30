// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'; // beforeEach/afterEach used in Task 8
import * as THREE from 'three';
import { ColorEditor } from './colorEditor.js';

function makeFakeEl(): {
  el: HTMLElement;
  added: Array<{ type: string; fn: EventListenerOrEventListenerObject }>;
  removed: Array<{ type: string; fn: EventListenerOrEventListenerObject }>;
} {
  const added: Array<{ type: string; fn: EventListenerOrEventListenerObject }> = [];
  const removed: Array<{ type: string; fn: EventListenerOrEventListenerObject }> = [];
  const el = {
    addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => { added.push({ type, fn }); },
    removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => { removed.push({ type, fn }); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect),
    parentElement: document.createElement('div'),
    style: { cursor: '' } as CSSStyleDeclaration,
  } as unknown as HTMLElement;
  return { el, added, removed };
}

describe('ColorEditor setEnabled', () => {
  it('attaches and removes the contextmenu listener symmetrically', () => {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    cam.position.set(0, 0, 10);
    const root = new THREE.Group();
    const { el, added, removed } = makeFakeEl();

    const ce = new ColorEditor(cam, el, root, {
      onPreview: () => {},
      onCommit: () => {},
      getCurrentHex: () => '#888888',
    });

    ce.setEnabled(false);
    expect(added.length).toBe(0);

    ce.setEnabled(true);
    const cmAdds = added.filter((a) => a.type === 'contextmenu');
    expect(cmAdds.length).toBe(1);

    // Idempotent re-enable
    ce.setEnabled(true);
    expect(added.filter((a) => a.type === 'contextmenu').length).toBe(1);

    ce.setEnabled(false);
    const cmRemoves = removed.filter((r) => r.type === 'contextmenu');
    expect(cmRemoves.length).toBe(1);
    expect(cmRemoves[0]!.fn).toBe(cmAdds[0]!.fn);
  });
});

function setupCeWithRealDom() {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const domElement = document.createElement('canvas');
  Object.defineProperty(domElement, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect),
  });
  parent.appendChild(domElement);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  const root = new THREE.Group();
  // A node group at origin with a hit mesh and userData.nodeName.
  const nodeGroup = new THREE.Group();
  nodeGroup.userData.nodeName = 'A';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshLambertMaterial({ color: '#abcdef' }));
  nodeGroup.add(mesh);
  root.add(nodeGroup);
  root.updateMatrixWorld(true);

  const callbacks = {
    onPreview: vi.fn(),
    onCommit: vi.fn(),
    getCurrentHex: vi.fn((_name: string) => '#abcdef'),
    isDragging: vi.fn(() => false),
  };
  const ce = new ColorEditor(cam, domElement, root, callbacks);
  ce.setEnabled(true);
  return { ce, domElement, parent, cam, root, callbacks };
}

function fireContextMenu(target: HTMLElement, clientX: number, clientY: number): MouseEvent {
  const ev = new MouseEvent('contextmenu', { clientX, clientY, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
}

describe('ColorEditor contextmenu', () => {
  it('on-node right-click opens the menu and preventDefaults the event', () => {
    const { domElement, parent } = setupCeWithRealDom();
    // NDC center (50,50 of a 100x100 element) → ray hits the node at origin.
    const ev = fireContextMenu(domElement, 50, 50);
    expect(ev.defaultPrevented).toBe(true);
    expect(parent.querySelector('.ce-menu')).not.toBeNull();
  });

  it('off-node right-click does NOT preventDefault and does NOT open the menu', () => {
    const { domElement, parent } = setupCeWithRealDom();
    // NDC corner (99,99) → ray misses the centered 2x2 box.
    const ev = fireContextMenu(domElement, 99, 99);
    expect(ev.defaultPrevented).toBe(false);
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });

  it('right-click while isDragging() is true does NOT open the menu', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    callbacks.isDragging.mockReturnValue(true);
    const ev = fireContextMenu(domElement, 50, 50);
    expect(ev.defaultPrevented).toBe(false);
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });
});

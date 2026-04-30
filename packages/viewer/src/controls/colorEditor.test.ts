import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import type { HexColor } from '@msgbusviz/core';
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
    getCurrentHex: vi.fn((_name: string): HexColor => '#abcdef'),
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

describe('ColorEditor color picker plumbing', () => {
  // Save and restore HTMLInputElement.prototype.click to avoid leaking the spy
  // into unrelated tests (some other suites might rely on the native no-op behavior).
  const origClick = HTMLInputElement.prototype.click;
  let clickSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    clickSpy = vi.fn();
    HTMLInputElement.prototype.click = clickSpy;
  });
  afterEach(() => {
    HTMLInputElement.prototype.click = origClick;
  });

  it('clicking "Change color…" sets input value to getCurrentHex and clicks the input', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    const item = parent.querySelector('.ce-menu-item') as HTMLButtonElement;
    expect(item).not.toBeNull();
    item.click();

    expect(callbacks.getCurrentHex).toHaveBeenCalledWith('A');
    const input = parent.querySelector('input[type="color"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('#abcdef');
    expect(clickSpy).toHaveBeenCalled();
    // Menu should be closed after item click.
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });

  it('input event on the color input fires onPreview only', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    (parent.querySelector('.ce-menu-item') as HTMLButtonElement).click();
    const input = parent.querySelector('input[type="color"]') as HTMLInputElement;
    input.value = '#123456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(callbacks.onPreview).toHaveBeenCalledWith('A', '#123456');
    expect(callbacks.onCommit).not.toHaveBeenCalled();
  });

  it('change event with same hex as initial does NOT fire onCommit', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    (parent.querySelector('.ce-menu-item') as HTMLButtonElement).click();
    const input = parent.querySelector('input[type="color"]') as HTMLInputElement;
    input.value = '#abcdef';  // same as getCurrentHex returned
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(callbacks.onCommit).not.toHaveBeenCalled();
  });

  it('change event with a different hex fires onCommit once', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    (parent.querySelector('.ce-menu-item') as HTMLButtonElement).click();
    const input = parent.querySelector('input[type="color"]') as HTMLInputElement;
    input.value = '#00ff00';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(callbacks.onCommit).toHaveBeenCalledTimes(1);
    expect(callbacks.onCommit).toHaveBeenCalledWith('A', '#00ff00');
  });

  it('a second invocation builds a fresh input element and clicks it', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    // First session: open menu, click item, complete a commit.
    fireContextMenu(domElement, 50, 50);
    (parent.querySelector('.ce-menu-item') as HTMLButtonElement).click();
    const firstInput = parent.querySelector('input[type="color"]') as HTMLInputElement;
    firstInput.value = '#ff0000';
    firstInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(callbacks.onCommit).toHaveBeenCalledTimes(1);

    clickSpy.mockClear();

    // Second session: open menu again, click item.
    fireContextMenu(domElement, 50, 50);
    (parent.querySelector('.ce-menu-item') as HTMLButtonElement).click();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // Exactly one input element exists (prior was removed before the new one was built).
    expect(parent.querySelectorAll('input[type="color"]').length).toBe(1);
    const secondInput = parent.querySelector('input[type="color"]') as HTMLInputElement;
    // It is a fresh element — not the same node as the first one.
    expect(secondInput).not.toBe(firstInput);
  });
});

describe('ColorEditor dismissal', () => {
  it('Esc dismisses an open menu', () => {
    const { domElement, parent } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    expect(parent.querySelector('.ce-menu')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });

  it('outside pointerdown dismisses an open menu', () => {
    const { domElement, parent } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    expect(parent.querySelector('.ce-menu')).not.toBeNull();
    // Simulate a pointerdown on the body (outside the menu).
    // jsdom v24 supports PointerEvent; fall back to MouseEvent if it doesn't.
    const PointerEventCtor: typeof PointerEvent | undefined =
      typeof PointerEvent !== 'undefined' ? PointerEvent : undefined;
    const pdev = PointerEventCtor
      ? new PointerEventCtor('pointerdown', { bubbles: true, cancelable: true })
      : new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(pdev);
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });

  it('a second contextmenu dismisses the prior menu before opening a new one', () => {
    const { domElement, parent } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    fireContextMenu(domElement, 50, 50);
    // Should still only have one menu element (prior dismissed, new one opened).
    expect(parent.querySelectorAll('.ce-menu').length).toBe(1);
  });

  it('setEnabled(false) removes the contextmenu listener and dismisses any open menu', () => {
    const { ce, domElement, parent } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    expect(parent.querySelector('.ce-menu')).not.toBeNull();
    ce.setEnabled(false);
    expect(parent.querySelector('.ce-menu')).toBeNull();
    // Subsequent contextmenu has no effect.
    const ev = fireContextMenu(domElement, 50, 50);
    expect(ev.defaultPrevented).toBe(false);
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });
});

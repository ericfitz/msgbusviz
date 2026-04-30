import { describe, it, expect } from 'vitest';
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

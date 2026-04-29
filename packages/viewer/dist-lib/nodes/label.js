import * as THREE from 'three';
export function createLabelSprite(text) {
    const padding = 8;
    const fontSize = 32;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width + padding * 2;
    const h = fontSize + padding * 2;
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(20,20,20,0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e0e0e0';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, padding, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const scale = 0.01;
    sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
    sprite.renderOrder = 999;
    return sprite;
}
//# sourceMappingURL=label.js.map
import * as THREE from 'three';
import { buildArcCurve } from './arc.js';
const PARTICLE_COUNT = 12;
const PARTICLE_STYLES = [
    { size: 0.06, color: 0xa0a0a0 },
    { size: 0.04, color: 0xc8c8c8 },
    { size: 0.08, color: 0x808080 },
];
export class EdgeManager {
    root = new THREE.Group();
    views = new Map();
    attach(scene) { scene.add(this.root); }
    detach(scene) { scene.remove(this.root); }
    getCurve(channelKey, publisher, subscriber) {
        return this.views.get(arcId(channelKey, publisher, subscriber))?.curve;
    }
    sync(config, arcs, positions) {
        for (const id of [...this.views.keys()]) {
            const found = arcs.some((a) => arcId(a.channelKey, a.publisher, a.subscriber) === id);
            if (!found) {
                const v = this.views.get(id);
                this.root.remove(v.line);
                this.root.remove(v.arrow);
                this.root.remove(v.particles);
                this.views.delete(id);
            }
        }
        let styleIndex = 0;
        for (const arc of arcs) {
            const id = arcId(arc.channelKey, arc.publisher, arc.subscriber);
            const channel = config.channels[arc.channelKey];
            const start = vec3(positions.get(arc.publisher) ?? [0, 0, 0]);
            const end = vec3(positions.get(arc.subscriber) ?? [0, 0, 0]);
            const reverseExists = arcs.some((a) => a.publisher === arc.subscriber && a.subscriber === arc.publisher);
            const curve = buildArcCurve(start, end, channel.arcHeight, reverseExists);
            const existing = this.views.get(id);
            if (!existing) {
                const style = PARTICLE_STYLES[styleIndex++ % PARTICLE_STYLES.length];
                const partial = createArcView(curve, channel.color, style, styleIndex - 1);
                const view = { key: id, ...partial };
                this.views.set(id, view);
                this.root.add(view.line);
                this.root.add(view.arrow);
                this.root.add(view.particles);
            }
            else {
                updateArcGeometry(existing, curve, channel.color);
            }
        }
    }
    advanceFlow(deltaSeconds) {
        for (const view of this.views.values()) {
            const positions = view.particles.geometry.attributes.position;
            const offset = ((view.particles.userData.offset ?? 0) + deltaSeconds * 0.2) % 1;
            view.particles.userData.offset = offset;
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const t = (i / PARTICLE_COUNT + offset) % 1;
                const p = view.curve.getPoint(t);
                positions.setXYZ(i, p.x, p.y, p.z);
            }
            positions.needsUpdate = true;
        }
    }
}
function arcId(channelKey, publisher, subscriber) {
    return `${channelKey}::${publisher}->${subscriber}`;
}
function vec3(v) { return new THREE.Vector3(v[0], v[1], v[2]); }
function createArcView(curve, channelColor, style, particleStyleIndex) {
    const points = curve.getPoints(40);
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: channelColor, transparent: true, opacity: 0.35 });
    const line = new THREE.Line(lineGeom, lineMat);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 12), new THREE.MeshLambertMaterial({ color: channelColor }));
    positionArrow(arrow, curve);
    const particleGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
        color: style.color,
        size: style.size,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    particles.userData = { offset: 0 };
    return { curve, line, arrow, particles, particleStyleIndex };
}
function updateArcGeometry(view, curve, color) {
    view.curve = curve;
    const points = curve.getPoints(40);
    view.line.geometry.dispose();
    view.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
    view.line.material.color.set(color);
    view.arrow.material.color.set(color);
    positionArrow(view.arrow, curve);
}
function positionArrow(arrow, curve) {
    const tip = curve.getPoint(0.97);
    const just = curve.getPoint(0.94);
    arrow.position.copy(tip);
    const dir = new THREE.Vector3().subVectors(tip, just).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    arrow.quaternion.copy(quat);
}
//# sourceMappingURL=edgeManager.js.map
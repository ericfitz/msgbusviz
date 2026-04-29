import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { isNodePrimitive, isMessagePrimitive, } from '@msgbusviz/core';
import { createNodePrimitive } from './primitives.js';
const loader = new GLTFLoader();
const cache = new Map();
export async function resolveNodeModel(model, color, baseUrl) {
    if (isNodePrimitive(model)) {
        return createNodePrimitive(model, color);
    }
    return loadGltfClone(resolveAssetUrl(model, baseUrl));
}
export async function resolveMessageModel(model, color, baseUrl) {
    if (isMessagePrimitive(model)) {
        return createMessagePrimitive(model, color);
    }
    return loadGltfClone(resolveAssetUrl(model, baseUrl));
}
export function resolveMessageModelSync(model, color) {
    if (isMessagePrimitive(model)) {
        return createMessagePrimitive(model, color);
    }
    return null;
}
export function createMessagePrimitive(name, color) {
    const mat = new THREE.MeshLambertMaterial({ color });
    if (name === 'sphere')
        return new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat);
    if (name === 'cube')
        return new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), mat);
    return new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 12), mat);
}
function resolveAssetUrl(modelPath, baseUrl) {
    if (/^https?:/.test(modelPath) || modelPath.startsWith('/'))
        return modelPath;
    const base = baseUrl.replace(/\/+$/, '');
    return `${base}/assets/${modelPath.replace(/^\.\//, '')}`;
}
async function loadGltfClone(url) {
    if (!cache.has(url)) {
        cache.set(url, new Promise((resolve, reject) => {
            loader.load(url, (gltf) => resolve(gltf.scene), undefined, (err) => reject(err));
        }));
    }
    const scene = await cache.get(url);
    return scene.clone(true);
}
export function clearModelCache() {
    cache.clear();
}
//# sourceMappingURL=modelResolver.js.map
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  isNodePrimitive,
  isMessagePrimitive,
  type NodePrimitive,
  type MessagePrimitive,
} from '@msgbusviz/core';
import { createNodePrimitive } from './primitives.js';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();

export async function resolveNodeModel(model: string, color: string, baseUrl: string): Promise<THREE.Object3D> {
  if (isNodePrimitive(model)) {
    return createNodePrimitive(model as NodePrimitive, color);
  }
  return loadGltfClone(resolveAssetUrl(model, baseUrl));
}

export async function resolveMessageModel(model: string, color: string, baseUrl: string): Promise<THREE.Object3D> {
  if (isMessagePrimitive(model)) {
    return createMessagePrimitive(model as MessagePrimitive, color);
  }
  return loadGltfClone(resolveAssetUrl(model, baseUrl));
}

export function resolveMessageModelSync(model: string, color: string): THREE.Object3D | null {
  if (isMessagePrimitive(model)) {
    return createMessagePrimitive(model as MessagePrimitive, color);
  }
  return null;
}

export function createMessagePrimitive(name: MessagePrimitive, color: string): THREE.Object3D {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (name === 'sphere') return new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat);
  if (name === 'cube')   return new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), mat);
  return new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 12), mat);
}

function resolveAssetUrl(modelPath: string, baseUrl: string): string {
  if (/^https?:/.test(modelPath) || modelPath.startsWith('/')) return modelPath;
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/assets/${modelPath.replace(/^\.\//, '')}`;
}

async function loadGltfClone(url: string): Promise<THREE.Object3D> {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, (err) => reject(err));
    }));
  }
  const scene = await cache.get(url)!;
  return scene.clone(true);
}

export function clearModelCache(): void {
  cache.clear();
}

import * as THREE from 'three';
import { isNodePrimitive, type NodePrimitive } from '@msgbusviz/core';

const sharedGeometries = {
  cube:     new THREE.BoxGeometry(1, 1, 1),
  sphere:   new THREE.SphereGeometry(0.5, 24, 16),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
  cone:     new THREE.ConeGeometry(0.5, 1, 24),
  pyramid:  new THREE.ConeGeometry(0.6, 1, 4),
};

function basicMesh(geom: THREE.BufferGeometry, color: string): THREE.Mesh {
  const mat = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(geom, mat);
}

function buildServer(color: string): THREE.Object3D {
  const root = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.6),
      new THREE.MeshLambertMaterial({ color }),
    );
    slot.position.y = i * 0.3 - 0.3;
    root.add(slot);
  }
  return root;
}

function buildClient(color: string): THREE.Object3D {
  const root = new THREE.Group();
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.7, 0.05),
    new THREE.MeshLambertMaterial({ color }),
  );
  screen.position.y = 0.4;
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.15, 0.3, 12),
    new THREE.MeshLambertMaterial({ color }),
  );
  stand.position.y = -0.05;
  root.add(screen); root.add(stand);
  return root;
}

function buildDatabase(color: string): THREE.Object3D {
  const root = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const disk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.18, 24),
      new THREE.MeshLambertMaterial({ color }),
    );
    disk.position.y = i * 0.22 - 0.22;
    root.add(disk);
  }
  return root;
}

function buildQueue(color: string): THREE.Object3D {
  const root = new THREE.Group();
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 1.2, 24),
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.7 }),
  );
  tube.rotation.z = Math.PI / 2;
  root.add(tube);
  return root;
}

function buildCloud(color: string): THREE.Object3D {
  const root = new THREE.Group();
  const offsets: [number, number, number][] = [
    [0, 0, 0], [0.5, 0.1, 0], [-0.5, 0.1, 0], [0.25, 0.4, 0], [-0.25, 0.4, 0],
  ];
  for (const o of offsets) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 12),
      new THREE.MeshLambertMaterial({ color }),
    );
    puff.position.set(o[0], o[1], o[2]);
    root.add(puff);
  }
  return root;
}

export function createNodePrimitive(name: NodePrimitive, color: string): THREE.Object3D {
  switch (name) {
    case 'cube':     return basicMesh(sharedGeometries.cube,     color);
    case 'sphere':   return basicMesh(sharedGeometries.sphere,   color);
    case 'cylinder': return basicMesh(sharedGeometries.cylinder, color);
    case 'cone':     return basicMesh(sharedGeometries.cone,     color);
    case 'pyramid':  return basicMesh(sharedGeometries.pyramid,  color);
    case 'server':   return buildServer(color);
    case 'client':   return buildClient(color);
    case 'database': return buildDatabase(color);
    case 'queue':    return buildQueue(color);
    case 'cloud':    return buildCloud(color);
  }
}

export function isNodePrimitiveName(s: string): boolean {
  return isNodePrimitive(s);
}

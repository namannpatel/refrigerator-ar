import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'fs';
import * as THREE from 'three';
import { Refrigerator } from '../src/refrigerator.js';

const buf = fs.readFileSync('public/models/Samsung_Fridge.glb');
const loader = new GLTFLoader();
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, undefined, rej));

const fridge = new Refrigerator();
fridge.buildFromGLTF(gltf.scene);

const doorMesh = fridge.parts.leftDoor[0];
const posClosed = doorMesh.getWorldPosition(new THREE.Vector3()).clone();

fridge.toggleLeftDoor();
for (let i = 0; i < 120; i++) fridge.update(1 / 60);
const posOpen = doorMesh.getWorldPosition(new THREE.Vector3());

console.log('closed angle', fridge.state.leftDoorAngle, 'pivot y', fridge.leftDoorPivot.rotation.y);
console.log('world movement open', posClosed.distanceTo(posOpen));

fridge.toggleLeftDoor();
for (let i = 0; i < 120; i++) fridge.update(1 / 60);
const posClosedAgain = doorMesh.getWorldPosition(new THREE.Vector3());
console.log('closed again angle', fridge.state.leftDoorAngle);
console.log('return movement', posOpen.distanceTo(posClosedAgain));

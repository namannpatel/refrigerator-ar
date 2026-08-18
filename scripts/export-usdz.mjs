/**
 * Build-time GLB → USDZ for iOS AR Quick Look (with app textures applied).
 */
import './domPolyfill.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { TEXTURES } from '../src/config.js';
import { Refrigerator } from '../src/refrigerator.js';
import { loadJpegTexture } from './loadTextureNode.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const glbPath = path.join(root, 'public/models/Samsung_Fridge.glb');
const usdzPath = path.join(root, 'public/models/Samsung_Fridge.usdz');
const textureDir = path.join(root, 'public/textures');

const buffer = fs.readFileSync(glbPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
const gltf = await new Promise((resolve, reject) => {
  loader.parse(arrayBuffer, '', resolve, undefined, reject);
});

const textures = {
  diffuse: await loadJpegTexture(path.join(textureDir, TEXTURES.diffuse), {
    colorSpace: THREE.SRGBColorSpace,
  }),
  normal: await loadJpegTexture(path.join(textureDir, TEXTURES.normal)),
  emissive: await loadJpegTexture(path.join(textureDir, TEXTURES.emissive), {
    colorSpace: THREE.SRGBColorSpace,
  }),
};

const bodyMaterial = new THREE.MeshStandardMaterial({
  map: textures.diffuse,
  color: new THREE.Color(0xffffff),
  normalMap: textures.normal,
  normalScale: new THREE.Vector2(1, 1),
  metalness: 0.82,
  roughness: 0.38,
  side: THREE.DoubleSide,
});

const lightMaterial = new THREE.MeshStandardMaterial({
  map: textures.diffuse,
  color: new THREE.Color(0xffffff),
  normalMap: textures.normal,
  emissiveMap: textures.emissive,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.55,
  metalness: 0.2,
  roughness: 0.6,
  side: THREE.DoubleSide,
});

const refrigerator = new Refrigerator();
refrigerator.buildFromGLTF(gltf.scene);

refrigerator.root.traverse((child) => {
  if (!child.isMesh) return;
  const isLight = child.name.toLowerCase().includes('interior_light');
  child.material = isLight ? lightMaterial.clone() : bodyMaterial.clone();
});

refrigerator._ensureClosedState();

const exporter = new USDZExporter();
const usdz = await exporter.parseAsync(refrigerator.root, {
  quickLookCompatible: true,
  includeAnchoringProperties: true,
  maxTextureSize: 2048,
  ar: {
    anchoring: { type: 'plane' },
    planeAnchoring: { alignment: 'horizontal' },
  },
});

if (!usdz || usdz.byteLength === 0) {
  throw new Error('USDZExporter returned empty output');
}

fs.writeFileSync(usdzPath, new Uint8Array(usdz));
console.log(`USDZ written: ${usdzPath} (${usdz.byteLength} bytes)`);

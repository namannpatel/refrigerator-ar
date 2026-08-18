/**
 * Build-time GLB → USDZ for iOS AR Quick Look (Safari without WebXR).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const glbPath = path.join(root, 'public/models/Samsung_Fridge.glb');
const usdzPath = path.join(root, 'public/models/Samsung_Fridge.usdz');

const buffer = fs.readFileSync(glbPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();

const gltf = await new Promise((resolve, reject) => {
  loader.parse(
    arrayBuffer,
    '',
    resolve,
  );
});

const exporter = new USDZExporter();
const usdz = await exporter.parseAsync(gltf.scene, {
  quickLookCompatible: true,
  includeAnchoringProperties: true,
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

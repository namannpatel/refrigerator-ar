import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const modelUrl = new URL('../public/models/Samsung_Fridge.glb', import.meta.url).href;
const gltf = await loader.loadAsync(modelUrl);

const names = ['Left_Door', 'Right_Door', 'Refregerator', 'Left_Door_Shelves', 'Interior_Shelves'];
gltf.scene.traverse((c) => {
  if (!c.isMesh) return;
  const n = c.name.toLowerCase();
  if (names.some((x) => n.includes(x.toLowerCase()))) {
    const box = new THREE.Box3().setFromObject(c);
    console.log(c.name, 'pos', c.position.toArray(), 'box', box.min.toArray(), box.max.toArray());
  }
});

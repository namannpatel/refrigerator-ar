import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TEXTURE_BASE, TEXTURES } from './config.js';

/**
 * obj2gltf exports glTF UVs — external textures must use flipY=false in Three.js.
 * Stacking metalness + inverted glossiness maps on this asset causes a noisy checker look.
 */
function configureMap(texture, { colorSpace = THREE.NoColorSpace } = {}) {
  texture.colorSpace = colorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function loadTexture(textureLoader, file, options = {}) {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      `${TEXTURE_BASE}${file}`,
      (texture) => resolve(configureMap(texture, options)),
      undefined,
      reject,
    );
  });
}

export class ModelLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this._textures = null;
    this._bodyMaterial = null;
    this._lightMaterial = null;
  }

  async loadTextures() {
    if (this._textures) return this._textures;

    const diffuse = await loadTexture(this.textureLoader, TEXTURES.diffuse, {
      colorSpace: THREE.SRGBColorSpace,
    });
    const normal = await loadTexture(this.textureLoader, TEXTURES.normal);
    const emissive = await loadTexture(this.textureLoader, TEXTURES.emissive, {
      colorSpace: THREE.SRGBColorSpace,
    });

    this._textures = { diffuse, normal, emissive };
    return this._textures;
  }

  _createBodyMaterial(textures) {
    return new THREE.MeshStandardMaterial({
      name: 'Samsung_Fridge_Body',
      map: textures.diffuse,
      color: new THREE.Color(0xffffff),
      normalMap: textures.normal,
      normalScale: new THREE.Vector2(1, 1),
      metalness: 0.82,
      roughness: 0.38,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      side: THREE.DoubleSide,
    });
  }

  _createLightMaterial(textures) {
    return new THREE.MeshStandardMaterial({
      name: 'Samsung_Fridge_Light',
      map: textures.diffuse,
      color: new THREE.Color(0xffffff),
      normalMap: textures.normal,
      normalScale: new THREE.Vector2(1, 1),
      emissiveMap: textures.emissive,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.55,
      metalness: 0.2,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
  }

  applyMaterials(root, textures) {
    this._bodyMaterial = this._createBodyMaterial(textures);
    this._lightMaterial = this._createLightMaterial(textures);

    root.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      const isLight = child.name.toLowerCase().includes('interior_light');
      const mat = isLight
        ? this._lightMaterial.clone()
        : this._bodyMaterial.clone();

      child.material = mat;
      child.userData.finishMaterial = mat;
      child.userData.isLight = isLight;
    });
  }

  setFinish(root, finishConfig) {
    root.traverse((child) => {
      if (!child.isMesh || !child.userData.finishMaterial) return;
      if (child.userData.isLight) return;

      const mat = child.userData.finishMaterial;
      mat.color.setHex(finishConfig.color);
      mat.metalness = finishConfig.metalness;
      mat.roughness = finishConfig.roughness;
      mat.needsUpdate = true;
    });
  }

  loadModel(url, onProgress) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => resolve(gltf),
        (event) => {
          if (onProgress && event.total) {
            onProgress(event.loaded / event.total);
          }
        },
        (error) => reject(error),
      );
    });
  }
}

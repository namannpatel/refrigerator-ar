/**
 * Load JPG textures in Node (no DOM) for build-time USDZ export.
 */
import { loadImage } from 'canvas';
import * as THREE from 'three';

export async function loadJpegTexture(filePath, { colorSpace = THREE.NoColorSpace } = {}) {
  const image = await loadImage(filePath);
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = colorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

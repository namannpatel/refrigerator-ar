import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA } from './config.js';

export class ProductViewer {
  constructor(sceneManager, refrigerator) {
    this.sceneManager = sceneManager;
    this.refrigerator = refrigerator;
    this.canvas = sceneManager.canvas;
    this.camera = sceneManager.camera;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = CAMERA.minDistance;
    this.controls.maxDistance = CAMERA.maxDistance;
    this.controls.maxPolarAngle = Math.PI * 0.88;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = CAMERA.autoRotateSpeed;
    this.controls.target.set(0, 0.9, 0);

    this._idleTimer = null;
    this._defaultCameraPosition = new THREE.Vector3(1.8, 1.2, 2.4);
    this._defaultTarget = new THREE.Vector3(0, 0.9, 0);

    this.controls.addEventListener('start', () => this._stopAutoRotate());
    this.controls.addEventListener('end', () => this._scheduleAutoRotate());

    this.resetCamera();
    this._scheduleAutoRotate();
  }

  _stopAutoRotate() {
    this.controls.autoRotate = false;
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }

  _scheduleAutoRotate() {
    this._stopAutoRotate();
    this._idleTimer = setTimeout(() => {
      this.controls.autoRotate = true;
    }, CAMERA.idleAutoRotateDelay);
  }

  resetCamera() {
    const height = this.refrigerator.worldHeight || 1.78;
    const dist = height * 1.35;
    this._defaultCameraPosition.set(dist * 0.75, height * 0.55, dist);
    this._defaultTarget.set(0, height * 0.45, 0);

    this.camera.position.copy(this._defaultCameraPosition);
    this.controls.target.copy(this._defaultTarget);
    this.controls.update();
    this._scheduleAutoRotate();
  }

  update() {
    this.controls.update();
  }

  setEnabled(enabled) {
    this.controls.enabled = enabled;
    if (!enabled) this._stopAutoRotate();
    else this._scheduleAutoRotate();
  }

  dispose() {
    this._stopAutoRotate();
    this.controls.dispose();
  }
}

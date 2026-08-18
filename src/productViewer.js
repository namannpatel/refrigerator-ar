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
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this._idleTimer = null;
    this._defaultCameraPosition = new THREE.Vector3(1.8, 1.2, 2.4);
    this._defaultTarget = new THREE.Vector3(0, 0.9, 0);
    this._savedControls = null;

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
    else if (!this._savedControls) this._scheduleAutoRotate();
  }

  configureForCameraAR() {
    this._stopAutoRotate();
    this.controls.autoRotate = false;

    const height = this.refrigerator.worldHeight || 1.78;
    const midY = height * 0.45;

    this._savedControls = {
      minDistance: this.controls.minDistance,
      maxDistance: this.controls.maxDistance,
      near: this.camera.near,
      far: this.camera.far,
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
    };

    this.controls.enabled = true;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.panSpeed = 0.85;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 1.0;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, midY, 0);
    this.controls.minDistance = height * 0.35;
    this.controls.maxDistance = height * 2.8;
    this.controls.maxPolarAngle = Math.PI * 0.88;
    this.controls.minPolarAngle = 0.15;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.camera.near = height * 0.02;
    this.camera.far = height * 25;

    const dist = height * 1.15;
    this.camera.position.set(dist * 0.75, midY + height * 0.08, dist);
    this.controls.update();

    return midY;
  }

  restoreAfterCameraAR() {
    if (!this._savedControls) return;

    this.controls.minDistance = this._savedControls.minDistance;
    this.controls.maxDistance = this._savedControls.maxDistance;
    this.camera.near = this._savedControls.near;
    this.camera.far = this._savedControls.far;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.panSpeed = 1.0;
    this.controls.rotateSpeed = 1.0;
    this.controls.zoomSpeed = 1.0;
    this.controls.dampingFactor = 0.06;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    this._savedControls = null;
    this.resetCamera();
  }

  dispose() {
    this._stopAutoRotate();
    this.controls.dispose();
  }
}

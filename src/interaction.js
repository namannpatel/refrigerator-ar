import * as THREE from 'three';

export class InteractionHandler {
  constructor(canvas, camera, refrigerator, callbacks = {}) {
    this.canvas = canvas;
    this.camera = camera;
    this.refrigerator = refrigerator;
    this.callbacks = callbacks;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.enabled = true;
    this._pointerDown = false;

    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointerup', this._onPointerUp);
  }

  setCamera(camera) {
    this.camera = camera;
  }

  _onPointerDown = (event) => {
    if (!this.enabled) return;
    this._pointerDown = true;
    this._pointerId = event.pointerId;
    this._downX = event.clientX;
    this._downY = event.clientY;
  };

  _onPointerUp = (event) => {
    if (!this.enabled || !this._pointerDown) return;
    this._pointerDown = false;

    const dx = event.clientX - this._downX;
    const dy = event.clientY - this._downY;
    if (Math.hypot(dx, dy) > 12) return;

    this._updatePointer(event);
    this._handleTap();
  };

  _updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _handleTap() {
    const meshes = this.refrigerator.getInteractiveMeshes();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return;

    const interaction = this.refrigerator.identifyInteraction(hits[0]);
    if (!interaction) return;

    switch (interaction.type) {
      case 'leftDoor':
        this.refrigerator.toggleLeftDoor();
        this.callbacks.onDoorChange?.();
        break;
      case 'rightDoor':
        this.refrigerator.toggleRightDoor();
        this.callbacks.onDoorChange?.();
        break;
      case 'freezer':
        this.refrigerator.toggleFreezer();
        this.callbacks.onDoorChange?.();
        break;
      case 'display':
        this.callbacks.onDisplayTap?.();
        break;
      case 'dispenser':
        const msg = this.refrigerator.triggerDispenser(interaction.mode);
        if (msg) this.callbacks.onDispenser?.(msg);
        break;
      default:
        break;
    }
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
  }
}

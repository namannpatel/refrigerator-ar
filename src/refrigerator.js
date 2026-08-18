import * as THREE from 'three';
import {
  ANIMATION,
  DISPLAY_ZONE,
  DISPENSER_ZONE,
  getMeshGroup,
  INCH_TO_METER,
  PART_PATTERNS,
  TARGET_HEIGHT_INCHES,
} from './config.js';

export function matchesPart(name, patterns) {
  const lower = name.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function pointInZone(point, zone) {
  return (
    point.x >= zone.minX &&
    point.x <= zone.maxX &&
    point.y >= zone.minY &&
    point.y <= zone.maxY &&
    point.z >= zone.minZ &&
    point.z <= zone.maxZ
  );
}

export class Refrigerator {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'RefrigeratorRoot';

    this.chassisGroup = new THREE.Group();
    this.chassisGroup.name = 'Chassis';
    this.leftDoorAssembly = new THREE.Group();
    this.leftDoorAssembly.name = 'LeftDoorAssembly';
    this.rightDoorAssembly = new THREE.Group();
    this.rightDoorAssembly.name = 'RightDoorAssembly';
    this.freezerAssembly = new THREE.Group();
    this.freezerAssembly.name = 'FreezerAssembly';

    this.leftDoorPivot = new THREE.Group();
    this.leftDoorPivot.name = 'LeftDoorPivot';
    this.rightDoorPivot = new THREE.Group();
    this.rightDoorPivot.name = 'RightDoorPivot';
    this.freezerPivot = new THREE.Group();
    this.freezerPivot.name = 'FreezerPivot';

    this.leftDoorAssembly.add(this.leftDoorPivot);
    this.rightDoorAssembly.add(this.rightDoorPivot);
    this.freezerAssembly.add(this.freezerPivot);

    this.root.add(this.chassisGroup);
    this.root.add(this.leftDoorAssembly);
    this.root.add(this.rightDoorAssembly);
    this.root.add(this.freezerAssembly);

    this.parts = {
      leftDoor: [],
      rightDoor: [],
      freezer: [],
      chassis: [],
      lights: [],
    };

    this.state = {
      leftDoorOpen: false,
      rightDoorOpen: false,
      freezerOpen: false,
      leftDoorAngle: 0,
      rightDoorAngle: 0,
      freezerOffset: 0,
      leftDoorTarget: 0,
      rightDoorTarget: 0,
      freezerTarget: 0,
    };

    this.scaleFactor = INCH_TO_METER;
    this._freezerBaseLocal = new THREE.Vector3();
    this.dispenserCooldown = 0;
    this._localHit = new THREE.Vector3();
  }

  buildFromGLTF(gltfScene) {
    const meshMap = {
      chassis: [],
      leftDoor: [],
      rightDoor: [],
      freezer: [],
    };

    gltfScene.traverse((child) => {
      if (!child.isMesh) return;
      const group = getMeshGroup(child.name);
      meshMap[group].push(child);
    });

    meshMap.chassis.forEach((m) => this.chassisGroup.attach(m));
    meshMap.leftDoor.forEach((m) => this.leftDoorPivot.attach(m));
    meshMap.rightDoor.forEach((m) => this.rightDoorPivot.attach(m));
    meshMap.freezer.forEach((m) => this.freezerPivot.attach(m));

    this.parts.leftDoor = meshMap.leftDoor;
    this.parts.rightDoor = meshMap.rightDoor;
    this.parts.freezer = meshMap.freezer;
    this.parts.chassis = meshMap.chassis;
    this.parts.lights = meshMap.chassis.filter((m) =>
      matchesPart(m.name, PART_PATTERNS.interiorLightTop) ||
      matchesPart(m.name, PART_PATTERNS.interiorLightLeft) ||
      matchesPart(m.name, PART_PATTERNS.interiorLightRight),
    );

    this._setupHingePivot(this.leftDoorPivot, 'left');
    this._setupHingePivot(this.rightDoorPivot, 'right');
    this._setupSlidePivot(this.freezerPivot);

    this._applyScaleAndGround();
    this._ensureClosedState();

    return this;
  }

  _boxFromChildren(parent) {
    const box = new THREE.Box3();
    parent.children.forEach((child) => box.expandByObject(child));
    return box;
  }

  /**
   * Place pivot on the door hinge (inner edge / hinge mesh) so rotation swings the full door assembly.
   */
  _setupHingePivot(pivot, side) {
    if (pivot.children.length === 0) return;

    const assembly = pivot.parent;
    const meshes = pivot.children.map((child) => child);

    pivot.updateMatrixWorld(true);

    const hingeMesh = meshes.find((mesh) => /hinge/i.test(mesh.name));
    const hingeWorld = new THREE.Vector3();

    if (hingeMesh) {
      new THREE.Box3().setFromObject(hingeMesh).getCenter(hingeWorld);
    } else {
      const box = new THREE.Box3();
      meshes.forEach((mesh) => box.expandByObject(mesh));
      if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return;

      hingeWorld.set(
        side === 'left' ? box.max.x : box.min.x,
        (box.min.y + box.max.y) * 0.5,
        (box.min.z + box.max.z) * 0.5,
      );
    }

    meshes.forEach((mesh) => assembly.attach(mesh));
    assembly.updateMatrixWorld(true);
    pivot.position.copy(assembly.worldToLocal(hingeWorld));
    meshes.forEach((mesh) => pivot.attach(mesh));
    pivot.updateMatrixWorld(true);
  }

  _setupSlidePivot(pivot) {
    if (pivot.children.length === 0) return;

    const assembly = pivot.parent;
    const meshes = pivot.children.map((child) => child);

    pivot.updateMatrixWorld(true);
    const box = this._boxFromChildren(pivot);
    if (!Number.isFinite(box.min.z)) return;

    const origin = new THREE.Vector3(
      (box.min.x + box.max.x) * 0.5,
      box.min.y,
      box.min.z,
    );

    meshes.forEach((mesh) => assembly.attach(mesh));
    pivot.position.copy(origin);
    meshes.forEach((mesh) => pivot.attach(mesh));
    this._freezerBaseLocal.copy(pivot.position);
    pivot.updateMatrixWorld(true);
  }

  _ensureClosedState() {
    this.state.leftDoorOpen = false;
    this.state.rightDoorOpen = false;
    this.state.freezerOpen = false;
    this.state.leftDoorAngle = this._leftClosedAngle();
    this.state.rightDoorAngle = this._rightClosedAngle();
    this.state.freezerOffset = this._freezerClosedOffset();
    this.state.leftDoorTarget = this._leftClosedAngle();
    this.state.rightDoorTarget = this._rightClosedAngle();
    this.state.freezerTarget = this._freezerClosedOffset();

    this.leftDoorPivot.rotation.set(0, this.state.leftDoorAngle, 0);
    this.rightDoorPivot.rotation.set(0, this.state.rightDoorAngle, 0);
    this.leftDoorAssembly.position.x = ANIMATION.doorClosedInsetX;
    this.rightDoorAssembly.position.x = -ANIMATION.doorClosedInsetX;
    this.freezerPivot.position.z = this._freezerBaseLocal.z + this._freezerClosedOffset();
    this.root.updateMatrixWorld(true);
  }

  _applyScaleAndGround() {
    this.root.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(this.root);
    const rawHeight = rawBox.max.y - rawBox.min.y;

    if (!Number.isFinite(rawHeight) || rawHeight <= 0) {
      console.warn('Invalid model bounds; using default scale.');
      this.scaleFactor = INCH_TO_METER;
      this.root.scale.setScalar(INCH_TO_METER);
    } else {
      const targetScale = (TARGET_HEIGHT_INCHES * INCH_TO_METER) / rawHeight;
      this.scaleFactor = targetScale;
      this.root.scale.setScalar(targetScale);
    }

    const box = new THREE.Box3().setFromObject(this.root);
    this.root.position.y = Number.isFinite(box.min.y) ? -box.min.y : 0;
    this.root.updateMatrixWorld(true);

    this.worldHeight = box.max.y - box.min.y;
    this.footprint = {
      width: box.max.x - box.min.x,
      depth: box.max.z - box.min.z,
    };
  }

  toggleLeftDoor() {
    this.state.leftDoorOpen = !this.state.leftDoorOpen;
    this.state.leftDoorTarget = this.state.leftDoorOpen
      ? this._leftOpenAngle()
      : this._leftClosedAngle();
  }

  toggleRightDoor() {
    this.state.rightDoorOpen = !this.state.rightDoorOpen;
    this.state.rightDoorTarget = this.state.rightDoorOpen
      ? this._rightOpenAngle()
      : this._rightClosedAngle();
  }

  toggleFreezer() {
    this.state.freezerOpen = !this.state.freezerOpen;
    this.state.freezerTarget = this.state.freezerOpen
      ? this._freezerOpenOffset()
      : this._freezerClosedOffset();
  }

  openLeftDoor(open = true) {
    this.state.leftDoorOpen = open;
    this.state.leftDoorTarget = open ? this._leftOpenAngle() : this._leftClosedAngle();
  }

  openRightDoor(open = true) {
    this.state.rightDoorOpen = open;
    this.state.rightDoorTarget = open ? this._rightOpenAngle() : this._rightClosedAngle();
  }

  openFreezer(open = true) {
    this.state.freezerOpen = open;
    this.state.freezerTarget = open ? this._freezerOpenOffset() : this._freezerClosedOffset();
  }

  _leftClosedAngle() {
    return ANIMATION.doorClosedLeftAngle + ANIMATION.doorClosedAngleInset;
  }

  _leftOpenAngle() {
    return ANIMATION.doorOpenLeftAngle;
  }

  _rightClosedAngle() {
    return ANIMATION.doorClosedRightAngle - ANIMATION.doorClosedAngleInset;
  }

  _rightOpenAngle() {
    return ANIMATION.doorOpenRightAngle;
  }

  _freezerClosedOffset() {
    return -(ANIMATION.freezerSlideDistance + ANIMATION.freezerCloseInset);
  }

  _freezerOpenOffset() {
    return ANIMATION.freezerSlideDistance;
  }

  identifyInteraction(hit) {
    const group = getMeshGroup(hit.object.name);

    if (group === 'freezer') {
      return { type: 'freezer' };
    }

    if (group === 'rightDoor') {
      return { type: 'rightDoor' };
    }

    if (group === 'leftDoor') {
      this._localHit.copy(hit.point);
      this.root.worldToLocal(this._localHit);
      const localInches = this._localHit.clone().divideScalar(this.scaleFactor);

      if (pointInZone(localInches, DISPLAY_ZONE)) {
        return { type: 'display' };
      }
      if (pointInZone(localInches, DISPENSER_ZONE)) {
        return { type: 'dispenser', mode: 'water' };
      }
      return { type: 'leftDoor' };
    }

    return null;
  }

  triggerDispenser(mode = 'water') {
    if (this.dispenserCooldown > 0) return null;
    this.dispenserCooldown = 1.5;
    return mode === 'ice' ? 'Ice dispensed' : 'Water dispensed';
  }

  update(delta) {
    const doorLerp = 1 - Math.exp(-delta / ANIMATION.doorDuration * 6);
    const freezerLerp = 1 - Math.exp(-delta / ANIMATION.freezerDuration * 6);

    this.state.leftDoorAngle += (this.state.leftDoorTarget - this.state.leftDoorAngle) * doorLerp;
    this.state.rightDoorAngle += (this.state.rightDoorTarget - this.state.rightDoorAngle) * doorLerp;
    this.state.freezerOffset += (this.state.freezerTarget - this.state.freezerOffset) * freezerLerp;

    if (!Number.isFinite(this.state.leftDoorAngle)) this.state.leftDoorAngle = 0;
    if (!Number.isFinite(this.state.rightDoorAngle)) this.state.rightDoorAngle = 0;
    if (!Number.isFinite(this.state.freezerOffset)) this.state.freezerOffset = 0;

    this.leftDoorPivot.rotation.set(0, this.state.leftDoorAngle, 0);
    this.rightDoorPivot.rotation.set(0, this.state.rightDoorAngle, 0);
    this.freezerPivot.position.z = this._freezerBaseLocal.z + this.state.freezerOffset;

    const leftInsetTarget = this.state.leftDoorOpen ? 0 : ANIMATION.doorClosedInsetX;
    const rightInsetTarget = this.state.rightDoorOpen ? 0 : -ANIMATION.doorClosedInsetX;
    this.leftDoorAssembly.position.x += (leftInsetTarget - this.leftDoorAssembly.position.x) * doorLerp;
    this.rightDoorAssembly.position.x += (rightInsetTarget - this.rightDoorAssembly.position.x) * doorLerp;

    if (this.dispenserCooldown > 0) {
      this.dispenserCooldown -= delta;
    }

    this.parts.lights.forEach((mesh) => {
      if (mesh.material && mesh.userData.isLight) {
        mesh.material.emissiveIntensity = 1.25 + Math.sin(Date.now() * 0.002) * 0.15;
      }
    });
  }

  getInteractiveMeshes() {
    const meshes = [];
    this.root.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
    return meshes;
  }
}

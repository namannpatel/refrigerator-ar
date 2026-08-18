import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this._studioBackground = new THREE.Color(0xe8ecf2);
    this.scene.background = this._studioBackground.clone();
    this._studioExposure = 1.05;
    this._arExposure = 1.4;

    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.01, 100);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.xr.enabled = true;

    this.studioGroup = new THREE.Group();
    this.scene.add(this.studioGroup);

    this.productRoot = new THREE.Group();
    this.scene.add(this.productRoot);

    this._setupLighting();
    this._setupEnvironment();
    this._setupStudioFloor();
  }

  _setupEnvironment() {
    this._pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this._environmentScene = new RoomEnvironment();
    this._studioEnvironment = this._pmremGenerator.fromScene(this._environmentScene).texture;
    this.scene.environment = this._studioEnvironment;
    this.scene.environmentIntensity = 1.0;
  }

  _setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xf0f4ff, 0x8a9099, 0.35);
    this.scene.add(this.hemiLight);

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0002;
    this.scene.add(key);
    this.keyLight = key;

    this.fillLight = new THREE.DirectionalLight(0xdde6ff, 0.45);
    this.fillLight.position.set(-5, 3, -2);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.25);
    this.rimLight.position.set(0, 4, -6);
    this.scene.add(this.rimLight);
  }

  _setupStudioFloor() {
    const floorGeo = new THREE.CircleGeometry(3, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xdce1e8,
      roughness: 0.92,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.studioGroup.add(floor);
    this.studioFloor = floor;
  }

  setStudioVisible(visible) {
    this.studioGroup.visible = visible;
  }

  /** Boost lighting and environment so PBR textures read clearly in AR passthrough. */
  configureForAR(enabled) {
    if (enabled) {
      this.scene.background = null;
      this.ambientLight.intensity = 1.05;
      this.hemiLight.intensity = 0.6;
      this.keyLight.intensity = 1.5;
      this.fillLight.intensity = 0.65;
      this.rimLight.intensity = 0.45;
      this.scene.environmentIntensity = 1.45;
      this.renderer.toneMappingExposure = this._arExposure;
      this.renderer.shadowMap.enabled = false;
    } else {
      this.scene.background = this._studioBackground.clone();
      this.ambientLight.intensity = 0.55;
      this.hemiLight.intensity = 0.35;
      this.keyLight.intensity = 1.1;
      this.fillLight.intensity = 0.45;
      this.rimLight.intensity = 0.25;
      this.scene.environmentIntensity = 1.0;
      this.renderer.toneMappingExposure = this._studioExposure;
      this.renderer.shadowMap.enabled = true;
    }
  }

  resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

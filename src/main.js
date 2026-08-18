import { MODEL_PATH, FINISHES } from './config.js';
import * as THREE from 'three';
import { SceneManager } from './scene.js';
import { ModelLoader } from './modelLoader.js';
import { Refrigerator } from './refrigerator.js';
import { ProductViewer } from './productViewer.js';
import { InteractionHandler } from './interaction.js';
import { ARSessionManager } from './ar.js';
import { UIManager } from './ui.js';

class App {
  constructor() {
    this.canvas = document.getElementById('three-canvas');
    this.ui = new UIManager(this);
    this.sceneManager = null;
    this.modelLoader = new ModelLoader();
    this.refrigerator = new Refrigerator();
    this.productViewer = null;
    this.interaction = null;
    this.arManager = null;
    this.clock = new THREE.Clock();
    this._running = false;
  }

  async init() {
    try {
      this.sceneManager = new SceneManager(this.canvas);
      this.sceneManager.productRoot.add(this.refrigerator.root);

      const textures = await this.modelLoader.loadTextures();
      this.ui.setLoadingProgress(0.15);

      const gltf = await this.modelLoader.loadModel(MODEL_PATH, (p) => {
        this.ui.setLoadingProgress(0.15 + p * 0.75);
      });

      this.refrigerator.buildFromGLTF(gltf.scene);
      this.modelLoader.applyMaterials(this.refrigerator.root, textures);
      this.refrigerator._ensureClosedState();
      this.ui.setLoadingProgress(1);
      this.ui.hideLoading();

      this.productViewer = new ProductViewer(this.sceneManager, this.refrigerator);
      this.interaction = new InteractionHandler(
        this.canvas,
        this.sceneManager.camera,
        this.refrigerator,
        {
          onDisplayTap: () => this.ui.openTempPanel(),
          onDispenser: (msg) => this.ui.showDispenserFeedback(msg),
          onDoorChange: () => this.ui.syncDoorButtons(),
        },
      );

      this.arManager = new ARSessionManager(
        this.sceneManager,
        this.refrigerator,
        this.interaction,
        this.modelLoader,
        this.productViewer,
      );
      this.arManager.bindDomRotation(this.canvas);

      const arStatus = await this.arManager.getAvailability();
      this.ui.setArSupported(arStatus.supported, arStatus.message, arStatus.mode);

      this.ui.syncDoorButtons();
      this.ui.elements.btnFinish.textContent = `Finish: ${FINISHES[0].name}`;

      window.addEventListener('resize', () => {
        if (this.arManager?.arMode === 'camera-ar') {
          this.arManager._resizeCameraARViewport();
        } else {
          this.sceneManager.resize();
        }
      });
      requestAnimationFrame(() => {
        this.sceneManager.resize();
        this.productViewer.resetCamera();
        this.refrigerator._ensureClosedState();
        this.ui.syncDoorButtons();
      });

      this._running = true;
      this.clock.start();
      this.renderer.setAnimationLoop((_timestamp, frame) => this._animate(_timestamp, frame));
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.ui.showError(
        error?.message || 'Failed to load the refrigerator model. Check that Samsung_Fridge.glb exists in public/models/.',
      );
    }
  }

  get renderer() {
    return this.sceneManager?.renderer;
  }

  _animate(_timestamp, frame) {
    if (!this._running) return;

    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (delta > 0) {
      this.refrigerator.update(delta);

      if (this.arManager?.isActive) {
        this.arManager.onFrame(_timestamp, frame);
        if (this.arManager.arMode === 'camera-ar') {
          this.arManager.updateCameraAR();
          this.productViewer?.setEnabled(true);
        } else {
          this.productViewer?.setEnabled(false);
        }
        this.interaction.enabled = false;
      } else {
        this.productViewer?.update();
        this.interaction.enabled = true;
        this.productViewer?.setEnabled(true);
      }
    }

    this.sceneManager.render();
  }

  resetView() {
    this.productViewer?.resetCamera();
  }

  setFinish(finish) {
    this.modelLoader.setFinish(this.refrigerator.root, finish);
  }

  async startAR() {
    if (!this.arManager) return;
    try {
      await this.arManager.start();
    } catch (error) {
      console.error('AR session failed:', error);
      this.arManager?.forceExit();
      const msg =
        error?.name === 'NotAllowedError'
          ? 'Camera permission denied. AR requires camera access.'
          : `AR session failed: ${error?.message || 'Unknown error'}`;
      this.ui.elements.arStatus.textContent = msg;
    }
  }

  async reload() {
    window.location.reload();
  }
}

const app = new App();
app.init();

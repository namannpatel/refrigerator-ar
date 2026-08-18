import * as THREE from 'three';
import { AR_POSTER_PATH, USDZ_PATH } from './config.js';

const RETICLE_RING = 0.35;

function getIOSVersion() {
  const match = (navigator.userAgent || '').match(/OS (\d+)[_.](\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function isIOSDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function supportsQuickLookLink() {
  try {
    const anchor = document.createElement('a');
    return Boolean(anchor.relList?.supports?.('ar'));
  } catch {
    return false;
  }
}

export class ARSessionManager {
  constructor(sceneManager, refrigerator, interactionHandler, modelLoader = null) {
    this.sceneManager = sceneManager;
    this.refrigerator = refrigerator;
    this.interactionHandler = interactionHandler;
    this.modelLoader = modelLoader;
    this.renderer = sceneManager.renderer;
    this.scene = sceneManager.scene;
    this.camera = sceneManager.camera;

    this.isActive = false;
    this.isPlaced = false;
    this.mode = 'move';
    this.hitTestSource = null;
    this.hitTestSourceRequested = false;
    this.referenceSpace = null;
    this.viewerSpace = null;
    this.localSpace = null;

    this.reticle = this._createReticle();
    this.scene.add(this.reticle);

    this.arGroup = new THREE.Group();
    this.scene.add(this.arGroup);

    this._lastHitMatrix = new THREE.Matrix4();
    this._placementPosition = new THREE.Vector3();
    this._placementQuaternion = new THREE.Quaternion();
    this._touchStart = null;
    this._startRotationY = 0;
    this._canvasPointerDown = false;
    this._canvasDownX = 0;
    this._canvasDownY = 0;
    this._tapDedupeUntil = 0;
    this.arMode = 'none';

    this.renderer.xr.addEventListener('sessionstart', () => this._onSessionStart());
    this.renderer.xr.addEventListener('sessionend', () => this._onSessionEnd());
  }

  _createReticle() {
    const geometry = new THREE.RingGeometry(RETICLE_RING * 0.85, RETICLE_RING, 32);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0b5fff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const reticle = new THREE.Mesh(geometry, material);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;

    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.02, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    );
    dot.rotation.x = -Math.PI / 2;
    reticle.add(dot);

    return reticle;
  }

  async checkSupport() {
    const status = await this.getAvailability();
    return status.supported;
  }

  /**
   * Explain why AR is unavailable (secure context, browser, OS version).
   */
  async getAvailability() {
    if (!window.isSecureContext) {
      return {
        supported: false,
        mode: 'none',
        reason: 'insecure',
        message:
          'WebXR AR requires HTTPS. On your phone, open the https:// link from the dev server (not http://) and accept the certificate warning. LAN IPs like 192.168.x.x do not get a secure-context exception.',
      };
    }

    const ua = navigator.userAgent || '';
    const isIOS = isIOSDevice();
    const iosVersion = getIOSVersion();
    const isChromeIOS = isIOS && /CriOS/i.test(ua);
    const isSafariIOS = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
    const quickLook = isIOS && supportsQuickLookLink();

    if (navigator.xr) {
      try {
        const webxrSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (webxrSupported) {
          this.arMode = 'webxr';
          return {
            supported: true,
            mode: 'webxr',
            reason: 'ok',
            message: isSafariIOS
              ? 'AR is available. Tap View in AR and allow camera access.'
              : 'AR is available on this device. Tap View in AR (HTTPS required).',
          };
        }
      } catch (err) {
        console.warn('Error checking AR support:', err);
      }
    }

    if (quickLook) {
      this.arMode = 'quick-look';
      return {
        supported: true,
        mode: 'quick-look',
        reason: 'quick-look',
        message:
          'On iPhone, Safari uses Apple AR (not in-page WebXR). Tap View in AR to place the refrigerator in your room.',
      };
    }

    if (isIOS) {
      if (isChromeIOS) {
        return {
          supported: false,
          mode: 'none',
          reason: 'chrome-ios',
          message:
            'Immersive AR is not available in Chrome on iPhone. Open this page in Safari and tap View in AR.',
        };
      }
      const versionText = iosVersion ? `iOS ${iosVersion.major}.${iosVersion.minor}` : 'this iPhone';
      return {
        supported: false,
        mode: 'none',
        reason: 'no-ar-ios',
        message: `AR could not be started on ${versionText}. Try Safari, allow camera access, and reload this page.`,
      };
    }

    if (!navigator.xr) {
      return {
        supported: false,
        mode: 'none',
        reason: 'no-webxr',
        message: 'This browser does not expose WebXR. Try Safari on iOS 17+ or Chrome on Android with ARCore.',
      };
    }

    return {
      supported: false,
      mode: 'none',
      reason: 'no-immersive-ar',
      message:
        'Immersive AR is not supported on this device. Android: use Chrome with ARCore. iPhone: Safari on iOS 17+ over HTTPS.',
    };
  }

  async startQuickLook() {
    const usdzUrl = new URL(USDZ_PATH, window.location.href).href;
    const posterUrl = new URL(AR_POSTER_PATH, window.location.href).href;

    const anchor = document.createElement('a');
    anchor.setAttribute('rel', 'ar');
    anchor.href = usdzUrl;

    const poster = document.createElement('img');
    poster.src = posterUrl;
    poster.alt = 'Samsung refrigerator AR preview';
    anchor.appendChild(poster);

    anchor.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(anchor);

    await new Promise((resolve) => {
      if (poster.complete) {
        resolve();
        return;
      }
      poster.onload = () => resolve();
      poster.onerror = () => resolve();
    });

    anchor.click();
    window.setTimeout(() => anchor.remove(), 1000);
  }

  async start() {
    if (this.isActive) return;

    if (this.arMode === 'quick-look') {
      await this.startQuickLook();
      return;
    }

    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['local-floor', 'dom-overlay'],
      domOverlay: { root: document.getElementById('ar-controls') },
    });

    await this.renderer.xr.setSession(session);
    this.isActive = true;
  }

  async _onSessionStart() {
    this.sceneManager.configureForAR(true);
    this.sceneManager.setStudioVisible(false);
    this.isPlaced = false;
    this.hitTestSourceRequested = false;
    this.hitTestSource = null;

    const session = this.renderer.xr.getSession();
    session.addEventListener('select', (event) => this._onSelect(event));

    this.referenceSpace = await session.requestReferenceSpace('local-floor');
    this.viewerSpace = await session.requestReferenceSpace('viewer');
    this.localSpace = await session.requestReferenceSpace('local');

    this.arGroup.add(this.refrigerator.root);
    this.refrigerator.root.visible = false;
    this.reticle.visible = true;

    document.getElementById('ar-controls').classList.remove('hidden');
    this._updateHint('Point at a flat surface and tap to place the refrigerator.');

    if (this.modelLoader) {
      this.modelLoader.refreshMaterialsForXR(this.renderer, this.refrigerator.root);
    }

    this._bindImmersiveTapListeners();
  }

  _bindImmersiveTapListeners() {
    this._onWindowPointerDown = (event) => {
      if (!this.isActive) return;
      const arControls = document.getElementById('ar-controls');
      if (arControls?.contains(event.target)) return;
      this._canvasPointerDown = true;
      this._canvasDownX = event.clientX;
      this._canvasDownY = event.clientY;
    };

    this._onWindowPointerUp = (event) => {
      if (!this.isActive || !this._canvasPointerDown) return;
      const arControls = document.getElementById('ar-controls');
      if (arControls?.contains(event.target)) return;

      this._canvasPointerDown = false;
      const dx = event.clientX - this._canvasDownX;
      const dy = event.clientY - this._canvasDownY;
      if (Math.hypot(dx, dy) > 12) return;
      if (this.isPlaced && this.mode === 'rotate' && this._touchStart) return;

      this._handleCanvasTap(event.clientX, event.clientY);
    };

    window.addEventListener('pointerdown', this._onWindowPointerDown, { capture: true });
    window.addEventListener('pointerup', this._onWindowPointerUp, { capture: true });
  }

  _unbindImmersiveTapListeners() {
    if (this._onWindowPointerDown) {
      window.removeEventListener('pointerdown', this._onWindowPointerDown, { capture: true });
    }
    if (this._onWindowPointerUp) {
      window.removeEventListener('pointerup', this._onWindowPointerUp, { capture: true });
    }
    this._onWindowPointerDown = null;
    this._onWindowPointerUp = null;
    this._canvasPointerDown = false;
  }

  _onSessionEnd() {
    this._unbindImmersiveTapListeners();
    this.isActive = false;
    this.isPlaced = false;
    this.hitTestSource = null;
    this.hitTestSourceRequested = false;
    this.reticle.visible = false;

    this.sceneManager.productRoot.add(this.refrigerator.root);
    this.refrigerator.root.visible = true;
    this.refrigerator.root.position.set(0, 0, 0);
    this.refrigerator.root.rotation.set(0, 0, 0);

    this.sceneManager.setStudioVisible(true);
    this.sceneManager.configureForAR(false);
    document.getElementById('ar-controls').classList.add('hidden');
  }

  _onSelect(event) {
    if (!this.isActive) return;
    if (Date.now() < this._tapDedupeUntil) return;

    if (!this.isPlaced) {
      if (!this.reticle.visible) return;
      this._placeModel();
      return;
    }

    if (this._tryInteractFromSelect(event)) return;

    if (this.mode === 'move') {
      this._placeAtReticle();
    }
  }

  _getInteractionCamera() {
    if (this.renderer.xr.isPresenting) {
      return this.renderer.xr.getCamera();
    }
    return this.camera;
  }

  _handleCanvasTap(clientX, clientY) {
    if (!this.isActive || !this.interactionHandler) return;
    if (Date.now() < this._tapDedupeUntil) return;

    this._tapDedupeUntil = Date.now() + 400;

    if (!this.isPlaced) {
      if (this.reticle.visible) this._placeModel();
      return;
    }

    const interaction = this.interactionHandler.raycastAtScreen(
      clientX,
      clientY,
      this._getInteractionCamera(),
    );

    if (interaction) {
      this.interactionHandler.dispatchInteraction(interaction);
      return;
    }

    if (this.mode === 'move' && this.reticle.visible) {
      this._placeAtReticle();
    }
  }

  _tryInteractFromSelect(event) {
    if (!this.isPlaced || !this.interactionHandler) return false;

    const frame = event.frame;
    const referenceSpace = this.referenceSpace;
    if (!frame || !referenceSpace) return false;

    const pose = frame.getPose(event.inputSource.targetRaySpace, referenceSpace);
    if (!pose) return false;

    const origin = new THREE.Vector3(
      pose.transform.position.x,
      pose.transform.position.y,
      pose.transform.position.z,
    );
    const quaternion = new THREE.Quaternion(
      pose.transform.orientation.x,
      pose.transform.orientation.y,
      pose.transform.orientation.z,
      pose.transform.orientation.w,
    );
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion).normalize();

    const raycaster = this.interactionHandler.raycaster;
    const meshes = this.refrigerator.getInteractiveMeshes();
    raycaster.set(origin, direction);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return false;

    const interaction = this.refrigerator.identifyInteraction(hits[0]);
    if (!interaction) return false;

    this._tapDedupeUntil = Date.now() + 400;
    this.interactionHandler.dispatchInteraction(interaction);
    return true;
  }

  _placeModel() {
    this.isPlaced = true;
    this.refrigerator.root.visible = true;
    this.refrigerator.root.matrix.copy(this.reticle.matrix);
    this.refrigerator.root.matrix.decompose(
      this.refrigerator.root.position,
      this.refrigerator.root.quaternion,
      this.refrigerator.root.scale,
    );
    this._placementPosition.copy(this.refrigerator.root.position);
    this._placementQuaternion.copy(this.refrigerator.root.quaternion);
    this._startRotationY = this.refrigerator.root.rotation.y;
    this.reticle.visible = false;
    this._updateHint('Tap doors or freezer to open. Use buttons below to move or rotate.');

    if (this.modelLoader) {
      this.modelLoader.refreshMaterialsForXR(this.renderer, this.refrigerator.root);
    }
  }

  _placeAtReticle() {
    if (!this.reticle.visible) return;
    this.refrigerator.root.matrix.copy(this.reticle.matrix);
    this.refrigerator.root.matrix.decompose(
      this.refrigerator.root.position,
      this.refrigerator.root.quaternion,
      this.refrigerator.root.scale,
    );
    this._placementPosition.copy(this.refrigerator.root.position);
    this._placementQuaternion.copy(this.refrigerator.root.quaternion);
    this._startRotationY = this.refrigerator.root.rotation.y;
  }

  setMode(mode) {
    this.mode = mode;
    this._updateHint(
      mode === 'rotate'
        ? 'Drag horizontally to rotate the refrigerator.'
        : 'Tap a door, freezer, or surface to interact.',
    );
  }

  resetPosition() {
    if (!this.isPlaced) return;
    this.refrigerator.root.position.copy(this._placementPosition);
    this.refrigerator.root.quaternion.copy(this._placementQuaternion);
    this._startRotationY = this.refrigerator.root.rotation.y;
  }

  removeModel() {
    this.isPlaced = false;
    this.refrigerator.root.visible = false;
    this.reticle.visible = true;
    this._updateHint('Point at a flat surface and tap to place the refrigerator.');
  }

  exit() {
    const session = this.renderer.xr.getSession();
    if (session) session.end();
  }

  _updateHint(text) {
    const el = document.getElementById('ar-hint');
    if (el) el.textContent = text;
  }

  onFrame(timestamp, frame) {
    if (!this.isActive || !frame) return;

    const session = frame.session;
    const pose = frame.getViewerPose(this.referenceSpace);
    if (!pose) return;

    if (!this.hitTestSourceRequested) {
      this.hitTestSourceRequested = true;
      session.requestHitTestSource({ space: this.viewerSpace }).then((source) => {
        this.hitTestSource = source;
      }).catch(() => {
        this.hitTestSourceRequested = false;
      });
    }

    if (this.hitTestSource) {
      const hits = frame.getHitTestResults(this.hitTestSource);
      if (hits.length > 0) {
        const hitPose = hits[0].getPose(this.referenceSpace);
        if (hitPose) {
          this._lastHitMatrix.fromArray(hitPose.transform.matrix);
          if (!this.isPlaced) {
            this.reticle.visible = true;
            this.reticle.matrix.copy(this._lastHitMatrix);
          } else if (this.mode === 'move') {
            this.reticle.visible = true;
            this.reticle.matrix.copy(this._lastHitMatrix);
          }
        }
      }
    }

    this._handleTouchRotation(frame);
  }

  _handleTouchRotation(frame) {
    if (!this.isPlaced || this.mode !== 'rotate') return;

    const session = frame.session;
    if (!session.inputSources) return;

    for (const source of session.inputSources) {
      if (!source.gamepad) continue;
      const axes = source.gamepad.axes;
      if (axes && axes.length >= 2 && Math.abs(axes[0]) > 0.15) {
        this.refrigerator.root.rotation.y += axes[0] * 0.04;
      }
    }
  }

  handlePointerMove(clientX, clientY) {
    if (!this.isActive || !this.isPlaced || this.mode !== 'rotate') return;

    if (!this._touchStart) {
      this._touchStart = { x: clientX, y: clientY };
      this._startRotationY = this.refrigerator.root.rotation.y;
      return;
    }

    const dx = clientX - this._touchStart.x;
    this.refrigerator.root.rotation.y = this._startRotationY + dx * 0.005;
  }

  handlePointerEnd() {
    this._touchStart = null;
  }

  bindDomRotation(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (this.isActive && this.isPlaced && this.mode === 'rotate') {
        this._touchStart = { x: e.clientX, y: e.clientY };
        this._startRotationY = this.refrigerator.root.rotation.y;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this._touchStart) this.handlePointerMove(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', () => this.handlePointerEnd());
    canvas.addEventListener('pointercancel', () => this.handlePointerEnd());
  }
}

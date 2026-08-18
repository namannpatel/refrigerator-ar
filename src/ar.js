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
  constructor(sceneManager, refrigerator, interactionHandler, modelLoader = null, productViewer = null) {
    this.sceneManager = sceneManager;
    this.refrigerator = refrigerator;
    this.interactionHandler = interactionHandler;
    this.modelLoader = modelLoader;
    this.productViewer = productViewer;
    this.canvas = sceneManager.canvas;
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
    this._rayMatrix = new THREE.Matrix4();
    this._rayOrigin = new THREE.Vector3();
    this._rayDirection = new THREE.Vector3();
    this._cameraARVideo = null;
    this._cameraARStream = null;
    this._camTouchStart = null;
    this._canvasRestore = null;
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
      this.arMode = 'camera-ar';
      return {
        supported: true,
        mode: 'camera-ar',
        reason: 'camera-ar',
        message:
          'Tap View in AR. Use the door buttons below the model, or pinch and drag to move the view.',
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
    if (this.arMode === 'camera-ar' || this._cameraARVideo || this._cameraARStream) {
      this._endCameraAR();
    }

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

  allowsScreenInteraction() {
    return false;
  }

  updateCameraAR() {
    if (this.arMode !== 'camera-ar' || !this.productViewer) return;
    this.productViewer.controls.update();
  }

  isWebXRSession() {
    return this.isActive && this.arMode === 'webxr';
  }

  _setARSessionUI(active) {
    document.body.classList.toggle('ar-session-active', active);
    const arControls = document.getElementById('ar-controls');
    if (arControls) {
      if (active) arControls.removeAttribute('hidden');
      else arControls.setAttribute('hidden', '');
    }
  }

  _bindCameraARTouches() {
    this._onCameraTouchStart = (event) => {
      if (!this.isActive || this.arMode !== 'camera-ar') return;
      if (event.target.closest('#ar-controls')) return;
      if (event.touches.length !== 1) return;
      this._camTouchStart = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    };

    this._onCameraTouchEnd = (event) => {
      if (!this._camTouchStart || !this.interactionHandler) return;
      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - this._camTouchStart.x;
      const dy = touch.clientY - this._camTouchStart.y;
      this._camTouchStart = null;
      if (Math.hypot(dx, dy) > 18) return;

      const interaction = this.interactionHandler.raycastAtScreen(
        touch.clientX,
        touch.clientY,
        this.camera,
      );
      if (interaction) this.interactionHandler.dispatchInteraction(interaction);
    };

    this.canvas.addEventListener('touchstart', this._onCameraTouchStart, { passive: true });
    this.canvas.addEventListener('touchend', this._onCameraTouchEnd, { passive: true });
  }

  _unbindCameraARTouches() {
    if (this._onCameraTouchStart) {
      this.canvas.removeEventListener('touchstart', this._onCameraTouchStart);
    }
    if (this._onCameraTouchEnd) {
      this.canvas.removeEventListener('touchend', this._onCameraTouchEnd);
    }
    this._onCameraTouchStart = null;
    this._onCameraTouchEnd = null;
    this._camTouchStart = null;
  }

  forceExit() {
    if (this.arMode === 'camera-ar' || this._cameraARVideo || this._cameraARStream) {
      this._endCameraAR();
      return;
    }
    const session = this.renderer.xr.getSession();
    if (session) session.end();
  }

  async start() {
    if (this.isActive) return;

    try {
      if (navigator.xr) {
        try {
          const webxrSupported = await navigator.xr.isSessionSupported('immersive-ar');
          if (webxrSupported) {
            await this._startWebXR();
            return;
          }
        } catch (err) {
          console.warn('WebXR AR not available:', err);
        }
      }

      if (isIOSDevice() && supportsQuickLookLink()) {
        await this._startCameraAR();
        return;
      }

      throw new Error('AR is not supported on this device.');
    } catch (err) {
      this.forceExit();
      throw err;
    }
  }

  _attachCanvasFullscreen() {
    if (this._canvasRestore) return;
    this._canvasRestore = {
      parent: this.canvas.parentNode,
      nextSibling: this.canvas.nextSibling,
    };
    document.body.appendChild(this.canvas);
  }

  _restoreCanvasLayout() {
    if (!this._canvasRestore) return;
    const { parent, nextSibling } = this._canvasRestore;
    if (nextSibling) {
      parent.insertBefore(this.canvas, nextSibling);
    } else {
      parent.appendChild(this.canvas);
    }
    this._canvasRestore = null;
  }

  async _startWebXR() {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['local-floor', 'dom-overlay', 'transient-pointer'],
      domOverlay: { root: document.getElementById('ar-controls') },
    });

    await this.renderer.xr.setSession(session);
    this.arMode = 'webxr';
    this.isActive = true;
  }

  async _startCameraAR() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });

    this._cameraARStream = stream;
    this._cameraARVideo = document.createElement('video');
    this._cameraARVideo.className = 'camera-ar-video';
    this._cameraARVideo.srcObject = stream;
    this._cameraARVideo.playsInline = true;
    this._cameraARVideo.muted = true;
    this._cameraARVideo.setAttribute('playsinline', '');
    document.body.appendChild(this._cameraARVideo);
    await this._cameraARVideo.play();

    document.body.classList.add('camera-ar-active');
    this._setARSessionUI(true);
    this._attachCanvasFullscreen();

    this.sceneManager.setStudioVisible(false);
    this.sceneManager.configureForAR(true);
    this.scene.background = null;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setClearAlpha(0);

    this.sceneManager.productRoot.add(this.refrigerator.root);
    this.refrigerator.root.position.set(0, 0, 0);
    this.refrigerator.root.rotation.set(0, 0, 0);
    this.refrigerator.root.visible = true;
    this.refrigerator.root.updateMatrixWorld(true);

    if (this.modelLoader) {
      this.modelLoader.refreshMaterialsForXR(this.renderer, this.refrigerator.root);
    }

    if (this.productViewer) {
      this.productViewer.configureForCameraAR();
    }

    this.isPlaced = true;
    this.isActive = true;
    this.arMode = 'camera-ar';

    this._placementPosition.set(0, 0, 0);
    this._placementQuaternion.set(0, 0, 0, 1);
    this._startRotationY = 0;

    this._resizeCameraARViewport();
    this.interactionHandler.setPaused?.(true);
    this._bindCameraARTouches();
    this._updateHint('Use door buttons below. Pinch to zoom, drag to rotate.');

    this._onCameraARResize = () => this._resizeCameraARViewport();
    window.addEventListener('resize', this._onCameraARResize);
  }

  _resizeCameraARViewport() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
  }

  _resetCameraARView() {
    if (this.productViewer) {
      this.productViewer.configureForCameraAR();
    }
    this.refrigerator.root.position.set(0, 0, 0);
    this.refrigerator.root.rotation.set(0, 0, 0);
  }

  _endCameraAR() {
    this._unbindCameraARTouches();

    if (this._cameraARStream) {
      this._cameraARStream.getTracks().forEach((track) => track.stop());
      this._cameraARStream = null;
    }
    if (this._cameraARVideo) {
      this._cameraARVideo.remove();
      this._cameraARVideo = null;
    }

    document.body.classList.remove('camera-ar-active');
    this._setARSessionUI(false);
    this._restoreCanvasLayout();

    window.removeEventListener('resize', this._onCameraARResize);
    this._onCameraARResize = null;

    if (this.productViewer) {
      this.productViewer.restoreAfterCameraAR();
    }

    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setClearAlpha(1);
    this.sceneManager.productRoot.add(this.refrigerator.root);
    this.refrigerator.root.position.set(0, 0, 0);
    this.refrigerator.root.rotation.set(0, 0, 0);
    this.refrigerator.root.visible = true;

    this.sceneManager.setStudioVisible(true);
    this.sceneManager.configureForAR(false);
    this.scene.background = this.sceneManager._studioBackground.clone();

    this.isActive = false;
    this.isPlaced = false;
    this.arMode = 'none';

    if (this.interactionHandler) {
      this.interactionHandler.setPaused(false);
    }

    this.sceneManager.resize();
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

    this._setARSessionUI(true);
    this._updateHint('Tap a surface to place. Then use door buttons or tap the model.');

    if (this.modelLoader) {
      this.modelLoader.refreshMaterialsForXR(this.renderer, this.refrigerator.root);
    }

    this._bindImmersiveTapListeners();
  }

  _bindImmersiveTapListeners() {
    this._onWindowPointerDown = (event) => {
      if (!this.isWebXRSession()) return;
      const arControls = document.getElementById('ar-controls');
      if (arControls?.contains(event.target)) return;
      this._canvasPointerDown = true;
      this._canvasDownX = event.clientX;
      this._canvasDownY = event.clientY;
    };

    this._onWindowPointerUp = (event) => {
      if (!this.isWebXRSession() || !this._canvasPointerDown) return;
      const arControls = document.getElementById('ar-controls');
      if (arControls?.contains(event.target)) return;

      this._canvasPointerDown = false;
      const dx = event.clientX - this._canvasDownX;
      const dy = event.clientY - this._canvasDownY;
      if (Math.hypot(dx, dy) > 12) return;
      if (this.isPlaced && this._touchStart) return;

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
    this._setARSessionUI(false);
    document.body.classList.remove('camera-ar-active');

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

    this._placeAtReticle();
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
      { immersive: true },
    );

    if (interaction) {
      this.interactionHandler.dispatchInteraction(interaction);
      return;
    }

    if (this.reticle.visible) {
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

    this._rayMatrix.fromArray(pose.transform.matrix);
    this._rayOrigin.setFromMatrixPosition(this._rayMatrix);
    this._rayDirection.set(0, 0, -1).transformDirection(this._rayMatrix).normalize();

    const raycaster = this.interactionHandler.raycaster;
    const meshes = this.refrigerator.getInteractiveMeshes();
    this.refrigerator.root.updateMatrixWorld(true);
    raycaster.set(this._rayOrigin, this._rayDirection);

    const hits = raycaster.intersectObjects(meshes, false);
    let interaction = null;
    for (const hit of hits) {
      interaction = this.refrigerator.identifyInteraction(hit);
      if (interaction) break;
    }
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
    this._updateHint('Pinch to zoom. Drag to rotate. Tap a surface to reposition.');

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
  }

  resetPosition() {
    if (!this.isPlaced) return;
    if (this.arMode === 'camera-ar') {
      this._resetCameraARView();
      return;
    }
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
    if (this.arMode === 'camera-ar') {
      this._endCameraAR();
      return;
    }
    const session = this.renderer.xr.getSession();
    if (session) session.end();
  }

  _updateHint(text) {
    const el = document.getElementById('ar-hint');
    if (el) el.textContent = text;
  }

  onFrame(timestamp, frame) {
    if (!this.isWebXRSession() || !frame) return;

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
          } else if (this.isPlaced) {
            this.reticle.visible = true;
            this.reticle.matrix.copy(this._lastHitMatrix);
          }
        }
      }
    }

    this._handleTouchRotation(frame);
  }

  _handleTouchRotation(frame) {
    if (!this.isPlaced) return;

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
    if (!this.isWebXRSession() || !this.isPlaced) return;

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
    if (this.interactionHandler) this.interactionHandler.suppressTap = false;
  }

  bindDomRotation(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (this.isWebXRSession() && this.isPlaced) {
        this._touchStart = { x: e.clientX, y: e.clientY };
        this._startRotationY = this.refrigerator.root.rotation.y;
        if (this.interactionHandler) this.interactionHandler.suppressTap = true;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this._touchStart) this.handlePointerMove(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', () => this.handlePointerEnd());
    canvas.addEventListener('pointercancel', () => this.handlePointerEnd());
  }
}

import * as THREE from 'three';

const RETICLE_RING = 0.35;

export class ARSessionManager {
  constructor(sceneManager, refrigerator, interactionHandler) {
    this.sceneManager = sceneManager;
    this.refrigerator = refrigerator;
    this.interactionHandler = interactionHandler;
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
        reason: 'insecure',
        message:
          'WebXR AR requires HTTPS. On your phone, open the https:// link from the dev server (not http://) and accept the certificate warning. LAN IPs like 192.168.x.x do not get a secure-context exception.',
      };
    }

    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isChromeIOS = isIOS && /CriOS/i.test(ua);
    const isSafariIOS = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua);

    if (!navigator.xr) {
      if (isIOS) {
        return {
          supported: false,
          reason: 'no-webxr-ios',
          message:
            'WebXR AR needs iOS 17 or later in Safari. Chrome on iPhone uses the same engine — use Safari, update iOS, and open the site over HTTPS.',
        };
      }
      return {
        supported: false,
        reason: 'no-webxr',
        message: 'This browser does not expose WebXR. Try Safari on iOS 17+ or Chrome on Android with ARCore.',
      };
    }

    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      if (!supported) {
        if (isChromeIOS) {
          return {
            supported: false,
            reason: 'chrome-ios',
            message:
              'Immersive AR is not available in Chrome on iPhone. Use Safari (iOS 17+), HTTPS, and tap View in AR.',
          };
        }
        if (isSafariIOS) {
          return {
            supported: false,
            reason: 'safari-ios-unsupported',
            message:
              'Safari on this iPhone does not report AR support. Update to iOS 17 or later and use HTTPS (not http://).',
          };
        }
        return {
          supported: false,
          reason: 'no-immersive-ar',
          message:
            'Immersive AR is not supported on this device. Android: use Chrome with ARCore. iPhone: Safari on iOS 17+ over HTTPS.',
        };
      }

      return {
        supported: true,
        reason: 'ok',
        message: isSafariIOS
          ? 'AR is available. Tap View in AR and allow camera access.'
          : 'AR is available on this device. Tap View in AR (HTTPS required).',
      };
    } catch {
      return {
        supported: false,
        reason: 'check-failed',
        message: 'Could not verify AR support. Use HTTPS and a compatible browser (Safari iOS 17+ or Android Chrome).',
      };
    }
  }

  async start() {
    if (this.isActive) return;

    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['local-floor', 'dom-overlay'],
      domOverlay: { root: document.getElementById('app') },
    });

    await this.renderer.xr.setSession(session);
    this.isActive = true;
  }

  async _onSessionStart() {
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
  }

  _onSessionEnd() {
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
    document.getElementById('ar-controls').classList.add('hidden');
  }

  _onSelect(event) {
    if (!this.isActive) return;

    if (this._tryInteractFromSelect(event)) return;

    if (!this.isPlaced) {
      if (!this.reticle.visible) return;
      this._placeModel();
      return;
    }

    if (this.mode === 'move') {
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

    const origin = new THREE.Vector3(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
      new THREE.Quaternion(
        pose.transform.orientation.x,
        pose.transform.orientation.y,
        pose.transform.orientation.z,
        pose.transform.orientation.w,
      ),
    );

    const raycaster = this.interactionHandler.raycaster;
    const meshes = this.refrigerator.getInteractiveMeshes();
    raycaster.set(origin, direction.normalize());
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return false;

    const interaction = this.refrigerator.identifyInteraction(hits[0]);
    if (!interaction) return false;

    switch (interaction.type) {
      case 'leftDoor':
        this.refrigerator.toggleLeftDoor();
        break;
      case 'rightDoor':
        this.refrigerator.toggleRightDoor();
        break;
      case 'freezer':
        this.refrigerator.toggleFreezer();
        break;
      case 'display':
        this.interactionHandler.callbacks.onDisplayTap?.();
        break;
      case 'dispenser':
        const msg = this.refrigerator.triggerDispenser(interaction.mode);
        if (msg) this.interactionHandler.callbacks.onDispenser?.(msg);
        break;
      default:
        break;
    }

    this.interactionHandler.callbacks.onDoorChange?.();
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
    this._updateHint('Drag to move or rotate. Tap surface to reposition.');
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
        : 'Tap a surface to move the refrigerator.',
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

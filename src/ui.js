import { FINISHES, PRODUCT } from './config.js';

export class UIManager {
  constructor(app) {
    this.app = app;
    this.finishIndex = 0;
    this.fridgeTemp = 3;
    this.freezerTemp = -18;

    this.elements = {
      loadingScreen: document.getElementById('loading-screen'),
      loadingProgress: document.getElementById('loading-progress'),
      loadingPercent: document.getElementById('loading-percent'),
      errorScreen: document.getElementById('error-screen'),
      errorMessage: document.getElementById('error-message'),
      errorRetry: document.getElementById('error-retry'),
      btnResetView: document.getElementById('btn-reset-view'),
      btnLeftDoor: document.getElementById('btn-left-door'),
      btnRightDoor: document.getElementById('btn-right-door'),
      btnFreezer: document.getElementById('btn-freezer'),
      btnSpecs: document.getElementById('btn-specs'),
      btnFinish: document.getElementById('btn-finish'),
      btnAr: document.getElementById('btn-ar'),
      btnArSecondary: document.getElementById('btn-ar-secondary'),
      arStatus: document.getElementById('ar-status'),
      tempPanel: document.getElementById('temp-panel'),
      tempPanelClose: document.getElementById('temp-panel-close'),
      fridgeTempValue: document.getElementById('fridge-temp-value'),
      freezerTempValue: document.getElementById('freezer-temp-value'),
      fridgeTempUp: document.getElementById('fridge-temp-up'),
      fridgeTempDown: document.getElementById('fridge-temp-down'),
      freezerTempUp: document.getElementById('freezer-temp-up'),
      freezerTempDown: document.getElementById('freezer-temp-down'),
      specsModal: document.getElementById('specs-modal'),
      specsModalClose: document.getElementById('specs-modal-close'),
      specsDetailList: document.getElementById('specs-detail-list'),
      dispenserFeedback: document.getElementById('dispenser-feedback'),
      arLeftDoor: document.getElementById('ar-left-door'),
      arRightDoor: document.getElementById('ar-right-door'),
      arFreezer: document.getElementById('ar-freezer'),
      arReset: document.getElementById('ar-reset'),
      arExit: document.getElementById('ar-exit'),
      iosPrepLeftDoor: document.getElementById('ios-prep-left-door'),
      iosPrepRightDoor: document.getElementById('ios-prep-right-door'),
      iosPrepFreezer: document.getElementById('ios-prep-freezer'),
    };

    this._bindEvents();
    this._populateSpecs();
  }

  _bindEvents() {
    this.elements.errorRetry.addEventListener('click', () => this.app.reload());
    this.elements.btnResetView.addEventListener('click', () => this.app.resetView());
    this.elements.btnLeftDoor.addEventListener('click', () => {
      if (!this.app.refrigerator) return;
      this.app.refrigerator.toggleLeftDoor();
      this.syncDoorButtons();
    });
    this.elements.btnRightDoor.addEventListener('click', () => {
      if (!this.app.refrigerator) return;
      this.app.refrigerator.toggleRightDoor();
      this.syncDoorButtons();
    });
    this.elements.btnFreezer.addEventListener('click', () => {
      if (!this.app.refrigerator) return;
      this.app.refrigerator.toggleFreezer();
      this.syncDoorButtons();
    });
    this.elements.btnSpecs.addEventListener('click', () => this.elements.specsModal.showModal());
    this.elements.specsModalClose.addEventListener('click', () => this.elements.specsModal.close());
    this.elements.btnFinish.addEventListener('click', () => this.cycleFinish());
    this.elements.btnAr.addEventListener('click', () => this.app.startAR());
    this.elements.btnArSecondary.addEventListener('click', () => this.app.startAR());

    this.elements.tempPanelClose.addEventListener('click', () => this.elements.tempPanel.close());
    this.elements.fridgeTempUp.addEventListener('click', () => this.adjustTemp('fridge', 1));
    this.elements.fridgeTempDown.addEventListener('click', () => this.adjustTemp('fridge', -1));
    this.elements.freezerTempUp.addEventListener('click', () => this.adjustTemp('freezer', 1));
    this.elements.freezerTempDown.addEventListener('click', () => this.adjustTemp('freezer', -1));

    if (this.elements.arLeftDoor) {
      this.elements.arLeftDoor.addEventListener('click', () => this._toggleDoor('left'));
    }
    if (this.elements.arRightDoor) {
      this.elements.arRightDoor.addEventListener('click', () => this._toggleDoor('right'));
    }
    if (this.elements.arFreezer) {
      this.elements.arFreezer.addEventListener('click', () => this._toggleDoor('freezer'));
    }
    if (this.elements.iosPrepLeftDoor) {
      this.elements.iosPrepLeftDoor.addEventListener('click', () => this._toggleDoor('left'));
    }
    if (this.elements.iosPrepRightDoor) {
      this.elements.iosPrepRightDoor.addEventListener('click', () => this._toggleDoor('right'));
    }
    if (this.elements.iosPrepFreezer) {
      this.elements.iosPrepFreezer.addEventListener('click', () => this._toggleDoor('freezer'));
    }
    this.elements.arReset.addEventListener('click', () => this.app.arManager?.resetPosition());
    this.elements.arExit.addEventListener('click', () => this.app.arManager?.exit());
  }

  _populateSpecs() {
    this.elements.specsDetailList.innerHTML = PRODUCT.specs
      .map((s) => `<dt>${s.label}</dt><dd>${s.value}</dd>`)
      .join('');
  }

  setLoadingProgress(ratio) {
    const pct = Math.round(ratio * 100);
    this.elements.loadingProgress.style.width = `${pct}%`;
    this.elements.loadingPercent.textContent = `${pct}%`;
  }

  hideLoading() {
    this.elements.loadingScreen.classList.add('hidden');
  }

  showError(message) {
    this.elements.loadingScreen.classList.add('hidden');
    this.elements.errorScreen.classList.remove('hidden');
    this.elements.errorMessage.textContent = message;
  }

  setArSupported(supported, message, mode = 'none') {
    if (!supported) {
      this.elements.btnAr.disabled = true;
      this.elements.btnArSecondary.disabled = true;
      this.elements.arStatus.textContent =
        message || 'AR is not supported on this device/browser. You can still explore the 3D model.';
      return;
    }

    this.elements.btnAr.disabled = false;
    this.elements.btnArSecondary.disabled = false;

    const modeNote =
      mode === 'quick-look'
        ? ' On iPhone, set doors with the toolbar buttons before View in AR.'
        : mode === 'webxr'
          ? ' Door buttons appear at the bottom while you are in AR.'
          : '';
    this.elements.arStatus.textContent = `${message || 'AR available. Tap View in AR on your phone (HTTPS required).'}${modeNote}`;
  }

  openTempPanel() {
    this.elements.tempPanel.showModal();
  }

  showDispenserFeedback(message) {
    const el = this.elements.dispenserFeedback;
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(this._dispenserTimer);
    this._dispenserTimer = setTimeout(() => el.classList.add('hidden'), 2000);
  }

  adjustTemp(zone, delta) {
    if (zone === 'fridge') {
      this.fridgeTemp = Math.min(8, Math.max(0, this.fridgeTemp + delta));
      this.elements.fridgeTempValue.textContent = `${this.fridgeTemp}°C`;
    } else {
      this.freezerTemp = Math.min(-12, Math.max(-24, this.freezerTemp + delta));
      this.elements.freezerTempValue.textContent = `${this.freezerTemp}°C`;
    }
  }

  cycleFinish() {
    this.finishIndex = (this.finishIndex + 1) % FINISHES.length;
    const finish = FINISHES[this.finishIndex];
    this.app.setFinish(finish);
    this.elements.btnFinish.textContent = `Finish: ${finish.name}`;
  }

  _toggleDoor(which) {
    if (!this.app.refrigerator) return;
    if (which === 'left') this.app.refrigerator.toggleLeftDoor();
    else if (which === 'right') this.app.refrigerator.toggleRightDoor();
    else this.app.refrigerator.toggleFreezer();
    this.syncDoorButtons();
  }

  syncDoorButtons() {
    const r = this.app.refrigerator;
    const leftLabel = r.state.leftDoorOpen ? 'Close Left Door' : 'Open Left Door';
    const rightLabel = r.state.rightDoorOpen ? 'Close Right Door' : 'Open Right Door';
    const freezerLabel = r.state.freezerOpen ? 'Close Freezer' : 'Open Freezer';

    this.elements.btnLeftDoor.textContent = leftLabel;
    this.elements.btnRightDoor.textContent = rightLabel;
    this.elements.btnFreezer.textContent = freezerLabel;

    if (this.elements.arLeftDoor) this.elements.arLeftDoor.textContent = leftLabel;
    if (this.elements.arRightDoor) this.elements.arRightDoor.textContent = rightLabel;
    if (this.elements.arFreezer) this.elements.arFreezer.textContent = freezerLabel;
    if (this.elements.iosPrepLeftDoor) this.elements.iosPrepLeftDoor.textContent = leftLabel;
    if (this.elements.iosPrepRightDoor) this.elements.iosPrepRightDoor.textContent = rightLabel;
    if (this.elements.iosPrepFreezer) this.elements.iosPrepFreezer.textContent = freezerLabel;
  }
}

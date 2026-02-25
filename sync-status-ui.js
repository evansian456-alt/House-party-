/**
 * Sync Status UI Manager
 * 
 * Manages visual sync status indicators:
 * - "Synced" indicator (green)
 * - "Correcting sync..." (orange) for drift > 100ms
 * - "Resyncing" toast (purple) for hard resync
 * - Toggleable debug panel with drift/RTT/offset/correction
 */

class SyncStatusUI {
  constructor() {
    this.indicator = document.getElementById('syncStatusIndicator');
    this.icon = this.indicator?.querySelector('.sync-icon');
    this.text = this.indicator?.querySelector('.sync-text');
    this.debugPanel = document.getElementById('syncDebugPanel');
    this.toastTimeout = null;
    
    // Debug panel elements
    this.debugDrift = document.getElementById('debugDrift');
    this.debugRTT = document.getElementById('debugRTT');
    this.debugOffset = document.getElementById('debugOffset');
    this.debugCorrection = document.getElementById('debugCorrection');
    this.debugSyncQuality = document.getElementById('debugSyncQuality');
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Close debug panel
    const btnCloseDebug = document.getElementById('btnCloseDebug');
    if (btnCloseDebug) {
      btnCloseDebug.addEventListener('click', () => this.hideDebugPanel());
    }

    // Toggle debug panel with keyboard shortcut (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        this.toggleDebugPanel();
        e.preventDefault();
      }
    });
  }

  /**
   * Update sync status
   * @param {string} status - 'synced', 'correcting', 'resyncing'
   */
  updateStatus(status) {
    if (!this.indicator) return;

    // Remove all status classes
    this.indicator.classList.remove('synced', 'correcting', 'resyncing');
    
    // Add new status class
    this.indicator.classList.add(status);

    // Update text and icon
    switch (status) {
      case 'synced':
        this.icon.textContent = '✓';
        this.text.textContent = 'Synced';
        break;
      case 'correcting':
        this.icon.textContent = '⟳';
        this.text.textContent = 'Correcting sync...';
        break;
      case 'resyncing':
        this.icon.textContent = '⟳';
        this.text.textContent = 'Resyncing';
        this.showResyncToast();
        break;
    }
  }

  /**
   * Show brief "Resyncing" toast notification
   */
  showResyncToast() {
    // Remove existing toast if any
    const existingToast = document.querySelector('.resync-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'resync-toast';
    toast.textContent = '⟳ Resyncing...';
    document.body.appendChild(toast);

    // Remove after 3 seconds
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Update debug panel values
   */
  updateDebugPanel(data) {
    if (!this.debugPanel) return;

    const { driftMs, rttMs, offsetMs, correctionType, syncQuality } = data;

    if (this.debugDrift) {
      this.debugDrift.textContent = `${Math.round(driftMs)}ms`;
      // Color code drift
      if (Math.abs(driftMs) < 100) {
        this.debugDrift.style.color = '#00ff00';
      } else if (Math.abs(driftMs) < 1000) {
        this.debugDrift.style.color = '#ffa500';
      } else {
        this.debugDrift.style.color = '#ff4444';
      }
    }

    if (this.debugRTT) {
      this.debugRTT.textContent = `${Math.round(rttMs)}ms`;
      // Color code RTT
      if (rttMs < 100) {
        this.debugRTT.style.color = '#00ff00';
      } else if (rttMs < 300) {
        this.debugRTT.style.color = '#ffa500';
      } else {
        this.debugRTT.style.color = '#ff4444';
      }
    }

    if (this.debugOffset) {
      this.debugOffset.textContent = `${Math.round(offsetMs)}ms`;
    }

    if (this.debugCorrection) {
      this.debugCorrection.textContent = correctionType || 'None';
      // Color code correction type
      if (correctionType === 'hard') {
        this.debugCorrection.style.color = '#ff4444';
      } else if (correctionType === 'soft') {
        this.debugCorrection.style.color = '#ffa500';
      } else {
        this.debugCorrection.style.color = '#00ff00';
      }
    }

    if (this.debugSyncQuality) {
      this.debugSyncQuality.textContent = syncQuality || 'Unknown';
      // Color code quality
      if (syncQuality === 'excellent') {
        this.debugSyncQuality.style.color = '#00ff00';
      } else if (syncQuality === 'good') {
        this.debugSyncQuality.style.color = '#00d4ff';
      } else {
        this.debugSyncQuality.style.color = '#ffa500';
      }
    }
  }

  /**
   * Show debug panel
   */
  showDebugPanel() {
    if (this.debugPanel) {
      this.debugPanel.classList.remove('hidden');
    }
  }

  /**
   * Hide debug panel
   */
  hideDebugPanel() {
    if (this.debugPanel) {
      this.debugPanel.classList.add('hidden');
    }
  }

  /**
   * Toggle debug panel visibility
   */
  toggleDebugPanel() {
    if (this.debugPanel) {
      this.debugPanel.classList.toggle('hidden');
    }
  }

  /**
   * Monitor drift and update status automatically
   */
  monitorDrift(driftMs, correctionType) {
    // Update status based on drift
    if (Math.abs(driftMs) < 100) {
      this.updateStatus('synced');
    } else if (correctionType === 'hard') {
      this.updateStatus('resyncing');
    } else {
      // Drift >= 100ms without hard correction
      this.updateStatus('correcting');
    }
  }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncStatusUI;
}

/**
 * Referral UI Manager
 * 
 * Manages referral system UI:
 * - Fetch and display referral stats
 * - Show invite link
 * - Copy/share functionality
 * - Progress toward rewards
 */

class ReferralUI {
  constructor() {
    this.modal = document.getElementById('modalReferral');
    this.btnReferral = document.getElementById('btnReferral');
    this.btnClose = document.getElementById('btnCloseReferralModal');
    this.btnCopyLink = document.getElementById('btnCopyReferralLink');
    this.btnShareLink = document.getElementById('btnShareReferralLink');
    
    // Display elements
    this.totalCount = document.getElementById('referralTotalCount');
    this.paidCount = document.getElementById('referralPaidCount');
    this.rewardsEarned = document.getElementById('referralRewardsEarned');
    this.progress = document.getElementById('referralProgress');
    this.progressBar = document.getElementById('referralProgressBar');
    this.codeDisplay = document.getElementById('referralCodeDisplay');
    this.linkInput = document.getElementById('referralLinkInput');
    
    this.stats = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.btnReferral) {
      this.btnReferral.addEventListener('click', () => this.show());
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.hide());
    }

    if (this.btnCopyLink) {
      this.btnCopyLink.addEventListener('click', () => this.copyLink());
    }

    if (this.btnShareLink) {
      this.btnShareLink.addEventListener('click', () => this.shareLink());
    }

    // Close on click outside
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.hide();
        }
      });
    }
  }

  /**
   * Show referral modal and load stats
   */
  async show() {
    if (!this.modal) return;
    
    this.modal.classList.remove('hidden');
    await this.loadStats();
  }

  /**
   * Hide referral modal
   */
  hide() {
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
  }

  /**
   * Load referral stats from API
   */
  async loadStats() {
    try {
      const response = await fetch('/api/referral/stats', {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load referral stats');
      }

      this.stats = await response.json();
      this.updateUI();
    } catch (error) {
      console.error('[Referral] Error loading stats:', error);
      this.showError();
    }
  }

  /**
   * Update UI with loaded stats
   */
  updateUI() {
    if (!this.stats) return;

    // Update counts
    if (this.totalCount) {
      this.totalCount.textContent = this.stats.totalReferrals || 0;
    }

    if (this.paidCount) {
      this.paidCount.textContent = this.stats.paidReferrals || 0;
    }

    if (this.rewardsEarned) {
      this.rewardsEarned.textContent = this.stats.rewardsEarned || 0;
    }

    // Update progress
    const progressValue = this.stats.progressTowardReward || 0;
    if (this.progress) {
      this.progress.textContent = `${progressValue}/5`;
    }

    if (this.progressBar) {
      const percentage = (progressValue / 5) * 100;
      this.progressBar.style.width = `${percentage}%`;
    }

    // Update code and link
    if (this.codeDisplay && this.stats.referralCode) {
      this.codeDisplay.textContent = this.stats.referralCode;
    }

    if (this.linkInput && this.stats.inviteLink) {
      this.linkInput.value = this.stats.inviteLink;
    }
  }

  /**
   * Show error state
   */
  showError() {
    if (this.codeDisplay) {
      this.codeDisplay.textContent = 'ERROR';
    }
    if (this.linkInput) {
      this.linkInput.value = 'Unable to load referral link';
    }
  }

  /**
   * Copy referral link to clipboard
   */
  async copyLink() {
    if (!this.linkInput) return;

    try {
      await navigator.clipboard.writeText(this.linkInput.value);
      
      // Show success feedback
      const originalText = this.btnCopyLink.textContent;
      this.btnCopyLink.textContent = '✓ Copied!';
      this.btnCopyLink.style.background = 'rgba(0, 255, 0, 0.3)';
      
      setTimeout(() => {
        this.btnCopyLink.textContent = originalText;
        this.btnCopyLink.style.background = '';
      }, 2000);
    } catch (error) {
      console.error('[Referral] Failed to copy link:', error);
      
      // Fallback: select text for older browsers
      // Note: document.execCommand is deprecated but kept for legacy browser support
      this.linkInput.select();
      document.execCommand('copy');
      
      const originalText = this.btnCopyLink.textContent;
      this.btnCopyLink.textContent = '✓ Copied!';
      setTimeout(() => {
        this.btnCopyLink.textContent = originalText;
      }, 2000);
    }
  }

  /**
   * Share referral link using Web Share API
   */
  async shareLink() {
    if (!this.stats || !this.stats.inviteLink) return;

    const shareData = {
      title: 'Join Phone Party!',
      text: 'Turn your phones into a massive party speaker system. Check it out!',
      url: this.stats.inviteLink
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy link
        await this.copyLink();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('[Referral] Error sharing:', error);
      }
    }
  }

  /**
   * Show/hide referral button based on role
   */
  setVisible(isHost) {
    if (this.btnReferral) {
      if (isHost) {
        this.btnReferral.classList.remove('hidden');
      } else {
        this.btnReferral.classList.add('hidden');
      }
    }
  }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReferralUI;
}

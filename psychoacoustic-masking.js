/**
 * Psychoacoustic Sync Masking
 *
 * Applies perceptual masking techniques so minor timing drift between
 * devices is less noticeable to human listeners during live parties.
 *
 * Techniques implemented:
 *   1. Soft-start volume ramp  — hides tiny start-time differences between devices
 *   2. Micro-fade around seeks — prevents audible "pop" artifacts on drift corrections
 *   3. Transient-aware resync  — avoids corrections during the first 300ms of playback
 *   4. Micro playback-rate nudge — gradually corrects small drift (<120ms) without jumps
 *
 * Designed to work alongside the existing PLL/NTP sync engine (sync-engine.js)
 * and the client drift controller (drift-controller-client.js).
 *
 * Browser-safe: uses setTimeout for timing so it works in both DOM and Node
 * environments (for testing).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Technique 1: duration of the soft-start ramp in milliseconds (80–120ms range) */
const SOFT_START_RAMP_MS = 100;

/** Technique 2: target volume during seek micro-fade (slightly below unity) */
const SEEK_FADE_TARGET_VOLUME = 0.85;

/** Technique 2: total time for the fade-out → seek → fade-in cycle, ms */
const SEEK_FADE_TOTAL_MS = 90;

/** Technique 3: guard window at the start of a track where corrections are blocked, ms */
const TRANSIENT_GUARD_MS = 300;

/** Technique 4: maximum drift magnitude that triggers a rate nudge instead of a seek, ms */
const RATE_NUDGE_MAX_DRIFT_MS = 120;

/** Technique 4: playback rate applied when device is behind the master clock */
const RATE_NUDGE_FAST = 1.02;

/** Technique 4: playback rate applied when device is ahead of the master clock */
const RATE_NUDGE_SLOW = 0.98;

/** Technique 4: how long the rate nudge is held before returning to 1.0, ms */
const RATE_NUDGE_DURATION_MS = 1500;

/** Tolerance for considering playbackRate "equal" when deciding whether to restore it */
const PLAYBACK_RATE_TOLERANCE = 0.001;

/** Number of volume steps used for ramp animation */
const RAMP_STEPS = 10;

// ─── Volume ramp helper ────────────────────────────────────────────────────────

/**
 * Smoothly animate an audio element's volume from `fromVol` to `toVol`
 * over `durationMs` using a sequence of small setTimeout steps.
 *
 * @param {HTMLAudioElement} audioElement - Target audio element
 * @param {number} fromVol   - Starting volume (0–1)
 * @param {number} toVol     - Ending volume (0–1)
 * @param {number} durationMs - Total ramp duration in milliseconds
 * @param {Function|null} [onComplete] - Called when the ramp finishes
 * @returns {number[]} Array of timer IDs that can be passed to clearTimeout() for cancellation
 */
function _rampVolume(audioElement, fromVol, toVol, durationMs, onComplete) {
  const timerIds = [];
  const stepMs = durationMs / RAMP_STEPS;
  const stepDelta = (toVol - fromVol) / RAMP_STEPS;

  // Set the starting volume immediately
  audioElement.volume = Math.max(0, Math.min(1, fromVol));

  for (let i = 1; i <= RAMP_STEPS; i++) {
    const delay = stepMs * i;
    const targetVol = i === RAMP_STEPS
      ? toVol
      : Math.max(0, Math.min(1, fromVol + stepDelta * i));

    const id = setTimeout(() => {
      audioElement.volume = targetVol;
      if (i === RAMP_STEPS && typeof onComplete === 'function') {
        onComplete();
      }
    }, delay);

    timerIds.push(id);
  }

  return timerIds;
}

// ─── PsychoacousticMasking ─────────────────────────────────────────────────────

/**
 * Static utility class providing psychoacoustic masking helpers.
 * All methods are safe to call even when the audio element is null/undefined.
 */
class PsychoacousticMasking {
  // ── Technique 1: Soft-Start Ramp ─────────────────────────────────────────

  /**
   * Ramp the audio element volume from 0 → 1 over `durationMs`.
   * Call this immediately after starting playback to mask tiny
   * inter-device start-time differences.
   *
   * @param {HTMLAudioElement} audioElement
   * @param {number} [durationMs=SOFT_START_RAMP_MS] - Ramp duration (80–120ms)
   * @returns {number[]} Timer IDs (can be ignored; cancel if playback stops early)
   */
  static softStartRamp(audioElement, durationMs = SOFT_START_RAMP_MS) {
    if (!audioElement) return [];
    return _rampVolume(audioElement, 0, 1, durationMs, null);
  }

  // ── Technique 2: Micro-Fade Around Seek ──────────────────────────────────

  /**
   * Fade volume down, perform a seek, then fade back up.
   * Prevents audible click/pop artifacts when correcting drift.
   *
   * @param {HTMLAudioElement} audioElement
   * @param {number} seekTargetSec - Target playback position in seconds
   * @param {Object}  [options]
   * @param {number}  [options.fadeVolume=SEEK_FADE_TARGET_VOLUME] - Volume floor during fade
   * @param {number}  [options.totalMs=SEEK_FADE_TOTAL_MS]         - Total fade cycle ms
   * @param {Function} [options.onComplete] - Called after the full fade-seek-fade cycle
   */
  static seekWithMicroFade(audioElement, seekTargetSec, options = {}) {
    if (!audioElement) return;

    const {
      fadeVolume = SEEK_FADE_TARGET_VOLUME,
      totalMs = SEEK_FADE_TOTAL_MS,
      onComplete,
    } = options;

    const halfMs = totalMs / 2;
    const currentVol = audioElement.volume;

    // Phase 1: Fade down
    _rampVolume(audioElement, currentVol, fadeVolume, halfMs, () => {
      // Perform the seek at the volume trough (least audible moment)
      try {
        audioElement.currentTime = seekTargetSec;
      } catch (_) {
        // Ignore seek errors (e.g. media not ready)
      }

      // Phase 2: Fade back up
      _rampVolume(audioElement, fadeVolume, currentVol, halfMs, () => {
        if (typeof onComplete === 'function') onComplete();
      });
    });
  }

  // ── Technique 3: Transient-Aware Resync Guard ─────────────────────────────

  /**
   * Returns true if `nowMs` falls within the transient guard window that starts
   * at `trackStartTimeMs`.  Drift corrections should be skipped while this
   * returns true.
   *
   * @param {number} trackStartTimeMs - Timestamp (ms) when the current track began
   * @param {number} [nowMs=Date.now()]
   * @returns {boolean}
   */
  static isInTransientPeriod(trackStartTimeMs, nowMs = Date.now()) {
    if (!trackStartTimeMs) return false;
    return (nowMs - trackStartTimeMs) < TRANSIENT_GUARD_MS;
  }

  // ── Technique 4: Micro Playback-Rate Nudge ────────────────────────────────

  /**
   * Gradually correct small drift (< RATE_NUDGE_MAX_DRIFT_MS) by temporarily
   * adjusting the playback rate rather than seeking.
   *
   * Only applied to HTML audio elements (uploads/direct audio).
   * Do NOT call for YouTube iframes.
   *
   * @param {HTMLAudioElement} audioElement
   * @param {number} driftMs - Observed drift in ms (positive = device ahead, negative = behind)
   * @param {Object}  [options]
   * @param {number}  [options.maxDriftMs=RATE_NUDGE_MAX_DRIFT_MS]  - Threshold for nudge
   * @param {number}  [options.nudgeDurationMs=RATE_NUDGE_DURATION_MS] - How long to hold rate
   * @param {Function} [options.onComplete] - Called when rate is restored to 1.0
   * @returns {boolean} true if a nudge was applied
   */
  static applyMicroRateNudge(audioElement, driftMs, options = {}) {
    if (!audioElement) return false;

    const {
      maxDriftMs = RATE_NUDGE_MAX_DRIFT_MS,
      nudgeDurationMs = RATE_NUDGE_DURATION_MS,
      onComplete,
    } = options;

    if (Math.abs(driftMs) > maxDriftMs) return false;

    // Positive drift → device is ahead → slow down
    // Negative drift → device is behind → speed up
    const nudgeRate = driftMs > 0 ? RATE_NUDGE_SLOW : RATE_NUDGE_FAST;

    audioElement.playbackRate = nudgeRate;

    setTimeout(() => {
      // Restore only if we still own the rate (avoid fighting with other corrections)
      if (
        audioElement.playbackRate === nudgeRate ||
        Math.abs(audioElement.playbackRate - nudgeRate) < PLAYBACK_RATE_TOLERANCE
      ) {
        audioElement.playbackRate = 1.0;
      }
      if (typeof onComplete === 'function') onComplete();
    }, nudgeDurationMs);

    return true;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

// Export constants so callers can reference thresholds without magic numbers
PsychoacousticMasking.SOFT_START_RAMP_MS = SOFT_START_RAMP_MS;
PsychoacousticMasking.SEEK_FADE_TARGET_VOLUME = SEEK_FADE_TARGET_VOLUME;
PsychoacousticMasking.SEEK_FADE_TOTAL_MS = SEEK_FADE_TOTAL_MS;
PsychoacousticMasking.TRANSIENT_GUARD_MS = TRANSIENT_GUARD_MS;
PsychoacousticMasking.RATE_NUDGE_MAX_DRIFT_MS = RATE_NUDGE_MAX_DRIFT_MS;
PsychoacousticMasking.RATE_NUDGE_FAST = RATE_NUDGE_FAST;
PsychoacousticMasking.RATE_NUDGE_SLOW = RATE_NUDGE_SLOW;
PsychoacousticMasking.RATE_NUDGE_DURATION_MS = RATE_NUDGE_DURATION_MS;

if (typeof window !== 'undefined') {
  window.PsychoacousticMasking = PsychoacousticMasking;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PsychoacousticMasking };
}

/**
 * Alert System — DetoxVision
 * Manages real-time alerts with sound and visual notifications
 */
const AlertSystem = (() => {
    let isEnabled = true;
    let cooldownMs = 5000; // min time between same-behavior alerts
    let lastAlerts = {};
    let alertListeners = [];
    let unreadCount = 0;

    // Audio context for alert sounds
    let audioCtx = null;

    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playAlertSound() {
        try {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);

            // Second beep
            setTimeout(() => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(660, ctx.currentTime);
                gain2.gain.setValueAtTime(0.2, ctx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc2.start(ctx.currentTime);
                osc2.stop(ctx.currentTime + 0.3);
            }, 200);
        } catch (e) {
            console.warn('Audio alert failed:', e);
        }
    }

    function showOverlay(behavior, confidence) {
        const overlay = document.getElementById('alert-overlay');
        const msg = document.getElementById('alert-message');
        const conf = document.getElementById('alert-confidence');
        const time = document.getElementById('alert-time');

        const behaviorLabels = {
            'touching_pocket': '🤚 Subject is touching their pocket',
            'eye_darting': '👁️ Rapid eye movement / darting detected',
            'reaching': '🖐️ Suspicious reaching gesture detected',
            'suspicious': '⚠️ General suspicious behavior detected',
            'looking_around': '👀 Subject looking around nervously'
        };

        msg.textContent = behaviorLabels[behavior] || `Behavior detected: ${behavior}`;
        conf.textContent = `Confidence: ${(confidence * 100).toFixed(1)}%`;
        time.textContent = new Date().toLocaleTimeString();
        overlay.classList.remove('hidden');

        playAlertSound();
    }

    function hideOverlay() {
        document.getElementById('alert-overlay').classList.add('hidden');
    }

    async function trigger(behavior, confidence, frame) {
        if (!isEnabled) return;

        // Cooldown check
        const now = Date.now();
        if (lastAlerts[behavior] && (now - lastAlerts[behavior]) < cooldownMs) return;
        lastAlerts[behavior] = now;

        // Store alert
        const alert = {
            behavior,
            confidence,
            frame: frame || null,
            dismissed: false
        };
        await DetoxDB.addAlert(alert);
        await DetoxDB.incrementStat('totalAlerts');

        // Update unread count
        unreadCount++;
        updateBadge();

        // Show overlay
        showOverlay(behavior, confidence);

        // Notify listeners
        alertListeners.forEach(fn => fn(alert));
    }

    function updateBadge() {
        const badge = document.getElementById('alert-count-badge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    function clearUnread() {
        unreadCount = 0;
        updateBadge();
    }

    function onAlert(fn) {
        alertListeners.push(fn);
    }

    function setEnabled(val) { isEnabled = val; }
    function setCooldown(ms) { cooldownMs = ms; }

    // Init dismiss button
    function init() {
        const dismissBtn = document.getElementById('alert-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', hideOverlay);
        }
    }

    return { init, trigger, onAlert, clearUnread, setEnabled, setCooldown, hideOverlay, updateBadge };
})();

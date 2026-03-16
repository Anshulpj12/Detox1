/**
 * Live Processing Page — DetoxVision
 * Continuous real-time webcam monitoring with behavior detection,
 * session tracking, live stats, and heatmap-style behavior breakdown
 */
const LivePage = (() => {
    let webcamStream = null;
    let isProcessing = false;
    let animFrame = null;
    let sessionStart = null;
    let sessionTimer = null;
    let sessionStats = { totalFrames: 0, alerts: 0, behaviors: {} };
    let liveHistory = [];
    let alertThreshold = 0.65;

    function render() {
        const container = document.getElementById('live-content');
        container.innerHTML = `
            <!-- Setup Panel -->
            <div class="glass-card" id="live-setup-panel">
                <div class="glass-card-header">
                    <div>
                        <div class="glass-card-title">Live Monitoring Setup</div>
                        <div class="glass-card-subtitle">Configure and start real-time behavior monitoring</div>
                    </div>
                </div>

                <div class="stats-grid" style="margin-bottom:20px;">
                    <div class="form-group">
                        <label class="form-label">Camera Source</label>
                        <select class="form-select" id="live-camera-select">
                            <option value="user">Front Camera</option>
                            <option value="environment">Back Camera</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Alert Sensitivity</label>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <input type="range" id="live-threshold" min="30" max="95" value="65" style="flex:1;accent-color:var(--accent-cyan);">
                            <span id="live-threshold-val" style="font-size:0.85rem;color:var(--accent-cyan);font-weight:700;min-width:36px;">65%</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Alert Sound</label>
                        <select class="form-select" id="live-sound-select">
                            <option value="on">🔔 Enabled</option>
                            <option value="off">🔕 Disabled</option>
                        </select>
                    </div>
                </div>

                <div id="live-model-warning" style="display:none;margin-bottom:16px;padding:12px 16px;border-radius:var(--radius-sm);background:rgba(255,190,11,0.1);color:var(--accent-amber);font-size:0.85rem;">
                    ⚠️ No model loaded. Please go to <strong>Training</strong> to train a model first, or import an existing model.
                </div>

                <div style="display:flex;gap:12px;">
                    <button class="btn btn-primary" id="live-start-btn" style="font-size:1rem;padding:14px 36px;">
                        📡 Start Live Monitoring
                    </button>
                </div>
            </div>

            <!-- Live Monitor (hidden until started) -->
            <div id="live-monitor" style="display:none;">
                <!-- Main Grid -->
                <div class="detection-panel">
                    <div>
                        <!-- Live Feed -->
                        <div class="video-container" id="live-video-container">
                            <video id="live-video" autoplay playsinline muted></video>
                            <canvas id="live-canvas"></canvas>
                            <!-- Status overlay -->
                            <div id="live-status-overlay" style="position:absolute;top:12px;right:12px;display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                                <div style="background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:12px;font-size:0.75rem;display:flex;align-items:center;gap:6px;">
                                    <span class="live-dot"></span>
                                    <span style="color:var(--accent-green);font-weight:600;">LIVE</span>
                                </div>
                                <div id="live-fps-badge" style="background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:12px;font-size:0.72rem;color:var(--text-muted);">0 FPS</div>
                            </div>
                            <!-- Current behavior banner -->
                            <div id="live-behavior-banner" style="position:absolute;bottom:12px;left:12px;right:12px;display:none;">
                                <div style="background:rgba(239,71,111,0.9);padding:8px 16px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;">
                                    <span id="live-behavior-text" style="font-weight:700;color:white;font-size:0.9rem;"></span>
                                    <span id="live-behavior-conf" style="color:rgba(255,255,255,0.8);font-size:0.8rem;"></span>
                                </div>
                            </div>
                        </div>

                        <!-- Controls -->
                        <div style="margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                            <button class="btn btn-danger" id="live-stop-btn">⏹ Stop Monitoring</button>
                            <button class="btn btn-outline btn-sm" id="live-screenshot-btn">📸 Screenshot</button>
                            <span id="live-frame-count" style="font-size:0.78rem;color:var(--text-muted);margin-left:auto;">Frames: 0</span>
                        </div>
                    </div>

                    <!-- Right Sidebar -->
                    <div class="detection-sidebar">
                        <!-- Current Detection -->
                        <div class="glass-card" style="padding:16px;">
                            <div style="font-weight:700;margin-bottom:12px;">🎯 Current Detection</div>
                            <div id="live-current-results">
                                <div class="empty-state" style="padding:12px 0;"><div class="empty-state-desc" style="font-size:0.8rem;">Analyzing...</div></div>
                            </div>
                        </div>

                        <!-- Session Stats -->
                        <div class="glass-card" style="padding:16px;">
                            <div style="font-weight:700;margin-bottom:12px;">📊 Session Stats</div>
                            <div id="live-session-stats">
                                <div class="detection-result" style="margin-bottom:6px;">
                                    <span class="detection-result-label">Frames Analyzed</span>
                                    <span class="detection-result-value" id="stat-frames">0</span>
                                </div>
                                <div class="detection-result" style="margin-bottom:6px;">
                                    <span class="detection-result-label">Alerts Triggered</span>
                                    <span class="detection-result-value" id="stat-alerts" style="color:var(--accent-red);">0</span>
                                </div>
                                <div class="detection-result" style="margin-bottom:6px;">
                                    <span class="detection-result-label">Duration</span>
                                    <span class="detection-result-value" id="stat-duration">00:00</span>
                                </div>
                            </div>
                        </div>

                        <!-- Behavior Breakdown -->
                        <div class="glass-card" style="padding:16px;">
                            <div style="font-weight:700;margin-bottom:12px;">🔬 Behavior Breakdown</div>
                            <div id="live-behavior-breakdown">
                                <div class="empty-state" style="padding:12px 0;"><div class="empty-state-desc" style="font-size:0.8rem;">No data yet</div></div>
                            </div>
                        </div>

                        <!-- Live Event Feed -->
                        <div class="glass-card" style="padding:16px;">
                            <div style="font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;">
                                <span>⚡ Live Events</span>
                                <span id="live-event-count" style="font-size:0.72rem;color:var(--text-muted);">0</span>
                            </div>
                            <div id="live-event-feed" style="max-height:250px;overflow-y:auto;">
                                <div class="empty-state" style="padding:12px 0;"><div class="empty-state-desc" style="font-size:0.8rem;">Waiting for events...</div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        initLiveEvents();
        checkModelStatus();
    }

    function checkModelStatus() {
        const warning = document.getElementById('live-model-warning');
        if (!MLEngine.isReady()) {
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    }

    function initLiveEvents() {
        document.getElementById('live-start-btn')?.addEventListener('click', startLiveMonitoring);
        document.getElementById('live-stop-btn')?.addEventListener('click', stopLiveMonitoring);
        document.getElementById('live-screenshot-btn')?.addEventListener('click', takeScreenshot);

        document.getElementById('live-threshold')?.addEventListener('input', e => {
            alertThreshold = parseInt(e.target.value) / 100;
            document.getElementById('live-threshold-val').textContent = e.target.value + '%';
        });
    }

    async function startLiveMonitoring() {
        const cameraFacing = document.getElementById('live-camera-select').value;
        const soundEnabled = document.getElementById('live-sound-select').value === 'on';
        AlertSystem.setEnabled(soundEnabled);

        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: cameraFacing }
            });

            const video = document.getElementById('live-video');
            video.srcObject = webcamStream;
            await video.play();

            // Set mirroring if user facing to sync with human
            const canvas = document.getElementById('live-canvas');
            if (cameraFacing === 'user') {
                video.style.transform = 'scaleX(-1)';
                canvas.style.transform = 'scaleX(-1)';
            } else {
                video.style.transform = 'none';
                canvas.style.transform = 'none';
            }

            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }, { once: true });

            // Switch UI
            document.getElementById('live-setup-panel').style.display = 'none';
            document.getElementById('live-monitor').style.display = 'block';
            document.getElementById('live-session-indicator').style.display = 'flex';

            // Init detectors
            if (!MLEngine.hasDetectors()) {
                await MLEngine.initDetectors();
            }

            // Start session
            sessionStart = Date.now();
            sessionStats = { totalFrames: 0, alerts: 0, behaviors: {} };
            liveHistory = [];
            isProcessing = true;

            // Start session timer
            sessionTimer = setInterval(updateSessionTimer, 1000);

            // Start detection loop
            runDetectionLoop();

        } catch (err) {
            alert('Camera access error: ' + err.message);
        }
    }

    function stopLiveMonitoring() {
        isProcessing = false;

        if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
        if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
        if (webcamStream) { webcamStream.getTracks().forEach(t => t.stop()); webcamStream = null; }

        document.getElementById('live-setup-panel').style.display = 'block';
        document.getElementById('live-monitor').style.display = 'none';
        document.getElementById('live-session-indicator').style.display = 'none';

        // Show session summary
        const duration = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;

        alert(`Session Complete!\n\nDuration: ${mins}m ${secs}s\nFrames Analyzed: ${sessionStats.totalFrames}\nAlerts Triggered: ${sessionStats.alerts}\n\nBehaviors detected:\n${Object.entries(sessionStats.behaviors).map(([k, v]) => `  ${k}: ${v} times`).join('\n') || '  None'}`);
    }

    async function runDetectionLoop() {
        const video = document.getElementById('live-video');
        let frameCount = 0;
        let lastFpsTime = Date.now();

        const loop = async () => {
            if (!isProcessing) return;

            if (video.readyState >= 2) {
                try {
                    const { features, poseKeypoints, faceLandmarks } = await MLEngine.extractFrameFeatures(video);
                    const results = MLEngine.isReady() ? MLEngine.classify(features) : null;

                    drawLiveOverlay(poseKeypoints, faceLandmarks, results);

                    if (results) {
                        updateCurrentResults(results);

                        sessionStats.totalFrames++;
                        document.getElementById('stat-frames').textContent = sessionStats.totalFrames;
                        document.getElementById('live-frame-count').textContent = `Frames: ${sessionStats.totalFrames}`;

                        const top = results[0];
                        // Track all behavioral detections
                        if (top.label !== 'normal') {
                            sessionStats.behaviors[top.label] = (sessionStats.behaviors[top.label] || 0) + 1;
                            updateBehaviorBreakdown();
                        }

                        // Show behavior banner
                        const banner = document.getElementById('live-behavior-banner');
                        if (top.label !== 'normal' && top.confidence >= alertThreshold) {
                            document.getElementById('live-behavior-text').textContent = '⚠️ ' + top.label.replace(/_/g, ' ').toUpperCase();
                            document.getElementById('live-behavior-conf').textContent = (top.confidence * 100).toFixed(0) + '%';
                            banner.style.display = 'block';

                            // Trigger alert
                            AlertSystem.trigger(top.label, top.confidence);
                            sessionStats.alerts++;
                            document.getElementById('stat-alerts').textContent = sessionStats.alerts;

                            // Add to event feed
                            liveHistory.push({
                                behavior: top.label,
                                confidence: top.confidence,
                                timestamp: Date.now()
                            });
                            updateEventFeed();
                        } else {
                            banner.style.display = 'none';
                        }
                    }

                    // FPS
                    frameCount++;
                    const now = Date.now();
                    if (now - lastFpsTime >= 1000) {
                        const fps = frameCount / ((now - lastFpsTime) / 1000);
                        document.getElementById('live-fps-badge').textContent = fps.toFixed(1) + ' FPS';
                        frameCount = 0;
                        lastFpsTime = now;
                    }
                } catch (e) {
                    console.error('Live detection error:', e);
                }
            }

            animFrame = requestAnimationFrame(loop);
        };

        loop();
    }

    function drawLiveOverlay(keypoints, faceLandmarks, results) {
        const canvas = document.getElementById('live-canvas');
        if (!canvas || !keypoints) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const top = results?.[0];
        const danger = top && top.label !== 'normal' && top.confidence >= alertThreshold;
        const color = danger ? 'rgba(239,71,111,0.85)' : 'rgba(0,245,212,0.7)';

        // Draw face mesh if available
        if (faceLandmarks && faceLandmarks.length > 0) {
            ctx.fillStyle = danger ? 'rgba(239,71,111,0.4)' : 'rgba(0,245,212,0.4)';
            faceLandmarks.forEach(kp => {
                ctx.beginPath();
                ctx.arc(kp.x, kp.y, 1.5, 0, 2 * Math.PI);
                ctx.fill();
            });
        }

        const conns = [
            [0,1], [0,2], [1,3], [2,4],
            [5,6],[5,7],[7,9],[6,8],[8,10],
            [5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16]
        ];
        
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        conns.forEach(([i, j]) => {
            if (keypoints[i]?.score > 0.3 && keypoints[j]?.score > 0.3) {
                ctx.beginPath(); ctx.moveTo(keypoints[i].x, keypoints[i].y);
                ctx.lineTo(keypoints[j].x, keypoints[j].y); ctx.stroke();
            }
        });

        keypoints.forEach((kp, i) => {
            if (kp.score > 0.3) {
                ctx.beginPath(); ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI);
                ctx.fillStyle = i <= 4 ? '#3a86ff' : color; ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
            }
        });
    }

    function updateCurrentResults(results) {
        const container = document.getElementById('live-current-results');
        if (!container) return;
        const colors = { normal: 'var(--accent-green)', touching_pocket: 'var(--accent-amber)', eye_darting: 'var(--accent-blue)', reaching: 'var(--accent-magenta)', suspicious: 'var(--accent-red)' };

        container.innerHTML = results.map(r => `
            <div class="detection-result" style="margin-bottom:6px;">
                <span class="detection-result-label">${r.label.replace(/_/g, ' ')}</span>
                <div class="detection-result-bar">
                    <div class="detection-result-bar-fill" style="width:${r.confidence * 100}%;background:${colors[r.label] || 'var(--accent-purple)'}"></div>
                </div>
                <span class="detection-result-value">${(r.confidence * 100).toFixed(0)}%</span>
            </div>
        `).join('');
    }

    function updateBehaviorBreakdown() {
        const container = document.getElementById('live-behavior-breakdown');
        if (!container) return;
        const total = Object.values(sessionStats.behaviors).reduce((a, b) => a + b, 0) || 1;
        const colors = { touching_pocket: 'var(--accent-amber)', eye_darting: 'var(--accent-blue)', reaching: 'var(--accent-magenta)', suspicious: 'var(--accent-red)', looking_around: 'var(--accent-purple)' };

        container.innerHTML = Object.entries(sessionStats.behaviors)
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => `
                <div class="detection-result" style="margin-bottom:6px;">
                    <span class="detection-result-label">${label.replace(/_/g, ' ')}</span>
                    <div class="detection-result-bar">
                        <div class="detection-result-bar-fill" style="width:${(count / total * 100)}%;background:${colors[label] || 'var(--accent-cyan)'}"></div>
                    </div>
                    <span class="detection-result-value">${count}</span>
                </div>
            `).join('');
    }

    function updateEventFeed() {
        const container = document.getElementById('live-event-feed');
        const countEl = document.getElementById('live-event-count');
        if (!container) return;
        countEl.textContent = liveHistory.length + ' events';

        const recent = liveHistory.slice(-20).reverse();
        const dots = { touching_pocket: 'warning', reaching: 'danger', suspicious: 'danger' };

        container.innerHTML = recent.map(e => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-glass);font-size:0.78rem;">
                <span class="behavior-tag ${e.behavior}" style="font-size:0.68rem;">${e.behavior.replace(/_/g, ' ')}</span>
                <span style="color:var(--text-muted);margin-left:auto;font-size:0.7rem;">${new Date(e.timestamp).toLocaleTimeString()}</span>
            </div>
        `).join('');
    }

    function updateSessionTimer() {
        if (!sessionStart) return;
        const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
        const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
        const s = (elapsed % 60).toString().padStart(2, '0');
        const timeStr = `${h}:${m}:${s}`;

        const timerEl = document.getElementById('live-session-timer');
        const durationEl = document.getElementById('stat-duration');
        if (timerEl) timerEl.textContent = timeStr;
        if (durationEl) durationEl.textContent = `${m}:${s}`;
    }

    function takeScreenshot() {
        const video = document.getElementById('live-video');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Also draw the overlay
        const overlay = document.getElementById('live-canvas');
        if (overlay) ctx.drawImage(overlay, 0, 0);

        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `detoxvision_live_${Date.now()}.png`;
            link.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    return { render };
})();

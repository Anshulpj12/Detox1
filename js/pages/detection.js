/**
 * Detection Page — DetoxVision
 */
const DetectionPage = (() => {
    let isDetecting = false;
    let detectionLoop = null;
    let webcamStream = null;
    let alertThreshold = 0.65;
    let detectionHistory = [];

    function render() {
        const container = document.getElementById('detection-content');
        container.innerHTML = `
            <div class="tabs" id="detection-tabs">
                <button class="tab-btn active" data-tab="upload">📤 Upload Video</button>
                <button class="tab-btn" data-tab="webcam">📹 Live Webcam</button>
            </div>
            <div id="detection-tab-upload">
                <div class="glass-card">
                    <div class="upload-zone" id="detection-upload-zone">
                        <input type="file" id="detection-video-input" accept="video/*">
                        <div class="upload-zone-icon">🔍</div>
                        <div class="upload-zone-title">Drop video for detection</div>
                        <div class="upload-zone-subtitle">Upload a video to analyze for suspicious behaviors</div>
                    </div>
                </div>
            </div>
            <div id="detection-tab-webcam" style="display:none;">
                <div class="glass-card" style="text-align:center;padding:24px;">
                    <p style="margin-bottom:16px;color:var(--text-secondary);">Start your webcam for live behavior detection</p>
                    <button class="btn btn-primary" id="start-webcam-btn">📹 Start Webcam</button>
                    <button class="btn btn-danger" id="stop-webcam-btn" style="display:none;">⏹ Stop Webcam</button>
                </div>
            </div>
            <div class="detection-panel" id="detection-area" style="display:none;">
                <div>
                    <div class="video-container" id="detection-video-container">
                        <video id="detection-video" crossorigin="anonymous"></video>
                        <canvas id="detection-canvas"></canvas>
                    </div>
                    <div style="margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                        <button class="btn btn-primary" id="start-detection-btn" disabled>▶ Start Detection</button>
                        <button class="btn btn-danger" id="stop-detection-btn" style="display:none;">⏹ Stop</button>
                        <div class="form-group" style="flex-direction:row;align-items:center;gap:8px;">
                            <label class="form-label" style="white-space:nowrap;margin:0;">Alert Threshold:</label>
                            <input type="range" id="threshold-slider" min="30" max="95" value="65" style="width:120px;accent-color:var(--accent-cyan);">
                            <span id="threshold-value" style="font-size:0.8rem;color:var(--accent-cyan);font-weight:600;">65%</span>
                        </div>
                        <span id="detection-fps" style="font-size:0.75rem;color:var(--text-muted);margin-left:auto;"></span>
                    </div>
                </div>
                <div class="detection-sidebar">
                    <div class="glass-card" style="padding:16px;">
                        <div style="font-weight:700;margin-bottom:12px;">Live Detection</div>
                        <div id="live-results"><div class="empty-state" style="padding:20px 0;"><div class="empty-state-desc" style="font-size:0.8rem;">Start detection to see results</div></div></div>
                    </div>
                    <div class="glass-card" style="padding:16px;">
                        <div style="font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;">
                            <span>Detection Timeline</span>
                            <span id="timeline-count" style="font-size:0.75rem;color:var(--text-muted);">0 events</span>
                        </div>
                        <div id="detection-timeline" style="max-height:300px;overflow-y:auto;"><div class="empty-state" style="padding:20px 0;"><div class="empty-state-desc" style="font-size:0.8rem;">No behaviors detected yet</div></div></div>
                    </div>
                    <div class="glass-card" style="padding:16px;">
                        <div style="font-weight:700;margin-bottom:8px;">Model Status</div>
                        <div id="detection-model-status" style="font-size:0.82rem;color:var(--text-secondary);">${MLEngine.isReady() ? '✅ Model loaded' : '⚠️ No model loaded. Train one first.'}</div>
                    </div>
                </div>
            </div>
        `;
        initEvents();
    }

    function initEvents() {
        document.querySelectorAll('#detection-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#detection-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                document.getElementById('detection-tab-upload').style.display = tab === 'upload' ? 'block' : 'none';
                document.getElementById('detection-tab-webcam').style.display = tab === 'webcam' ? 'block' : 'none';
                if (tab !== 'webcam') stopWebcam();
                stopDetection();
            });
        });

        const uploadZone = document.getElementById('detection-upload-zone');
        const fileInput = document.getElementById('detection-video-input');
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
        uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleVideo(e.dataTransfer.files[0]); });
        fileInput.addEventListener('change', e => { if (e.target.files[0]) handleVideo(e.target.files[0]); });

        document.getElementById('start-webcam-btn')?.addEventListener('click', startWebcam);
        document.getElementById('stop-webcam-btn')?.addEventListener('click', stopWebcam);
        document.getElementById('start-detection-btn')?.addEventListener('click', startDetection);
        document.getElementById('stop-detection-btn')?.addEventListener('click', stopDetection);
        document.getElementById('threshold-slider')?.addEventListener('input', e => {
            alertThreshold = parseInt(e.target.value) / 100;
            document.getElementById('threshold-value').textContent = e.target.value + '%';
        });
    }

    function handleVideo(file) {
        if (!file.type.startsWith('video/')) return;
        const video = document.getElementById('detection-video');
        video.src = URL.createObjectURL(file); video.controls = true;
        video.addEventListener('loadedmetadata', () => {
            const c = document.getElementById('detection-canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
        });
        document.getElementById('detection-area').style.display = 'grid';
        document.getElementById('start-detection-btn').disabled = !MLEngine.isReady();
        DetoxDB.incrementStat('videosProcessed');
    }

    async function startWebcam() {
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            const video = document.getElementById('detection-video');
            video.srcObject = webcamStream; video.controls = false; video.play();
            video.addEventListener('loadedmetadata', () => {
                const c = document.getElementById('detection-canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
            });
            document.getElementById('start-webcam-btn').style.display = 'none';
            document.getElementById('stop-webcam-btn').style.display = 'inline-flex';
            document.getElementById('detection-area').style.display = 'grid';
            document.getElementById('start-detection-btn').disabled = !MLEngine.isReady();
        } catch (e) { alert('Webcam error: ' + e.message); }
    }

    function stopWebcam() {
        if (webcamStream) { webcamStream.getTracks().forEach(t => t.stop()); webcamStream = null; }
        document.getElementById('start-webcam-btn').style.display = 'inline-flex';
        document.getElementById('stop-webcam-btn').style.display = 'none';
        stopDetection();
    }

    async function startDetection() {
        if (!MLEngine.isReady()) { alert('No model loaded!'); return; }
        isDetecting = true; detectionHistory = [];
        document.getElementById('start-detection-btn').style.display = 'none';
        document.getElementById('stop-detection-btn').style.display = 'inline-flex';

        if (!MLEngine.hasDetectors()) {
            updateLive([{ label: 'Loading AI...', confidence: 0 }]);
            await MLEngine.initDetectors();
        }
        const video = document.getElementById('detection-video');
        if (video.paused && !webcamStream) video.play();
        let fc = 0, lastFps = Date.now();

        const loop = async () => {
            if (!isDetecting) return;
            if (video.readyState >= 2 && !video.paused && !video.ended) {
                try {
                    const { features, poseKeypoints, faceLandmarks } = await MLEngine.extractFrameFeatures(video);
                    const results = MLEngine.classify(features);
                    if (results) {
                        drawOverlay(poseKeypoints, faceLandmarks, results);
                        updateLive(results);
                        const top = results[0];
                        if (top.label !== 'normal' && top.confidence >= alertThreshold) {
                            AlertSystem.trigger(top.label, top.confidence);
                            detectionHistory.push({ behavior: top.label, confidence: top.confidence, timestamp: Date.now() });
                            updateTimeline();
                        }
                    }
                    fc++;
                    if (Date.now() - lastFps >= 1000) {
                        document.getElementById('detection-fps').textContent = `${(fc / ((Date.now() - lastFps) / 1000)).toFixed(1)} FPS`;
                        fc = 0; lastFps = Date.now();
                    }
                } catch (e) { console.error(e); }
            }
            detectionLoop = requestAnimationFrame(loop);
        };
        loop();
    }

    function stopDetection() {
        isDetecting = false;
        if (detectionLoop) { cancelAnimationFrame(detectionLoop); detectionLoop = null; }
        const startBtn = document.getElementById('start-detection-btn');
        const stopBtn = document.getElementById('stop-detection-btn');
        if (startBtn) startBtn.style.display = 'inline-flex';
        if (stopBtn) stopBtn.style.display = 'none';
    }

    function drawOverlay(kps, face, results) {
        const canvas = document.getElementById('detection-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!kps) return;
        const top = results?.[0];
        const danger = top && top.label !== 'normal' && top.confidence >= alertThreshold;
        const color = danger ? 'rgba(239,71,111,0.8)' : 'rgba(0,245,212,0.7)';
        const conns = [[5,6],[5,7],[7,9],[6,8],[8,10],[5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16]];
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        conns.forEach(([i,j]) => {
            if (kps[i]?.score > 0.3 && kps[j]?.score > 0.3) {
                ctx.beginPath(); ctx.moveTo(kps[i].x, kps[i].y); ctx.lineTo(kps[j].x, kps[j].y); ctx.stroke();
            }
        });
        kps.forEach((kp, i) => {
            if (kp.score > 0.3) {
                ctx.beginPath(); ctx.arc(kp.x, kp.y, 5, 0, 2*Math.PI);
                ctx.fillStyle = i <= 4 ? '#3a86ff' : color; ctx.fill();
            }
        });
        if (top) {
            const text = `${top.label.replace(/_/g,' ')} (${(top.confidence*100).toFixed(0)}%)`;
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(10, 10, ctx.measureText(text).width + 20, 32);
            ctx.fillStyle = danger ? '#ef476f' : '#06d6a0'; ctx.font = 'bold 16px Inter, sans-serif'; ctx.fillText(text, 20, 32);
        }
    }

    function updateLive(results) {
        const c = document.getElementById('live-results'); if (!c) return;
        const cols = { normal:'var(--accent-green)', touching_pocket:'var(--accent-amber)', eye_darting:'var(--accent-blue)', reaching:'var(--accent-magenta)', suspicious:'var(--accent-red)' };
        c.innerHTML = results.map(r => `<div class="detection-result" style="margin-bottom:8px;"><span class="detection-result-label">${r.label.replace(/_/g,' ')}</span><div class="detection-result-bar"><div class="detection-result-bar-fill" style="width:${r.confidence*100}%;background:${cols[r.label]||'var(--accent-purple)'}"></div></div><span class="detection-result-value">${(r.confidence*100).toFixed(0)}%</span></div>`).join('');
    }

    function updateTimeline() {
        const c = document.getElementById('detection-timeline'), ct = document.getElementById('timeline-count');
        if (!c) return; ct.textContent = detectionHistory.length + ' events';
        const recent = detectionHistory.slice(-15).reverse();
        const dots = { touching_pocket:'warning', reaching:'danger', suspicious:'danger' };
        c.innerHTML = `<div class="timeline" style="padding-left:0;">${recent.map(e => `<div class="timeline-item" style="padding:8px 0;"><div class="timeline-dot ${dots[e.behavior]||''}"></div><div class="timeline-content"><span class="behavior-tag ${e.behavior}" style="font-size:0.7rem;">${e.behavior.replace(/_/g,' ')}</span> <span style="font-size:0.72rem;color:var(--text-muted);">${(e.confidence*100).toFixed(0)}%</span><div class="timeline-time">${new Date(e.timestamp).toLocaleTimeString()}</div></div></div>`).join('')}</div>`;
    }

    return { render };
})();

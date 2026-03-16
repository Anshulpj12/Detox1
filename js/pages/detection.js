/**
 * Detection Page — DetoxVision
 */
const DetectionPage = (() => {
    let isDetecting = false;
    let detectionLoop = null;
    let webcamStream = null;
    let alertThreshold = 0.65;
    let detectionHistory = [];
    
    // Multi-camera state
    let activeCameras = []; // { id: 'slot-1', video: element, canvas: element, ctx: ctx }
    let hostPeer = null;
    let currentHostId = null;
    let cameraIdx = 0; // round robin counter

    function render() {
        // (UI injected above) ...
        // ... (Keep the render function from previous replace, but we omit the string contents for this implementation logic section)
    }

    function initEvents() {
        document.querySelectorAll('#detection-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#detection-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                
                document.getElementById('detection-tab-upload').style.display = tab === 'upload' ? 'block' : 'none';
                document.getElementById('detection-tab-webcam').style.display = tab === 'webcam' ? 'block' : 'none';
                document.getElementById('detection-tab-multicam').style.display = tab === 'multicam' ? 'block' : 'none';
                
                if (tab === 'multicam') {
                    document.getElementById('single-detection-container').style.display = 'none';
                    document.getElementById('multi-camera-grid').style.display = 'grid';
                } else {
                    document.getElementById('single-detection-container').style.display = 'block';
                    document.getElementById('multi-camera-grid').style.display = 'none';
                }
                
                if (tab !== 'webcam') stopWebcam();
                stopDetection();
            });
        });

        // Upload Zone Events
        const uploadZone = document.getElementById('detection-upload-zone');
        const fileInput = document.getElementById('detection-video-input');
        if (uploadZone) {
            uploadZone.addEventListener('click', () => fileInput.click());
            uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
            uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
            uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleVideo(e.dataTransfer.files[0]); });
            fileInput.addEventListener('change', e => { if (e.target.files[0]) handleVideo(e.target.files[0]); });
        }

        // Action Buttons
        document.getElementById('start-webcam-btn')?.addEventListener('click', startWebcam);
        document.getElementById('stop-webcam-btn')?.addEventListener('click', stopWebcam);
        document.getElementById('start-detection-btn')?.addEventListener('click', startDetection);
        document.getElementById('stop-detection-btn')?.addEventListener('click', stopDetection);
        
        document.getElementById('threshold-slider')?.addEventListener('input', e => {
            alertThreshold = parseInt(e.target.value) / 100;
            document.getElementById('threshold-value').textContent = e.target.value + '%';
        });
        
        // Multi-Camera
        document.getElementById('generate-portals-btn')?.addEventListener('click', generatePortals);
    }

    function handleVideo(file) {
        if (!file.type.startsWith('video/')) return;
        const video = document.getElementById('detection-video');
        video.src = URL.createObjectURL(file); video.controls = true;
        video.addEventListener('loadedmetadata', () => {
            const c = document.getElementById('detection-canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
        });
        // Clear multicam layout, restore single layout
        document.getElementById('single-detection-container').style.display = 'block';
        document.getElementById('multi-camera-grid').style.display = 'none';
        
        document.getElementById('detection-area').style.display = 'grid';
        document.getElementById('start-detection-btn').disabled = !MLEngine.isReady();
        DetoxDB.incrementStat('videosProcessed');
        
        // Reset active cameras array to just the main video
        activeCameras = [{ 
            id: 'main', 
            video: document.getElementById('detection-video'), 
            canvas: document.getElementById('detection-canvas'),
            ctx: document.getElementById('detection-canvas').getContext('2d')
        }];
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
            
            activeCameras = [{ 
                id: 'main', 
                video: video, 
                canvas: document.getElementById('detection-canvas'),
                ctx: document.getElementById('detection-canvas').getContext('2d')
            }];
        } catch (e) { alert('Webcam error: ' + e.message); }
    }

    function stopWebcam() {
        if (webcamStream) { webcamStream.getTracks().forEach(t => t.stop()); webcamStream = null; }
        document.getElementById('start-webcam-btn').style.display = 'inline-flex';
        document.getElementById('stop-webcam-btn').style.display = 'none';
        stopDetection();
    }
    
    // WebRTC Multi-Camera System
    function generatePortals() {
        const count = parseInt(document.getElementById('multicam-count').value) || 1;
        const grid = document.getElementById('multi-camera-grid');
        grid.innerHTML = '';
        activeCameras = [];
        
        // Setup Host Peer
        if (hostPeer) hostPeer.destroy();
        hostPeer = new Peer();
        
        const btn = document.getElementById('generate-portals-btn');
        btn.textContent = '⏳ Starting Host Server...';
        btn.disabled = true;

        hostPeer.on('open', (id) => {
            currentHostId = id;
            btn.textContent = '✅ Host Active!';
            btn.style.background = 'var(--accent-green)';
            setTimeout(() => { btn.textContent = '🔗 Regenerate Portals'; btn.style.background = ''; btn.disabled = false; }, 3000);
            
            document.getElementById('detection-area').style.display = 'grid';
            document.getElementById('start-detection-btn').disabled = !MLEngine.isReady();
            
            const baseUrl = window.location.href.split('?')[0];

            for(let i = 1; i <= count; i++) {
                const slotId = 'Slot ' + i;
                const streamLink = `${baseUrl}?streamer=true&hostId=${currentHostId}&slot=${encodeURIComponent(slotId)}`;
                
                const col = document.createElement('div');
                col.className = 'glass-card';
                col.style.padding = '12px';
                col.style.display = 'flex'; col.style.flexDirection = 'column';
                col.dataset.slotId = slotId;
                
                col.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-weight:600; color:var(--text-primary); font-size:0.9rem;">🎥 ${slotId}</span>
                        <span class="stream-status-badge" style="font-size:0.75rem; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.1); color:var(--text-muted);">Waiting...</span>
                    </div>
                    <div class="video-container" style="flex-grow:1; border-radius:8px; overflow:hidden; background:#000; margin-bottom:12px;">
                        <video id="vid-${i}" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>
                        <canvas id="canv-${i}" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></canvas>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; word-break:break-all;">
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Stream Link (Open on phone/tablet):</div>
                        <a href="${streamLink}" target="_blank" style="font-size:0.7rem; color:var(--accent-cyan); text-decoration:none;">${streamLink}</a>
                    </div>
                    <button class="btn btn-danger btn-sm" style="margin-top:8px;" onclick="this.parentElement.remove(); window.removeCamera('${slotId}')">Remove Node</button>
                `;
                
                grid.appendChild(col);
                
                const videoEl = col.querySelector(`video`);
                const canvasEl = col.querySelector(`canvas`);
                
                videoEl.addEventListener('loadedmetadata', () => {
                    canvasEl.width = videoEl.videoWidth;
                    canvasEl.height = videoEl.videoHeight;
                });
                
                activeCameras.push({
                    id: slotId,
                    video: videoEl,
                    canvas: canvasEl,
                    ctx: canvasEl.getContext('2d'),
                    connected: false
                });
            }
        });

        // Listen for incoming streamer calls
        hostPeer.on('call', (call) => {
            const slot = call.metadata?.slot;
            call.answer(); // auto answer
            
            call.on('stream', (remoteStream) => {
                const cam = activeCameras.find(c => c.id === slot);
                if (cam) {
                    cam.video.srcObject = remoteStream;
                    cam.connected = true;
                    const card = document.querySelector(`.glass-card[data-slot-id="${slot}"]`);
                    if (card) {
                        const badge = card.querySelector('.stream-status-badge');
                        badge.textContent = '🟢 Online';
                        badge.style.background = 'rgba(6,214,160,0.2)';
                        badge.style.color = '#06d6a0';
                    }
                }
            });
            
            call.on('close', () => {
                const cam = activeCameras.find(c => c.id === slot);
                if (cam) {
                    cam.connected = false;
                    const card = document.querySelector(`.glass-card[data-slot-id="${slot}"]`);
                    if (card) {
                        const badge = card.querySelector('.stream-status-badge');
                        badge.textContent = '🔴 Offline';
                        badge.style.background = 'rgba(239,71,111,0.2)';
                        badge.style.color = '#ef476f';
                    }
                }
            });
        });
        
        hostPeer.on('error', (err) => {
            alert('WebRTC Network Error: ' + err.message);
        });
    }
    
    // Global helper for the inline onclick handler
    window.removeCamera = (id) => {
        activeCameras = activeCameras.filter(c => c.id !== id);
    };

    async function startDetection() {
        if (!MLEngine.isReady()) { alert('No model loaded!'); return; }
        
        const validCameras = activeCameras.filter(c => 
            c.id === 'main' ? 
            (c.video.readyState >= 2 && !c.video.paused && !c.video.ended) : 
            c.connected
        );
        
        if (validCameras.length === 0) {
            // Main tab logic (if empty meaning user clicked before playing video)
            if (activeCameras.length === 1 && activeCameras[0].id === 'main') {
                 if (activeCameras[0].video.paused && !webcamStream) activeCameras[0].video.play();
            } else {
                alert('No active camera feeds are currently playing/connected!');
                return;
            }
        }

        isDetecting = true; detectionHistory = [];
        document.getElementById('start-detection-btn').style.display = 'none';
        document.getElementById('stop-detection-btn').style.display = 'inline-flex';

        if (!MLEngine.hasDetectors()) {
            updateLive([{ label: 'Loading AI...', confidence: 0 }]);
            await MLEngine.initDetectors();
        }
        
        let fc = 0, lastFps = Date.now();
        cameraIdx = 0;

        const loop = async () => {
            if (!isDetecting) return;
            
            // Re-eval valid cameras (in case streams connect/drop mid-run)
            const available = activeCameras.filter(c => 
                c.id === 'main' ? 
                (c.video.readyState >= 2 && !c.video.paused && !c.video.ended) : 
                (c.connected && c.video.readyState >= 2)
            );
            
            if (available.length > 0) {
                // Round Robin: Process one active camera per frame to maintain high framerate
                cameraIdx = (cameraIdx + 1) % available.length;
                const camInfo = available[cameraIdx];
                
                try {
                    const { features, poseKeypoints, faceLandmarks } = await MLEngine.extractFrameFeatures(camInfo.video);
                    const results = MLEngine.classify(features);
                    
                    if (results) {
                        drawOverlay(camInfo.canvas, camInfo.ctx, poseKeypoints, faceLandmarks, results);
                        
                        // Only update sidebar logic if it's the main or first camera to avoid chaotic flickering
                        if (cameraIdx === 0) {
                            updateLive(results);
                        }
                        
                        const top = results[0];
                        if (top.label !== 'normal' && top.confidence >= alertThreshold) {
                            AlertSystem.trigger(top.label, top.confidence, camInfo.id);
                            detectionHistory.push({ behavior: top.label, confidence: top.confidence, timestamp: Date.now(), camId: camInfo.id });
                            updateTimeline();
                        }
                    }
                    fc++;
                    if (Date.now() - lastFps >= 1000) {
                        document.getElementById('detection-fps').textContent = `${(fc / ((Date.now() - lastFps) / 1000)).toFixed(1)} AI FPS`;
                        fc = 0; lastFps = Date.now();
                    }
                } catch (e) { console.error('AI Loop Error:', e); }
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
        
        // Wipe all canvases
        activeCameras.forEach(cam => {
            if (cam.canvas && cam.ctx) {
                cam.ctx.clearRect(0, 0, cam.canvas.width, cam.canvas.height);
            }
        });
    }

    function drawOverlay(canvas, ctx, kps, face, results) {
        if (!canvas || !ctx) return;
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
        
        if (face) {
            ctx.fillStyle = 'rgba(255, 200, 0, 0.7)';
            face.forEach(pt => {
                ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.5, 0, 2*Math.PI); ctx.fill();
            });
        }
        
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

/**
 * Training Page — DetoxVision
 * Upload videos, label time segments, and train the behavior classifier
 */
const TrainingPage = (() => {
    let currentVideo = null;
    let currentVideoName = '';
    let segments = [];
    let currentLabel = 'normal';
    let isCapturing = false;
    let captureInterval = null;
    let capturedFrames = [];

    function render() {
        const container = document.getElementById('training-content');
        container.innerHTML = `
            <!-- Step 1: Upload Video -->
            <div class="glass-card" id="training-upload-section">
                <div class="glass-card-header">
                    <div>
                        <div class="glass-card-title">Step 1 — Upload Training Video</div>
                        <div class="glass-card-subtitle">Upload a video showing the behaviors you want to detect</div>
                    </div>
                </div>
                <div class="upload-zone" id="training-upload-zone">
                    <input type="file" id="training-video-input" accept="video/*">
                    <div class="upload-zone-icon">🎬</div>
                    <div class="upload-zone-title">Drop video here or click to browse</div>
                    <div class="upload-zone-subtitle">Supports MP4, WebM, AVI, MOV</div>
                </div>
            </div>

            <!-- Step 2: Label Behaviors -->
            <div class="glass-card hidden" id="training-label-section">
                <div class="glass-card-header">
                    <div>
                        <div class="glass-card-title">Step 2 — Label Behaviors</div>
                        <div class="glass-card-subtitle">Play the video, select a behavior label, and capture frames</div>
                    </div>
                    <button class="btn btn-outline btn-sm" id="training-change-video">Change Video</button>
                </div>

                <div class="detection-panel">
                    <div>
                        <!-- Video Player -->
                        <div class="video-container" id="training-video-container">
                            <video id="training-video" controls crossorigin="anonymous"></video>
                            <canvas id="training-canvas"></canvas>
                        </div>

                        <!-- Label Selector -->
                        <div style="margin-top:16px;">
                            <div class="form-label">Select Behavior Label</div>
                            <div class="label-grid" id="label-selector">
                                <button class="label-btn label-normal active" data-label="normal">✅ Normal</button>
                                <button class="label-btn label-touching_pocket" data-label="touching_pocket">🤚 Touching Pocket</button>
                                <button class="label-btn label-eye_darting" data-label="eye_darting">👁️ Eye Darting</button>
                                <button class="label-btn label-reaching" data-label="reaching">🖐️ Reaching</button>
                                <button class="label-btn label-suspicious" data-label="suspicious">⚠️ Suspicious</button>
                            </div>
                        </div>

                        <!-- Capture Controls -->
                        <div style="margin-top:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                            <button class="btn btn-primary" id="capture-frame-btn">📸 Capture Current Frame</button>
                            <button class="btn btn-outline" id="auto-capture-btn">🔄 Auto-Capture (2s interval)</button>
                            <button class="btn btn-outline" id="stop-capture-btn" style="display:none;">⏹ Stop Auto-Capture</button>
                            <span id="capture-status" style="font-size:0.8rem;color:var(--text-secondary);"></span>
                        </div>
                    </div>

                    <!-- Sidebar: Captured Segments -->
                    <div class="detection-sidebar">
                        <div class="glass-card" style="padding:16px;">
                            <div style="font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                                <span>Labeled Samples</span>
                                <span id="sample-count" style="font-size:0.75rem;color:var(--text-muted);">0 samples</span>
                            </div>
                            <div class="segments-list" id="segments-list"></div>
                        </div>

                        <div class="glass-card" style="padding:16px;">
                            <div style="font-weight:700;margin-bottom:8px;">Label Distribution</div>
                            <div id="label-distribution"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 3: Train Model -->
            <div class="glass-card" id="training-train-section">
                <div class="glass-card-header">
                    <div>
                        <div class="glass-card-title">Step 3 — Train Model</div>
                        <div class="glass-card-subtitle">Train your custom behavior classifier with the labeled data</div>
                    </div>
                </div>

                <div id="training-data-summary" style="margin-bottom:16px;"></div>

                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
                    <div class="form-group" style="min-width:200px;">
                        <label class="form-label">Model Name</label>
                        <input type="text" class="form-input" id="model-name-input" placeholder="My Detection Model" value="Model ${new Date().toLocaleDateString()}">
                    </div>
                </div>

                <div style="display:flex;gap:12px;margin-bottom:20px;">
                    <button class="btn btn-primary" id="train-btn" disabled>🚀 Start Training</button>
                    <button class="btn btn-outline" id="clear-data-btn">🗑️ Clear All Data</button>
                </div>

                <!-- Training Progress -->
                <div id="training-progress" style="display:none;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-weight:600;">Training Progress</span>
                        <span id="training-epoch" style="font-size:0.8rem;color:var(--text-muted);">Epoch 0/50</span>
                    </div>
                    <div class="progress-bar" style="margin-bottom:12px;">
                        <div class="progress-bar-fill" id="training-progress-bar" style="width:0%;"></div>
                    </div>
                    <div class="training-log" id="training-log"></div>
                </div>
            </div>

            <!-- Saved Models -->
            <div class="glass-card">
                <div class="glass-card-header">
                    <div>
                        <div class="glass-card-title">Saved Models</div>
                        <div class="glass-card-subtitle">Your trained behavior detection models</div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-outline btn-sm" id="import-model-btn">📥 Import Model</button>
                        <input type="file" id="import-model-input" accept=".json" style="display:none;">
                    </div>
                </div>
                <div id="import-status" style="display:none;margin-bottom:12px;padding:10px 16px;border-radius:var(--radius-sm);font-size:0.82rem;"></div>
                <div id="models-list" class="models-grid"></div>
            </div>
        `;

        initTrainingEvents();
        updateTrainingDataSummary();
        loadSavedModels();
    }

    function initTrainingEvents() {
        // Upload zone
        const uploadZone = document.getElementById('training-upload-zone');
        const fileInput = document.getElementById('training-video-input');

        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) handleVideoUpload(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleVideoUpload(e.target.files[0]);
        });

        // Change video
        document.getElementById('training-change-video')?.addEventListener('click', () => {
            document.getElementById('training-upload-section').classList.remove('hidden');
            document.getElementById('training-label-section').classList.add('hidden');
            stopAutoCapture();
        });

        // Label selector
        document.getElementById('label-selector')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.label-btn');
            if (!btn) return;
            document.querySelectorAll('.label-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLabel = btn.dataset.label;
        });

        // Capture buttons
        document.getElementById('capture-frame-btn')?.addEventListener('click', captureCurrentFrame);
        document.getElementById('auto-capture-btn')?.addEventListener('click', startAutoCapture);
        document.getElementById('stop-capture-btn')?.addEventListener('click', stopAutoCapture);

        // Train button
        document.getElementById('train-btn')?.addEventListener('click', startTraining);
        document.getElementById('clear-data-btn')?.addEventListener('click', clearAllData);

        // Import model
        document.getElementById('import-model-btn')?.addEventListener('click', () => {
            document.getElementById('import-model-input').click();
        });
        document.getElementById('import-model-input')?.addEventListener('change', handleModelImport);
    }

    function handleVideoUpload(file) {
        if (!file.type.startsWith('video/')) return;
        currentVideoName = file.name;
        const url = URL.createObjectURL(file);
        const video = document.getElementById('training-video');
        video.src = url;

        document.getElementById('training-upload-section').classList.add('hidden');
        document.getElementById('training-label-section').classList.remove('hidden');

        // Set up canvas
        video.addEventListener('loadedmetadata', () => {
            const canvas = document.getElementById('training-canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        });
    }

    async function captureCurrentFrame() {
        const video = document.getElementById('training-video');
        if (!video.src || video.readyState < 2) return;

        const statusEl = document.getElementById('capture-status');
        statusEl.textContent = 'Extracting features...';

        try {
            // Initialize detectors if not already done
            if (!MLEngine.hasDetectors()) {
                statusEl.textContent = 'Loading AI models (first time only)...';
                await MLEngine.initDetectors((msg) => { statusEl.textContent = msg; });
            }

            const { features, poseKeypoints } = await MLEngine.extractFrameFeatures(video);

            // Draw pose on canvas
            drawPoseOnCanvas(poseKeypoints, video);

            // Store the labeled data
            await DetoxDB.addTrainingData(features, currentLabel);

            // Update UI
            segments.push({
                label: currentLabel,
                time: video.currentTime,
                features: features
            });

            updateSegmentsList();
            updateTrainingDataSummary();
            statusEl.textContent = `✅ Captured! (${currentLabel})`;
        } catch (err) {
            console.error('Capture failed:', err);
            statusEl.textContent = '❌ Capture failed: ' + err.message;
        }
    }

    function startAutoCapture() {
        isCapturing = true;
        document.getElementById('auto-capture-btn').style.display = 'none';
        document.getElementById('stop-capture-btn').style.display = 'inline-flex';

        const video = document.getElementById('training-video');
        if (video.paused) video.play();

        captureInterval = setInterval(() => {
            if (!video.paused && !video.ended) {
                captureCurrentFrame();
            }
        }, 2000);
    }

    function stopAutoCapture() {
        isCapturing = false;
        if (captureInterval) clearInterval(captureInterval);
        captureInterval = null;
        const autoBtn = document.getElementById('auto-capture-btn');
        const stopBtn = document.getElementById('stop-capture-btn');
        if (autoBtn) autoBtn.style.display = 'inline-flex';
        if (stopBtn) stopBtn.style.display = 'none';
    }

    function drawPoseOnCanvas(keypoints, video) {
        const canvas = document.getElementById('training-canvas');
        if (!canvas || !keypoints) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw skeleton connections
        const connections = [
            [5,6],[5,7],[7,9],[6,8],[8,10],
            [5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16]
        ];

        ctx.strokeStyle = 'rgba(0, 245, 212, 0.6)';
        ctx.lineWidth = 2;
        connections.forEach(([i, j]) => {
            if (keypoints[i] && keypoints[j] && keypoints[i].score > 0.3 && keypoints[j].score > 0.3) {
                ctx.beginPath();
                ctx.moveTo(keypoints[i].x, keypoints[i].y);
                ctx.lineTo(keypoints[j].x, keypoints[j].y);
                ctx.stroke();
            }
        });

        // Draw keypoints
        keypoints.forEach((kp, i) => {
            if (kp.score > 0.3) {
                ctx.beginPath();
                ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
                ctx.fillStyle = i <= 4 ? '#3a86ff' : '#00f5d4';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });
    }

    function updateSegmentsList() {
        const list = document.getElementById('segments-list');
        const countEl = document.getElementById('sample-count');
        if (!list) return;

        countEl.textContent = `${segments.length} samples`;

        // Show last 20
        const recent = segments.slice(-20).reverse();
        list.innerHTML = recent.map((s, idx) => `
            <div class="segment-item">
                <span class="segment-time">${formatTime(s.time)}</span>
                <span class="behavior-tag ${s.label}">${s.label.replace(/_/g, ' ')}</span>
                <button class="segment-remove" data-idx="${segments.length - 1 - idx}">✕</button>
            </div>
        `).join('');

        // Remove segment handlers
        list.querySelectorAll('.segment-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                // Note: We can't easily remove from IndexedDB by index, so just update UI
                const idx = parseInt(btn.dataset.idx);
                segments.splice(idx, 1);
                updateSegmentsList();
            });
        });

        updateLabelDistribution();
    }

    function updateLabelDistribution() {
        const container = document.getElementById('label-distribution');
        if (!container) return;

        const counts = {};
        segments.forEach(s => { counts[s.label] = (counts[s.label] || 0) + 1; });
        const total = segments.length || 1;

        const colors = {
            normal: 'var(--accent-green)', touching_pocket: 'var(--accent-amber)',
            eye_darting: 'var(--accent-blue)', reaching: 'var(--accent-magenta)',
            suspicious: 'var(--accent-red)'
        };

        container.innerHTML = Object.entries(counts).map(([label, count]) => `
            <div class="detection-result" style="margin-bottom:6px;">
                <span class="detection-result-label">${label.replace(/_/g, ' ')}</span>
                <div class="detection-result-bar">
                    <div class="detection-result-bar-fill" style="width:${(count/total*100)}%;background:${colors[label] || 'var(--accent-purple)'}"></div>
                </div>
                <span class="detection-result-value">${count}</span>
            </div>
        `).join('');
    }

    async function updateTrainingDataSummary() {
        const container = document.getElementById('training-data-summary');
        const trainBtn = document.getElementById('train-btn');
        if (!container) return;

        const count = await DetoxDB.getTrainingDataCount();
        const data = await DetoxDB.getTrainingData();
        const labelCounts = {};
        data.forEach(d => { labelCounts[d.label] = (labelCounts[d.label] || 0) + 1; });
        const uniqueLabels = Object.keys(labelCounts);

        container.innerHTML = `
            <div style="display:flex;gap:16px;flex-wrap:wrap;">
                <div style="font-size:0.85rem;">
                    <span style="color:var(--text-muted);">Total Samples:</span>
                    <span style="font-weight:700;color:var(--accent-cyan);margin-left:4px;">${count}</span>
                </div>
                <div style="font-size:0.85rem;">
                    <span style="color:var(--text-muted);">Unique Labels:</span>
                    <span style="font-weight:700;color:var(--accent-purple);margin-left:4px;">${uniqueLabels.length}</span>
                </div>
                ${uniqueLabels.map(l => `
                    <span class="behavior-tag ${l}">${l.replace(/_/g,' ')}: ${labelCounts[l]}</span>
                `).join('')}
            </div>
        `;

        // Enable/disable train button (need at least 2 labels, 5 samples each)
        if (trainBtn) {
            const canTrain = uniqueLabels.length >= 2 && count >= 10;
            trainBtn.disabled = !canTrain;
        }
    }

    async function startTraining() {
        const trainBtn = document.getElementById('train-btn');
        const progressDiv = document.getElementById('training-progress');
        const progressBar = document.getElementById('training-progress-bar');
        const epochText = document.getElementById('training-epoch');
        const logDiv = document.getElementById('training-log');
        const modelName = document.getElementById('model-name-input').value || 'My Model';

        trainBtn.disabled = true;
        trainBtn.textContent = '⏳ Training...';
        progressDiv.style.display = 'block';
        logDiv.innerHTML = '';

        try {
            // Get training data
            const data = await DetoxDB.getTrainingData();
            const labelSet = [...new Set(data.map(d => d.label))];

            // Add log entry
            logDiv.innerHTML += `<div><span class="log-epoch">[INFO]</span> Training with ${data.length} samples, ${labelSet.length} classes</div>`;
            logDiv.innerHTML += `<div><span class="log-epoch">[INFO]</span> Labels: ${labelSet.join(', ')}</div>`;

            await MLEngine.trainClassifier(data, labelSet, (epoch, total, logs) => {
                const pct = (epoch / total * 100).toFixed(0);
                progressBar.style.width = pct + '%';
                epochText.textContent = `Epoch ${epoch}/${total}`;

                logDiv.innerHTML += `<div><span class="log-epoch">[Epoch ${epoch}/${total}]</span> <span class="log-loss">loss: ${logs.loss.toFixed(4)}</span> | <span class="log-acc">acc: ${(logs.acc * 100).toFixed(1)}%</span>${logs.val_loss ? ` | val_loss: ${logs.val_loss.toFixed(4)}` : ''}</div>`;
                logDiv.scrollTop = logDiv.scrollHeight;
            });

            // Save model
            const modelId = await MLEngine.saveModel(modelName);
            logDiv.innerHTML += `<div><span class="log-acc">[SUCCESS]</span> Model saved as "${modelName}"</div>`;

            trainBtn.textContent = '✅ Training Complete!';
            await DetoxDB.incrementStat('modelsTrained');
            loadSavedModels();

            setTimeout(() => {
                trainBtn.textContent = '🚀 Start Training';
                trainBtn.disabled = false;
            }, 3000);
        } catch (err) {
            logDiv.innerHTML += `<div style="color:var(--accent-red);">[ERROR] ${err.message}</div>`;
            trainBtn.textContent = '🚀 Start Training';
            trainBtn.disabled = false;
        }
    }

    async function clearAllData() {
        if (!confirm('Clear all training data? This cannot be undone.')) return;
        await DetoxDB.clearTrainingData();
        segments = [];
        updateSegmentsList();
        updateTrainingDataSummary();
    }

    async function loadSavedModels() {
        const container = document.getElementById('models-list');
        if (!container) return;

        const models = await DetoxDB.getModels();

        if (models.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <div class="empty-state-icon">🤖</div>
                    <div class="empty-state-title">No models yet</div>
                    <div class="empty-state-desc">Upload some videos, label behaviors, and train your first model</div>
                </div>
            `;
            return;
        }

        container.innerHTML = models.map(m => `
            <div class="model-card">
                <div class="model-card-name">🧠 ${m.name}</div>
                <div class="model-card-meta">
                    <span>Labels: ${m.labels.join(', ')}</span>
                    <span>Created: ${new Date(m.createdAt).toLocaleDateString()}</span>
                    ${m.importedAt ? '<span style="color:var(--accent-cyan);">📥 Imported</span>' : ''}
                </div>
                <div class="model-card-actions">
                    <button class="btn btn-primary btn-sm load-model-btn" data-id="${m.id}">Load</button>
                    <button class="btn btn-outline btn-sm export-model-btn" data-id="${m.id}">📤 Export</button>
                    <button class="btn btn-danger btn-sm delete-model-btn" data-id="${m.id}">Delete</button>
                </div>
            </div>
        `).join('');

        // Load/Delete handlers
        container.querySelectorAll('.load-model-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const success = await MLEngine.loadModel(btn.dataset.id);
                if (success) {
                    btn.textContent = '✅ Loaded';
                    setTimeout(() => { btn.textContent = 'Load'; }, 2000);
                }
            });
        });

        container.querySelectorAll('.delete-model-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this model?')) return;
                await MLEngine.deleteModel(btn.dataset.id);
                loadSavedModels();
            });
        });

        // Export handlers
        container.querySelectorAll('.export-model-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.textContent = '⏳...';
                try {
                    await MLEngine.exportModelToFile(btn.dataset.id);
                    btn.textContent = '✅ Exported';
                    setTimeout(() => { btn.textContent = '📤 Export'; }, 2000);
                } catch (e) {
                    btn.textContent = '❌ Error';
                    console.error('Export failed:', e);
                    setTimeout(() => { btn.textContent = '📤 Export'; }, 2000);
                }
            });
        });
    }

    async function handleModelImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('import-status');
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(0,245,212,0.1)';
        statusEl.style.color = 'var(--accent-cyan)';
        statusEl.textContent = '⏳ Importing model...';

        try {
            const result = await MLEngine.importModelFromFile(file);
            statusEl.style.background = 'rgba(6,214,160,0.1)';
            statusEl.style.color = 'var(--accent-green)';
            statusEl.textContent = `✅ Model "${result.name}" imported successfully!`;
            loadSavedModels();
            setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
        } catch (err) {
            statusEl.style.background = 'rgba(239,71,111,0.1)';
            statusEl.style.color = 'var(--accent-red)';
            statusEl.textContent = `❌ Import failed: ${err.message}`;
            setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
        }

        // Reset input
        e.target.value = '';
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    return { render };
})();

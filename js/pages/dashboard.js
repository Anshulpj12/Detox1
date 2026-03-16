/**
 * Dashboard Page — DetoxVision
 */
const DashboardPage = (() => {
    async function render() {
        const container = document.getElementById('dashboard-content');
        
        const modelCount = (await DetoxDB.getModels()).length;
        const videosProcessed = await DetoxDB.getStat('videosProcessed');
        const alertCount = await DetoxDB.getAlertCount();
        const trainingSamples = await DetoxDB.getTrainingDataCount();

        container.innerHTML = `
            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card" id="stat-models">
                    <div class="stat-icon">🧠</div>
                    <div class="stat-value">${modelCount}</div>
                    <div class="stat-label">Trained Models</div>
                </div>
                <div class="stat-card" id="stat-videos">
                    <div class="stat-icon">🎬</div>
                    <div class="stat-value">${videosProcessed}</div>
                    <div class="stat-label">Videos Processed</div>
                </div>
                <div class="stat-card" id="stat-alerts">
                    <div class="stat-icon">🔔</div>
                    <div class="stat-value">${alertCount}</div>
                    <div class="stat-label">Alerts Triggered</div>
                </div>
                <div class="stat-card" id="stat-samples">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${trainingSamples}</div>
                    <div class="stat-label">Training Samples</div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="glass-card">
                <div class="glass-card-header">
                    <div>
                        <div class="glass-card-title">Quick Actions</div>
                        <div class="glass-card-subtitle">Get started with behavior detection</div>
                    </div>
                </div>
                <div class="stats-grid">
                    <div class="glass-card quick-action" data-action="training" style="cursor:pointer;text-align:center;padding:32px 20px;">
                        <div style="font-size:2.5rem;margin-bottom:12px;">📤</div>
                        <div style="font-weight:700;margin-bottom:6px;">Upload Training Video</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);">Upload videos and label behaviors to train your custom model</div>
                    </div>
                    <div class="glass-card quick-action" data-action="detection" style="cursor:pointer;text-align:center;padding:32px 20px;">
                        <div style="font-size:2.5rem;margin-bottom:12px;">🔍</div>
                        <div style="font-weight:700;margin-bottom:6px;">Start Detection</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);">Upload a video or use your webcam to detect behaviors in real-time</div>
                    </div>
                    <div class="glass-card quick-action" data-action="alerts" style="cursor:pointer;text-align:center;padding:32px 20px;">
                        <div style="font-size:2.5rem;margin-bottom:12px;">📋</div>
                        <div style="font-weight:700;margin-bottom:6px;">View Alert History</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);">Review all detected behaviors and triggered alerts</div>
                    </div>
                </div>
            </div>

            <!-- Recent Alerts -->
            <div class="glass-card">
                <div class="glass-card-header">
                    <div>
                        <div class="glass-card-title">Recent Activity</div>
                        <div class="glass-card-subtitle">Latest detected behaviors</div>
                    </div>
                </div>
                <div id="recent-activity"></div>
            </div>

            <!-- System Status -->
            <div class="glass-card">
                <div class="glass-card-header">
                    <div>
                        <div class="glass-card-title">System Status</div>
                        <div class="glass-card-subtitle">AI engine and model status</div>
                    </div>
                </div>
                <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px,1fr));">
                    <div class="detection-result">
                        <span class="detection-result-label">TensorFlow.js</span>
                        <span style="color:var(--accent-green);font-size:0.8rem;font-weight:600;" id="tf-status">Loading...</span>
                    </div>
                    <div class="detection-result">
                        <span class="detection-result-label">Pose Detector</span>
                        <span style="font-size:0.8rem;font-weight:600;" id="pose-status">Not loaded</span>
                    </div>
                    <div class="detection-result">
                        <span class="detection-result-label">Face Detector</span>
                        <span style="font-size:0.8rem;font-weight:600;" id="face-status">Not loaded</span>
                    </div>
                    <div class="detection-result">
                        <span class="detection-result-label">Classifier</span>
                        <span style="font-size:0.8rem;font-weight:600;" id="classifier-status">${MLEngine.isReady() ? '✅ Ready' : '⚪ Not trained'}</span>
                    </div>
                </div>
            </div>
        `;

        // Quick action clicks
        container.querySelectorAll('.quick-action').forEach(el => {
            el.addEventListener('click', () => {
                const page = el.dataset.action;
                document.querySelector(`[data-page="${page}"]`).click();
            });
        });

        // Load recent activity
        loadRecentActivity();

        // Update system status
        updateSystemStatus();
    }

    async function loadRecentActivity() {
        const container = document.getElementById('recent-activity');
        const alerts = await DetoxDB.getAlerts();
        const recent = alerts.slice(0, 5);

        if (recent.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-title">No activity yet</div>
                    <div class="empty-state-desc">Train a model and run detection to see activity here</div>
                </div>
            `;
            return;
        }

        const dotClass = {
            'touching_pocket': 'warning', 'eye_darting': '', 'reaching': 'danger',
            'suspicious': 'danger', 'normal': '', 'looking_around': 'warning'
        };

        container.innerHTML = `
            <div class="timeline">
                ${recent.map(a => `
                    <div class="timeline-item">
                        <div class="timeline-dot ${dotClass[a.behavior] || ''}"></div>
                        <div class="timeline-content">
                            <div class="timeline-time">${new Date(a.timestamp).toLocaleString()}</div>
                            <div class="timeline-title">
                                <span style="background:var(--bg-glass);padding:2px 6px;border-radius:4px;font-size:0.75rem;color:var(--accent-cyan);margin-right:8px;">${a.camera || 'Main Device'}</span>
                                <span class="behavior-tag ${a.behavior}">${a.behavior.replace(/_/g, ' ')}</span>
                            </div>
                            <div class="timeline-desc">Confidence: ${(a.confidence * 100).toFixed(1)}%</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function updateSystemStatus() {
        const tfStatus = document.getElementById('tf-status');
        const poseStatus = document.getElementById('pose-status');
        const faceStatus = document.getElementById('face-status');

        if (tfStatus) tfStatus.textContent = typeof tf !== 'undefined' ? '✅ Loaded' : '❌ Error';
        if (poseStatus) poseStatus.textContent = MLEngine.hasDetectors() ? '✅ Loaded' : '⚪ Not loaded';
        if (faceStatus) faceStatus.textContent = MLEngine.hasDetectors() ? '✅ Loaded' : '⚪ Not loaded';
    }

    return { render };
})();

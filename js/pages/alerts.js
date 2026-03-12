/**
 * Alerts Page — DetoxVision
 * Alert history with filtering, search, and export
 */
const AlertsPage = (() => {
    let filterBehavior = 'all';

    async function render() {
        const container = document.getElementById('alerts-content');
        AlertSystem.clearUnread();

        const alerts = await DetoxDB.getAlerts();
        const behaviors = [...new Set(alerts.map(a => a.behavior))];

        container.innerHTML = `
            <div class="glass-card">
                <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px;">
                    <div class="form-group" style="min-width:180px;">
                        <label class="form-label">Filter by Behavior</label>
                        <select class="form-select" id="alert-filter">
                            <option value="all">All Behaviors</option>
                            ${behaviors.map(b => `<option value="${b}">${b.replace(/_/g, ' ')}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-left:auto;display:flex;gap:8px;align-self:flex-end;">
                        <span style="font-size:0.82rem;color:var(--text-muted);align-self:center;">${alerts.length} total alerts</span>
                    </div>
                </div>
                <div id="alerts-table-container"></div>
            </div>
        `;

        // Filter handler
        document.getElementById('alert-filter')?.addEventListener('change', (e) => {
            filterBehavior = e.target.value;
            renderTable(alerts);
        });

        // Header buttons
        document.getElementById('clear-alerts-btn')?.addEventListener('click', async () => {
            if (!confirm('Clear all alerts?')) return;
            await DetoxDB.clearAlerts();
            render();
        });

        document.getElementById('export-alerts-btn')?.addEventListener('click', () => exportCSV(alerts));

        renderTable(alerts);
    }

    function renderTable(alerts) {
        const container = document.getElementById('alerts-table-container');
        if (!container) return;

        let filtered = alerts;
        if (filterBehavior !== 'all') {
            filtered = alerts.filter(a => a.behavior === filterBehavior);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔔</div>
                    <div class="empty-state-title">No alerts yet</div>
                    <div class="empty-state-desc">Run detection on a video to generate alerts</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Behavior</th>
                        <th>Confidence</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(a => `
                        <tr>
                            <td>${new Date(a.timestamp).toLocaleString()}</td>
                            <td><span class="behavior-tag ${a.behavior}">${a.behavior.replace(/_/g, ' ')}</span></td>
                            <td>
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <div class="progress-bar" style="width:80px;height:4px;">
                                        <div class="progress-bar-fill" style="width:${(a.confidence * 100)}%;"></div>
                                    </div>
                                    <span>${(a.confidence * 100).toFixed(1)}%</span>
                                </div>
                            </td>
                            <td><span style="color:${a.confidence > 0.8 ? 'var(--accent-red)' : 'var(--accent-amber)'};font-size:0.8rem;font-weight:600;">${a.confidence > 0.8 ? '🔴 High' : '🟡 Medium'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function exportCSV(alerts) {
        const header = 'Timestamp,Behavior,Confidence,Status\n';
        const rows = alerts.map(a =>
            `${new Date(a.timestamp).toISOString()},${a.behavior},${(a.confidence * 100).toFixed(1)}%,${a.confidence > 0.8 ? 'High' : 'Medium'}`
        ).join('\n');

        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `detoxvision-alerts-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    return { render };
})();

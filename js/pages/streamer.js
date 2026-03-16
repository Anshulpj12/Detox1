/**
 * Streamer Mode — DetoxVision
 * Minimal UI that activates when ?streamer=true is in the URL.
 * It uses WebRTC (PeerJS) to stream the camera to the main dashboard.
 */
const StreamerPage = (() => {
    let peer = null;
    let localStream = null;

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const hostId = urlParams.get('hostId');
        const slotId = urlParams.get('slot');

        if (!hostId || !slotId) {
            alert('Invalid connection link. Missing hostId or slot details.');
            return;
        }

        // Hide main app container, show minimal streaming UI
        document.getElementById('app').style.display = 'none';
        
        // Create streaming UI
        const streamerUI = document.createElement('div');
        streamerUI.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #0a0a1a; color: white; display: flex; flex-direction: column;
            align-items: center; justify-content: center; z-index: 9999; font-family: Inter, sans-serif;
        `;
        streamerUI.innerHTML = `
            <div style="text-align:center; padding: 24px;">
                <h1 style="margin-bottom: 8px; font-size: 1.5rem; color: #00f5d4;">DetoxVision Local Streamer</h1>
                <p style="color: #8b8b9b; margin-bottom: 24px;">Slot: ${slotId}</p>
                <div id="stream-status" style="padding: 12px 24px; border-radius: 8px; background: rgba(255,200,0,0.1); color: #ffc800; margin-bottom: 24px; font-weight: 500;">
                    ⏳ Requesting Camera...
                </div>
                <!-- Video preview -->
                <video id="local-preview" autoplay playsinline muted style="width: 100%; max-width: 400px; border-radius: 12px; border: 2px solid #2a2a3a; display:none;"></video>
                <button id="end-stream-btn" style="margin-top:24px; padding: 12px 24px; background: #ef476f; border: none; border-radius: 6px; color: white; font-weight: bold; cursor: pointer; display: none;">Stop Streaming</button>
            </div>
        `;
        document.body.appendChild(streamerUI);

        const statusEl = document.getElementById('stream-status');
        const preview = document.getElementById('local-preview');
        const endBtn = document.getElementById('end-stream-btn');

        endBtn.addEventListener('click', () => {
            if (localStream) localStream.getTracks().forEach(t => t.stop());
            if (peer) peer.destroy();
            statusEl.textContent = '⏹ Stream Stopped.';
            statusEl.style.color = '#ef476f'; statusEl.style.background = 'rgba(239,71,111,0.1)';
            endBtn.style.display = 'none';
        });

        try {
            // 1. Get user media
            localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'environment' },
                audio: false
            });
            preview.srcObject = localStream;
            preview.style.display = 'block';

            statusEl.textContent = '🔄 Connecting to Dashboard...';

            // 2. Initialize PeerJS (client connects to nothing just configures itself)
            peer = new Peer();

            peer.on('open', (id) => {
                // 3. Call the Host ID
                const call = peer.call(hostId, localStream, { metadata: { slot: slotId } });
                
                call.on('stream', () => {
                    // Host answered
                    statusEl.textContent = '✅ Broadcasting Live';
                    statusEl.style.color = '#06d6a0'; statusEl.style.background = 'rgba(6,214,160,0.1)';
                    endBtn.style.display = 'inline-block';
                });

                call.on('close', () => {
                    statusEl.textContent = '❌ Host disconnected.';
                    statusEl.style.color = '#ef476f'; statusEl.style.background = 'rgba(239,71,111,0.1)';
                    endBtn.style.display = 'none';
                });
                
                call.on('error', (err) => {
                    statusEl.textContent = '❌ Error connecting: ' + err.message;
                    statusEl.style.color = '#ef476f'; statusEl.style.background = 'rgba(239,71,111,0.1)';
                });
            });

            peer.on('error', (err) => {
                statusEl.textContent = '❌ PeerJS Error: ' + err.message;
                statusEl.style.color = '#ef476f'; statusEl.style.background = 'rgba(239,71,111,0.1)';
            });

        } catch (err) {
            statusEl.textContent = '❌ Camera Access Denied: ' + err.message;
            statusEl.style.color = '#ef476f'; statusEl.style.background = 'rgba(239,71,111,0.1)';
        }
    }

    return { init };
})();

// Auto-init if URL flag is present
if (window.location.search.includes('streamer=true')) {
    window.addEventListener('DOMContentLoaded', StreamerPage.init);
}

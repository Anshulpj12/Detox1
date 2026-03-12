/**
 * Main App — DetoxVision
 * Navigation, page routing, initialization
 */
(async function() {
    // Wait for DOM
    await new Promise(r => {
        if (document.readyState !== 'loading') r();
        else document.addEventListener('DOMContentLoaded', r);
    });

    // Initialize DB
    await DetoxDB.open();

    // Initialize Alert System
    AlertSystem.init();

    // Page registry
    const pages = {
        dashboard: { render: DashboardPage.render, el: document.getElementById('page-dashboard') },
        training:  { render: TrainingPage.render,  el: document.getElementById('page-training') },
        detection: { render: DetectionPage.render,  el: document.getElementById('page-detection') },
        live:      { render: LivePage.render,      el: document.getElementById('page-live') },
        alerts:    { render: AlertsPage.render,    el: document.getElementById('page-alerts') }
    };

    let currentPage = 'dashboard';

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) navigateTo(page);
        });
    });

    function navigateTo(page) {
        if (!pages[page]) return;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

        // Update pages
        Object.values(pages).forEach(p => {
            p.el.classList.remove('active');
            p.el.classList.add('hidden');
        });
        pages[page].el.classList.remove('hidden');
        pages[page].el.classList.add('active');

        // Render page content
        pages[page].render();
        currentPage = page;

        // Clear unread if going to alerts
        if (page === 'alerts') AlertSystem.clearUnread();
    }

    // Alert listener — refresh alerts page if currently viewing it
    AlertSystem.onAlert(() => {
        if (currentPage === 'alerts') AlertsPage.render();
    });

    // Loading sequence
    const loadingScreen = document.getElementById('loading-screen');
    const appContainer = document.getElementById('app');

    // Render initial page
    await DashboardPage.render();

    // Fade out loader, show app
    setTimeout(() => {
        loadingScreen.classList.add('fade-out');
        appContainer.classList.remove('hidden');

        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 600);
    }, 2200);

    // Initialize ML detectors in background (non-blocking)
    setTimeout(async () => {
        try {
            await MLEngine.initDetectors((msg) => {
                const statusText = document.getElementById('model-status-text');
                if (statusText) statusText.textContent = msg;
            });

            // Update dashboard system status if on that page
            if (currentPage === 'dashboard') DashboardPage.render();
        } catch (e) {
            console.warn('Background model loading failed:', e);
        }
    }, 3000);

})();

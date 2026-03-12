/**
 * IndexedDB Wrapper — DetoxVision
 * Stores training data, models metadata, and alert history
 */
const DetoxDB = (() => {
    const DB_NAME = 'DetoxVisionDB';
    const DB_VERSION = 1;
    let db = null;

    function open() {
        return new Promise((resolve, reject) => {
            if (db) return resolve(db);
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains('trainingData')) {
                    const ts = d.createObjectStore('trainingData', { keyPath: 'id', autoIncrement: true });
                    ts.createIndex('label', 'label', { unique: false });
                }
                if (!d.objectStoreNames.contains('models')) {
                    d.createObjectStore('models', { keyPath: 'id' });
                }
                if (!d.objectStoreNames.contains('alerts')) {
                    const as = d.createObjectStore('alerts', { keyPath: 'id', autoIncrement: true });
                    as.createIndex('timestamp', 'timestamp', { unique: false });
                    as.createIndex('behavior', 'behavior', { unique: false });
                }
                if (!d.objectStoreNames.contains('stats')) {
                    d.createObjectStore('stats', { keyPath: 'key' });
                }
            };
            req.onsuccess = (e) => { db = e.target.result; resolve(db); };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function _tx(store, mode) {
        const d = await open();
        return d.transaction(store, mode).objectStore(store);
    }

    function _req(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // Training Data
    async function addTrainingData(features, label) {
        const s = await _tx('trainingData', 'readwrite');
        return _req(s.add({ features, label, timestamp: Date.now() }));
    }

    async function getTrainingData() {
        const s = await _tx('trainingData', 'readonly');
        return _req(s.getAll());
    }

    async function getTrainingDataCount() {
        const s = await _tx('trainingData', 'readonly');
        return _req(s.count());
    }

    async function clearTrainingData() {
        const s = await _tx('trainingData', 'readwrite');
        return _req(s.clear());
    }

    // Models
    async function saveModelMeta(meta) {
        const s = await _tx('models', 'readwrite');
        return _req(s.put(meta));
    }

    async function getModels() {
        const s = await _tx('models', 'readonly');
        return _req(s.getAll());
    }

    async function deleteModel(id) {
        const s = await _tx('models', 'readwrite');
        return _req(s.delete(id));
    }

    // Alerts
    async function addAlert(alert) {
        const s = await _tx('alerts', 'readwrite');
        const id = await _req(s.add({ ...alert, timestamp: Date.now() }));
        return id;
    }

    async function getAlerts() {
        const s = await _tx('alerts', 'readonly');
        const all = await _req(s.getAll());
        return all.sort((a, b) => b.timestamp - a.timestamp);
    }

    async function getAlertCount() {
        const s = await _tx('alerts', 'readonly');
        return _req(s.count());
    }

    async function clearAlerts() {
        const s = await _tx('alerts', 'readwrite');
        return _req(s.clear());
    }

    // Stats
    async function setStat(key, value) {
        const s = await _tx('stats', 'readwrite');
        return _req(s.put({ key, value }));
    }

    async function getStat(key) {
        const s = await _tx('stats', 'readonly');
        const r = await _req(s.get(key));
        return r ? r.value : 0;
    }

    async function incrementStat(key, amount = 1) {
        const current = await getStat(key);
        return setStat(key, current + amount);
    }

    return {
        open, addTrainingData, getTrainingData, getTrainingDataCount, clearTrainingData,
        saveModelMeta, getModels, deleteModel,
        addAlert, getAlerts, getAlertCount, clearAlerts,
        setStat, getStat, incrementStat
    };
})();

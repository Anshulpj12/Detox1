/**
 * ML Engine — DetoxVision
 * Manages TensorFlow.js models for pose detection, face landmarks, and custom behavior classification
 */
const MLEngine = (() => {
    let poseDetector = null;
    let faceDetector = null;
    let classifier = null;
    let labels = [];
    let isModelLoaded = false;
    let isLoadingModels = false;

    const FEATURE_SIZE = 32; // 26 pose + 6 eye features
    const DEFAULT_LABELS = ['normal', 'touching_pocket', 'eye_darting', 'reaching', 'suspicious'];

    /**
     * Initialize TF.js pose and face models
     */
    async function initDetectors(onProgress) {
        if (isLoadingModels) return;
        isLoadingModels = true;

        try {
            if (onProgress) onProgress('Loading TensorFlow.js backend...');
            await tf.ready();
            await tf.setBackend('webgl');

            if (onProgress) onProgress('Loading MoveNet pose detector...');
            // Use MoveNet SinglePose Lightning for speed
            const poseModel = poseDetection.SupportedModels.MoveNet;
            poseDetector = await poseDetection.createDetector(poseModel, {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
            });

            if (onProgress) onProgress('Loading Face Landmarks detector...');
            try {
                const faceModel = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
                faceDetector = await faceLandmarksDetection.createDetector(faceModel, {
                    runtime: 'tfjs',
                    maxFaces: 1,
                    refineLandmarks: false
                });
            } catch (e) {
                console.warn('Face detector failed to load, eye tracking will be limited:', e);
                faceDetector = null;
            }

            if (onProgress) onProgress('Models loaded successfully!');
            isLoadingModels = false;
            return true;
        } catch (err) {
            console.error('Failed to initialize detectors:', err);
            isLoadingModels = false;
            if (onProgress) onProgress('Error loading models: ' + err.message);
            return false;
        }
    }

    /**
     * Detect pose from a video/image element
     */
    async function detectPose(source) {
        if (!poseDetector) return null;
        try {
            const poses = await poseDetector.estimatePoses(source);
            return poses.length > 0 ? poses[0].keypoints : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Detect face landmarks from a video/image element
     */
    async function detectFace(source) {
        if (!faceDetector) return null;
        try {
            const faces = await faceDetector.estimateFaces(source);
            return faces.length > 0 ? faces[0].keypoints : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Extract features from a video frame
     */
    async function extractFrameFeatures(source) {
        const [poseKps, faceKps] = await Promise.all([
            detectPose(source),
            detectFace(source)
        ]);
        const features = FeatureExtractor.extractAllFeatures(poseKps, faceKps);
        return { features, poseKeypoints: poseKps, faceLandmarks: faceKps };
    }

    /**
     * Build and train a custom classifier model
     */
    async function trainClassifier(trainingData, labelList, onEpoch) {
        labels = labelList || DEFAULT_LABELS;
        const numClasses = labels.length;

        // Prepare data
        const xs = [];
        const ys = [];
        trainingData.forEach(item => {
            const labelIdx = labels.indexOf(item.label);
            if (labelIdx >= 0) {
                xs.push(item.features);
                // One-hot encode
                const oneHot = new Array(numClasses).fill(0);
                oneHot[labelIdx] = 1;
                ys.push(oneHot);
            }
        });

        if (xs.length === 0) throw new Error('No valid training data');

        const xTensor = tf.tensor2d(xs);
        const yTensor = tf.tensor2d(ys);

        // Build model
        if (classifier) classifier.dispose();

        classifier = tf.sequential();
        classifier.add(tf.layers.dense({
            inputShape: [FEATURE_SIZE],
            units: 128,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }));
        classifier.add(tf.layers.dropout({ rate: 0.3 }));
        classifier.add(tf.layers.dense({
            units: 64,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }));
        classifier.add(tf.layers.dropout({ rate: 0.2 }));
        classifier.add(tf.layers.dense({
            units: 32,
            activation: 'relu'
        }));
        classifier.add(tf.layers.dense({
            units: numClasses,
            activation: 'softmax'
        }));

        classifier.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        // Train
        const epochs = 50;
        const result = await classifier.fit(xTensor, yTensor, {
            epochs,
            batchSize: Math.min(32, Math.floor(xs.length / 2) || 1),
            validationSplit: 0.2,
            shuffle: true,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (onEpoch) onEpoch(epoch + 1, epochs, logs);
                }
            }
        });

        xTensor.dispose();
        yTensor.dispose();

        isModelLoaded = true;
        updateModelStatus(true);

        return result;
    }

    /**
     * Run classification on feature vector
     */
    function classify(features) {
        if (!classifier || !isModelLoaded) return null;

        const input = tf.tensor2d([features]);
        const prediction = classifier.predict(input);
        const probs = prediction.dataSync();
        input.dispose();
        prediction.dispose();

        const results = labels.map((label, i) => ({
            label,
            confidence: probs[i]
        }));

        results.sort((a, b) => b.confidence - a.confidence);
        return results;
    }

    /**
     * Save model to localStorage + IndexedDB metadata
     */
    async function saveModel(name) {
        if (!classifier) throw new Error('No model to save');

        const modelId = 'detox-model-' + Date.now();
        await classifier.save('localstorage://' + modelId);

        await DetoxDB.saveModelMeta({
            id: modelId,
            name: name || 'Model ' + new Date().toLocaleDateString(),
            labels: labels,
            createdAt: Date.now(),
            featureSize: FEATURE_SIZE
        });

        await DetoxDB.incrementStat('modelsTrained');
        return modelId;
    }

    /**
     * Load model from localStorage
     */
    async function loadModel(modelId) {
        try {
            if (classifier) classifier.dispose();
            classifier = await tf.loadLayersModel('localstorage://' + modelId);

            // Get metadata
            const models = await DetoxDB.getModels();
            const meta = models.find(m => m.id === modelId);
            if (meta) {
                labels = meta.labels;
            }

            isModelLoaded = true;
            updateModelStatus(true);
            return true;
        } catch (e) {
            console.error('Failed to load model:', e);
            return false;
        }
    }

    /**
     * Delete a saved model
     */
    async function deleteModel(modelId) {
        try {
            await tf.io.removeModel('localstorage://' + modelId);
        } catch (e) { /* ignore */ }
        await DetoxDB.deleteModel(modelId);
    }

    /**
     * Export model to a downloadable JSON file
     */
    async function exportModelToFile(modelId) {
        // Get model metadata
        const models = await DetoxDB.getModels();
        const meta = models.find(m => m.id === modelId);
        if (!meta) throw new Error('Model not found');

        // Load model from localStorage
        const savedModel = await tf.loadLayersModel('localstorage://' + modelId);

        // Get model topology and weights
        const saveResult = await savedModel.save(tf.io.withSaveHandler(async (artifacts) => {
            return artifacts;
        }));

        // Convert weights to base64
        const weightData = saveResult.weightData;
        const weightBase64 = arrayBufferToBase64(weightData);

        // Build export package
        const exportData = {
            version: '1.0',
            app: 'DetoxVision',
            metadata: meta,
            modelTopology: saveResult.modelTopology,
            weightSpecs: saveResult.weightSpecs,
            weightData: weightBase64
        };

        // Download as JSON file
        const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${meta.name.replace(/[^a-zA-Z0-9]/g, '_')}_detoxvision.json`;
        link.click();
        URL.revokeObjectURL(url);

        savedModel.dispose();
        return true;
    }

    /**
     * Import model from a JSON file
     */
    async function importModelFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    if (!data.app || data.app !== 'DetoxVision') {
                        throw new Error('Invalid model file. Not a DetoxVision model.');
                    }

                    // Convert base64 back to ArrayBuffer
                    const weightData = base64ToArrayBuffer(data.weightData);

                    // Load model from artifacts
                    const modelArtifacts = {
                        modelTopology: data.modelTopology,
                        weightSpecs: data.weightSpecs,
                        weightData: weightData
                    };

                    if (classifier) classifier.dispose();
                    classifier = await tf.loadLayersModel(tf.io.fromMemory(
                        modelArtifacts.modelTopology,
                        modelArtifacts.weightSpecs,
                        modelArtifacts.weightData
                    ));

                    // Save to localStorage with new ID
                    const newModelId = 'detox-model-' + Date.now();
                    await classifier.save('localstorage://' + newModelId);

                    // Save metadata
                    const meta = {
                        ...data.metadata,
                        id: newModelId,
                        importedAt: Date.now()
                    };
                    await DetoxDB.saveModelMeta(meta);

                    labels = meta.labels || [];
                    isModelLoaded = true;
                    updateModelStatus(true);

                    resolve({ success: true, name: meta.name, id: newModelId });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // Utility: ArrayBuffer to Base64
    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Utility: Base64 to ArrayBuffer
    function base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    function updateModelStatus(loaded) {
        const dot = document.getElementById('model-status-dot');
        const text = document.getElementById('model-status-text');
        if (dot && text) {
            if (loaded) {
                dot.classList.add('active');
                text.textContent = 'Model ready';
            } else {
                dot.classList.remove('active');
                text.textContent = 'No model loaded';
            }
        }
    }

    function getLabels() { return labels; }
    function isReady() { return isModelLoaded; }
    function hasDetectors() { return poseDetector !== null; }

    return {
        initDetectors, detectPose, detectFace, extractFrameFeatures,
        trainClassifier, classify, saveModel, loadModel, deleteModel,
        exportModelToFile, importModelFromFile,
        getLabels, isReady, hasDetectors, DEFAULT_LABELS, FEATURE_SIZE
    };
})();

/**
 * Feature Extractor — DetoxVision
 * Extracts normalized pose and face features from video frames
 */
const FeatureExtractor = (() => {
    // MoveNet keypoint indices
    const KEYPOINTS = {
        NOSE: 0, LEFT_EYE: 1, RIGHT_EYE: 2,
        LEFT_EAR: 3, RIGHT_EAR: 4,
        LEFT_SHOULDER: 5, RIGHT_SHOULDER: 6,
        LEFT_ELBOW: 7, RIGHT_ELBOW: 8,
        LEFT_WRIST: 9, RIGHT_WRIST: 10,
        LEFT_HIP: 11, RIGHT_HIP: 12,
        LEFT_KNEE: 13, RIGHT_KNEE: 14,
        LEFT_ANKLE: 15, RIGHT_ANKLE: 16
    };

    /**
     * Extract feature vector from pose keypoints
     * Returns array of normalized features
     */
    function extractPoseFeatures(keypoints) {
        if (!keypoints || keypoints.length < 17) {
            return new Array(26).fill(0);
        }

        const features = [];
        const kp = keypoints;

        // 1. Normalized keypoint positions (x, y for key joints)
        // Normalize relative to shoulder midpoint
        const shoulderMidX = (kp[KEYPOINTS.LEFT_SHOULDER].x + kp[KEYPOINTS.RIGHT_SHOULDER].x) / 2;
        const shoulderMidY = (kp[KEYPOINTS.LEFT_SHOULDER].y + kp[KEYPOINTS.RIGHT_SHOULDER].y) / 2;
        const shoulderWidth = Math.abs(kp[KEYPOINTS.LEFT_SHOULDER].x - kp[KEYPOINTS.RIGHT_SHOULDER].x) || 1;

        // 2. Hand-to-hip distances (pocket touching indicator)
        const leftWristToHip = distance(kp[KEYPOINTS.LEFT_WRIST], kp[KEYPOINTS.LEFT_HIP]) / shoulderWidth;
        const rightWristToHip = distance(kp[KEYPOINTS.RIGHT_WRIST], kp[KEYPOINTS.RIGHT_HIP]) / shoulderWidth;
        features.push(leftWristToHip, rightWristToHip);

        // 3. Hand-to-pocket area (below hip, close to body)
        const leftHandBelowHip = kp[KEYPOINTS.LEFT_WRIST].y > kp[KEYPOINTS.LEFT_HIP].y ? 1 : 0;
        const rightHandBelowHip = kp[KEYPOINTS.RIGHT_WRIST].y > kp[KEYPOINTS.RIGHT_HIP].y ? 1 : 0;
        features.push(leftHandBelowHip, rightHandBelowHip);

        // 4. Elbow angles (arm bent = reaching/pocket touching)
        const leftElbowAngle = calculateAngle(
            kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.LEFT_ELBOW], kp[KEYPOINTS.LEFT_WRIST]
        ) / 180;
        const rightElbowAngle = calculateAngle(
            kp[KEYPOINTS.RIGHT_SHOULDER], kp[KEYPOINTS.RIGHT_ELBOW], kp[KEYPOINTS.RIGHT_WRIST]
        ) / 180;
        features.push(leftElbowAngle, rightElbowAngle);

        // 5. Shoulder angles (raising arms)
        const leftShoulderAngle = calculateAngle(
            kp[KEYPOINTS.LEFT_HIP], kp[KEYPOINTS.LEFT_SHOULDER], kp[KEYPOINTS.LEFT_ELBOW]
        ) / 180;
        const rightShoulderAngle = calculateAngle(
            kp[KEYPOINTS.RIGHT_HIP], kp[KEYPOINTS.RIGHT_SHOULDER], kp[KEYPOINTS.RIGHT_ELBOW]
        ) / 180;
        features.push(leftShoulderAngle, rightShoulderAngle);

        // 6. Head tilt (nose relative to shoulders)
        const headTiltX = (kp[KEYPOINTS.NOSE].x - shoulderMidX) / shoulderWidth;
        const headTiltY = (kp[KEYPOINTS.NOSE].y - shoulderMidY) / shoulderWidth;
        features.push(headTiltX, headTiltY);

        // 7. Wrist positions normalized
        const leftWristNormX = (kp[KEYPOINTS.LEFT_WRIST].x - shoulderMidX) / shoulderWidth;
        const leftWristNormY = (kp[KEYPOINTS.LEFT_WRIST].y - shoulderMidY) / shoulderWidth;
        const rightWristNormX = (kp[KEYPOINTS.RIGHT_WRIST].x - shoulderMidX) / shoulderWidth;
        const rightWristNormY = (kp[KEYPOINTS.RIGHT_WRIST].y - shoulderMidY) / shoulderWidth;
        features.push(leftWristNormX, leftWristNormY, rightWristNormX, rightWristNormY);

        // 8. Body symmetry (asymmetric poses may indicate hiding)
        const armSymmetry = Math.abs(leftElbowAngle - rightElbowAngle);
        features.push(armSymmetry);

        // 9. Confidence scores of key joints
        const handConfidence = Math.min(
            kp[KEYPOINTS.LEFT_WRIST].score || 0,
            kp[KEYPOINTS.RIGHT_WRIST].score || 0
        );
        features.push(handConfidence);

        // 10. Eye positions relative to nose (head orientation)
        const eyeDistLeft = distance(kp[KEYPOINTS.LEFT_EYE], kp[KEYPOINTS.NOSE]) / shoulderWidth;
        const eyeDistRight = distance(kp[KEYPOINTS.RIGHT_EYE], kp[KEYPOINTS.NOSE]) / shoulderWidth;
        const eyeAsymmetry = Math.abs(eyeDistLeft - eyeDistRight);
        features.push(eyeDistLeft, eyeDistRight, eyeAsymmetry);

        // 11. Torso lean angle
        const hipMidX = (kp[KEYPOINTS.LEFT_HIP].x + kp[KEYPOINTS.RIGHT_HIP].x) / 2;
        const torsoLean = (shoulderMidX - hipMidX) / shoulderWidth;
        features.push(torsoLean);

        // 12. Overall pose compactness
        const bodyHeight = distance(kp[KEYPOINTS.NOSE], {
            x: (kp[KEYPOINTS.LEFT_ANKLE].x + kp[KEYPOINTS.RIGHT_ANKLE].x) / 2,
            y: (kp[KEYPOINTS.LEFT_ANKLE].y + kp[KEYPOINTS.RIGHT_ANKLE].y) / 2
        }) / shoulderWidth;
        features.push(bodyHeight);

        // Pad or trim to exactly 26 features
        while (features.length < 26) features.push(0);
        return features.slice(0, 26);
    }

    /**
     * Extract eye movement features from face landmarks
     */
    function extractEyeFeatures(faceLandmarks) {
        if (!faceLandmarks || faceLandmarks.length === 0) {
            return new Array(6).fill(0);
        }

        const landmarks = faceLandmarks;
        const features = [];

        // Approximate eye center positions from face mesh
        // Left eye: landmarks around 33, 133, 160, 159, 158, 144, 145, 153
        // Right eye: landmarks around 362, 263, 387, 386, 385, 373, 374, 380
        const leftEyeCenter = landmarks[159] || landmarks[33] || { x: 0, y: 0 };
        const rightEyeCenter = landmarks[386] || landmarks[263] || { x: 0, y: 0 };
        const noseTip = landmarks[1] || { x: 0, y: 0 };

        // Eye gaze direction (relative to nose bridge)
        const gazeX = ((leftEyeCenter.x + rightEyeCenter.x) / 2 - noseTip.x);
        const gazeY = ((leftEyeCenter.y + rightEyeCenter.y) / 2 - noseTip.y);
        features.push(gazeX, gazeY);

        // Eye openness (distance between upper and lower eyelid)
        const leftUpper = landmarks[159] || { y: 0 };
        const leftLower = landmarks[145] || { y: 0 };
        const rightUpper = landmarks[386] || { y: 0 };
        const rightLower = landmarks[374] || { y: 0 };
        const leftOpenness = Math.abs(leftUpper.y - leftLower.y);
        const rightOpenness = Math.abs(rightUpper.y - rightLower.y);
        features.push(leftOpenness, rightOpenness);

        // Eye asymmetry (different eye openness could indicate winking/squinting)
        features.push(Math.abs(leftOpenness - rightOpenness));

        // Inter-pupil distance (normalized)
        features.push(distance(leftEyeCenter, rightEyeCenter));

        return features;
    }

    /**
     * Combine pose and eye features into a single feature vector
     */
    function extractAllFeatures(poseKeypoints, faceLandmarks) {
        const poseFeats = extractPoseFeatures(poseKeypoints);
        const eyeFeats = extractEyeFeatures(faceLandmarks);
        return [...poseFeats, ...eyeFeats]; // 32 features total
    }

    // Utility: distance between two points
    function distance(a, b) {
        return Math.sqrt(Math.pow((a.x || 0) - (b.x || 0), 2) + Math.pow((a.y || 0) - (b.y || 0), 2));
    }

    // Utility: angle between three points (in degrees)
    function calculateAngle(a, b, c) {
        const ab = { x: a.x - b.x, y: a.y - b.y };
        const cb = { x: c.x - b.x, y: c.y - b.y };
        const dot = ab.x * cb.x + ab.y * cb.y;
        const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y) || 1;
        const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y) || 1;
        const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
        return Math.acos(cosAngle) * (180 / Math.PI);
    }

    return { extractPoseFeatures, extractEyeFeatures, extractAllFeatures, KEYPOINTS };
})();

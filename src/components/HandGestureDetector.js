import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';

const HandGestureDetector = ({ onGestureDetected, isActive }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const handsRef = useRef(null);
  const animationFrameRef = useRef(null);
  // Stabilization state
  const gestureBuffer = useRef([]);
  const STABILIZATION_FRAMES = 10; // ~0.5s at 20fps
  const [visualGesture, setVisualGesture] = useState(null);

  useEffect(() => {
    if (isActive) {
      setIsCameraActive(true);
    } else {
      setIsCameraActive(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!webcamRef.current || !canvasRef.current || !window.Hands) return;

    const initializeHands = async () => {
      try {
        // Cleanup previous instance if it exists
        if (handsRef.current) {
          handsRef.current.close();
          handsRef.current = null;
        }

        // Create new instance
        handsRef.current = new window.Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
          }
        });

        handsRef.current.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7
        });

        handsRef.current.onResults((results) => {
          if (!canvasRef.current) return;
          const canvasCtx = canvasRef.current.getContext('2d');
          canvasCtx.save();
          canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // Draw the video frame
          if (results.image) {
            canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
          }

          // Draw hand landmarks
          if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
              // Draw connections
              for (let i = 0; i < window.HAND_CONNECTIONS.length; i++) {
                const [start, end] = window.HAND_CONNECTIONS[i];
                canvasCtx.beginPath();
                canvasCtx.moveTo(landmarks[start].x * canvasRef.current.width, landmarks[start].y * canvasRef.current.height);
                canvasCtx.lineTo(landmarks[end].x * canvasRef.current.width, landmarks[end].y * canvasRef.current.height);
                canvasCtx.strokeStyle = '#00FF00';
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();
              }

              // Draw landmarks
              for (let i = 0; i < landmarks.length; i++) {
                const landmark = landmarks[i];
                canvasCtx.beginPath();
                canvasCtx.arc(
                  landmark.x * canvasRef.current.width,
                  landmark.y * canvasRef.current.height,
                  2,
                  0,
                  2 * Math.PI
                );
                canvasCtx.fillStyle = '#FF0000';
                canvasCtx.fill();
              }
            }

            // Detect gesture if hand is present
            if (results.multiHandLandmarks.length > 0) {
              const gesture = detectGesture(results.multiHandLandmarks[0]);
              setVisualGesture(gesture); // Visual feedback
              if (gesture) {
                // Stabilization: only trigger if same gesture for 10 consecutive frames
                gestureBuffer.current.push(gesture);
                if (gestureBuffer.current.length > STABILIZATION_FRAMES) {
                  gestureBuffer.current.shift();
                }
                const allSame = gestureBuffer.current.length === STABILIZATION_FRAMES && gestureBuffer.current.every(g => g === gesture);
                if (allSame) {
                  onGestureDetected(gesture);
                  gestureBuffer.current = [];
                }
              } else {
                gestureBuffer.current = [];
              }
            } else {
              setVisualGesture(null);
            }
          }
          canvasCtx.restore();
        });

        // Start processing frames
        if (webcamRef.current && webcamRef.current.video) {
          const video = webcamRef.current.video;
          const sendFrame = async () => {
            if (video.readyState === 4 && handsRef.current) {
              try {
                await handsRef.current.send({ image: video });
              } catch (error) {
                console.error('Error sending frame:', error);
                return;
              }
            }
            if (isCameraActive) {
              animationFrameRef.current = requestAnimationFrame(sendFrame);
            }
          };
          sendFrame();
        }
      } catch (error) {
        console.error('Error initializing hands:', error);
      }
    };

    if (isCameraActive) {
      initializeHands();
    }

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (handsRef.current) {
        try {
          handsRef.current.close();
          handsRef.current = null;
        } catch (error) {
          console.error('Error closing hands:', error);
        }
      }
    };
  }, [isCameraActive, onGestureDetected]);

  // Robust finger extension check
  const isFingerExtended = (tip, pip, mcp, wrist, axis = 'y', angle, angleThreshold = 140) => {
    // For vertical hand, y-axis: tip.y < pip.y < mcp.y < wrist.y (for up)
    // For horizontal hand, x-axis: tip.x > pip.x > mcp.x > wrist.x (for right hand, palm facing camera)
    // Use both angle and position
    if (axis === 'y') {
      return (tip.y < pip.y && pip.y < mcp.y && angle < angleThreshold);
    } else {
      return (tip.x > pip.x && pip.x > mcp.x && angle < angleThreshold);
    }
  };

  const detectGesture = (landmarks) => {
    // Get finger tip, pip, mcp positions
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const thumbPip = landmarks[3];
    const indexPip = landmarks[6];
    const middlePip = landmarks[10];
    const ringPip = landmarks[14];
    const pinkyPip = landmarks[18];

    const thumbMcp = landmarks[2];
    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const ringMcp = landmarks[13];
    const pinkyMcp = landmarks[17];

    const wrist = landmarks[0];

    // Calculate angles for each finger
    const getAngle = (tip, pip, wrist) => {
      const tipToPip = {
        x: tip.x - pip.x,
        y: tip.y - pip.y
      };
      const pipToWrist = {
        x: pip.x - wrist.x,
        y: pip.y - wrist.y
      };
      const dot = tipToPip.x * pipToWrist.x + tipToPip.y * pipToWrist.y;
      const mag1 = Math.sqrt(tipToPip.x * tipToPip.x + tipToPip.y * tipToPip.y);
      const mag2 = Math.sqrt(pipToWrist.x * pipToWrist.x + pipToWrist.y * pipToWrist.y);
      return Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
    };

    // Angles
    const thumbAngle = getAngle(thumbTip, thumbPip, wrist);
    const indexAngle = getAngle(indexTip, indexPip, wrist);
    const middleAngle = getAngle(middleTip, middlePip, wrist);
    const ringAngle = getAngle(ringTip, ringPip, wrist);
    const pinkyAngle = getAngle(pinkyTip, pinkyPip, wrist);

    // For simplicity, use y-axis for all except thumb (use x-axis for thumb)
    const indexExtended = isFingerExtended(indexTip, indexPip, indexMcp, wrist, 'y', indexAngle);
    const middleExtended = isFingerExtended(middleTip, middlePip, middleMcp, wrist, 'y', middleAngle);
    const ringExtended = isFingerExtended(ringTip, ringPip, ringMcp, wrist, 'y', ringAngle);
    const pinkyExtended = isFingerExtended(pinkyTip, pinkyPip, pinkyMcp, wrist, 'y', pinkyAngle);
    // Thumb: use x-axis, right hand palm facing camera
    const thumbExtended = isFingerExtended(thumbTip, thumbPip, thumbMcp, wrist, 'x', thumbAngle);

    // Ignore thumb for 1-4, only count thumb for 5
    let extendedFingers = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;
    if (extendedFingers === 4 && thumbExtended) {
      extendedFingers = 5;
    }
    // Only allow 1-5
    if (extendedFingers >= 1 && extendedFingers <= 5) {
      return extendedFingers;
    }
    return null;
  };

  return (
    <div className="hand-gesture-detector">
      <div className="camera-container" style={{position: 'relative'}}>
        <Webcam
          ref={webcamRef}
          style={{ 
            display: isCameraActive ? 'block' : 'none',
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          videoConstraints={{
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
        {/* Visual feedback for detected number */}
        {visualGesture && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            zIndex: 10
          }}>
            {visualGesture}
          </div>
        )}
      </div>
      <button
        onClick={() => setIsCameraActive(!isCameraActive)}
        className="camera-toggle"
        style={{
          fontSize: 'clamp(0.9rem, 3vw, 1rem)',
          padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 20px)'
        }}
      >
        {isCameraActive ? 'Stop Camera' : 'Start Camera'}
      </button>
    </div>
  );
};

export default HandGestureDetector; 
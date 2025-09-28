import React, { useRef, useEffect, useState } from "react";
import * as blazeface from "@tensorflow-models/blazeface";
import "@tensorflow/tfjs";
import { Slide, Fade } from "react-awesome-reveal";
import { motion } from "framer-motion";

const DETECTION_INTERVAL = 500; // milliseconds

const App = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [personDetected, setPersonDetected] = useState(false);
  const [step, setStep] = useState("start");
  const [showButton, setShowButton] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Helper: speak only once and callback after done
  function speak(text, callback) {
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => {
      if (callback) callback();
    };
    // Select proper voice
    const voices = window.speechSynthesis.getVoices();
    utter.voice = voices.find(v => v.lang.startsWith("en") && v.localService) || voices[0];
    window.speechSynthesis.speak(utter);
  }

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = "#202040";
  }, []);

  useEffect(() => {
    let model;
    let lastDetection = 0;

    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("Camera not supported on this device/browser.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try { await videoRef.current.play(); } catch (err) {}
            model = await blazeface.load();

            // Throttled detection loop
            const detectPerson = async () => {
              const now = Date.now();
              if (videoRef.current && model && now - lastDetection > DETECTION_INTERVAL) {
                lastDetection = now;

                const predictions = await model.estimateFaces(videoRef.current, false);
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                if (predictions.length > 0) {
                  if (!personDetected) {
                    setPersonDetected(true);
                    setStep("greet");
                    setHasSpoken(false);
                  }

                  // Only speak once when person is detected
                  if (!hasSpoken) {
                    setHasSpoken(true);
                    speak("Welcome to our photography. Would you like to take a photo?", () => {
                      setIsListening(true);
                      startSpeechRecognition();
                    });
                  }

                  predictions.forEach(face => {
                    const start = face.topLeft, end = face.bottomRight;
                    ctx.strokeStyle = "#3f51b5";
                    ctx.lineWidth = 4;
                    ctx.strokeRect(start[0], start[1], end[0] - start[0], end[1] - start[1]);
                  });
                } else {
                  setPersonDetected(false);
                  setShowButton(false);
                  setHasSpoken(false);
                  setIsListening(false);
                }
              }
              requestAnimationFrame(detectPerson);
            };
            detectPerson();
          };
        }
      } catch (e) {
        alert("Camera error: " + e.message);
        console.error(e);
      }
    }
    setupCamera();
    // eslint-disable-next-line
  }, []);

  // Speech Recognition ONLY after welcome is spoken, once!
  function startSpeechRecognition() {
    if (!isListening) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.start();

    recognition.onresult = (event) => {
      setIsListening(false);
      const text = event.results[0][0].transcript.toLowerCase();
      if (text.includes("yes")) {
        setShowButton(true);
        speak("Please click the button below to take a photo.");
      } else if (text.includes("no")) {
        setShowButton(false);
        setTimeout(() => {
          speak("Thank you, visit again.");
          setStep("end");
        }, 400);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };
  }

  function handleCapture() {
    const context = canvasRef.current.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    setTimeout(() => {
      speak("Thank you!");
      setStep("end");
      setShowButton(false);
    }, 500);
  }

  return (
    <div style={{
      height: "100vh", width: "100vw", overflow: "hidden",
      display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column"
    }}>
      <Slide direction="down" triggerOnce>
        <motion.h1
          style={{ color: "#fff", marginBottom: "20px", fontFamily: "Poppins,sans-serif" }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >Interactive Photography Experience</motion.h1>
      </Slide>

      <div style={{ position: "relative", width: "320px", maxWidth: "90vw" }}>
        <video
          ref={videoRef}
          width={320}
          height={240}
          autoPlay
          playsInline
          muted
          style={{
            borderRadius: "16px",
            border: "4px solid #3f51b5",
            zIndex: 2,
            boxShadow: "0 0 20px #3f51b599",
            background: "#000"
          }}
        />
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            borderRadius: "16px",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
        {personDetected && <Fade triggerOnce>
          <motion.div
            style={{
              position: "absolute",
              top: "0", left: "0", width: "100%", height: "100%",
              background: "rgba(63,81,181,.13)", borderRadius: "16px",
              zIndex: 4, display: "flex", alignItems: "center", justifyContent: "center"
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <motion.span style={{
              color: "#fff", fontWeight: 700, fontSize: "1.1rem", textAlign: "center",
              background: "linear-gradient(90deg,#5271ff 30%,#ffa069 70%)",
              padding: "8px 18px", borderRadius: "12px", boxShadow: "0 0 8px #5271ff55"
            }}>
              Person Detected!
            </motion.span>
          </motion.div>
        </Fade>}
      </div>

      {showButton && (
        <Fade delay={400} cascade>
          <motion.button
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{
              marginTop: "32px",
              background: "linear-gradient(90deg,#5271ff 70%,#4527a0 100%)",
              color: "#fff", fontWeight: "600", fontSize: "1.13rem",
              border: "none", borderRadius: "10px", padding: "14px 32px",
              cursor: "pointer", boxShadow: "0 6px 22px #5271ff55"
            }}
            onClick={handleCapture}
          >
            📸 Take Photo
          </motion.button>
        </Fade>
      )}

      {step === "end" && (
        <Fade>
          <motion.div
            style={{
              marginTop: "40px", color: "#fff", fontWeight: "600",
              fontSize: "1.18rem", background: "#212160",
              padding: "20px 20px", borderRadius: "10px"
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            Thank you for visiting! 🎉
          </motion.div>
        </Fade>
      )}
    </div>
  );
};

export default App;

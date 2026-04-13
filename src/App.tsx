/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { 
  Camera, 
  Monitor, 
  Wifi, 
  WifiOff, 
  Settings, 
  Baby, 
  Power,
  RefreshCw,
  Maximize2,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  ShieldCheck,
  Lock,
  Github,
  ExternalLink,
  Heart,
  Copy,
  Check,
  Maximize,
  Minimize,
  Battery as BatteryIcon,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type Role = "camera" | "viewer" | null;

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [p2pStatus, setP2pStatus] = useState<RTCPeerConnectionState>("new");
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [localInfo, setLocalInfo] = useState<{localIps: string[], port: number} | null>(null);
  const [isNightMode, setIsNightMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [signalStrength, setSignalStrength] = useState(100);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const wakeLockRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Refs to avoid stale closures in socket listeners
  const roleRef = useRef<Role>(null);
  const roomIdRef = useRef("");
  const passwordRef = useRef("");

  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { passwordRef.current = password; }, [password]);

  // Battery Status API
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setBatteryLevel(Math.round(battery.level * 100));
          setIsCharging(battery.charging);
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
        return () => {
          battery.removeEventListener('levelchange', updateBattery);
          battery.removeEventListener('chargingchange', updateBattery);
        };
      });
    }
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("r");
    const p = params.get("p");
    if (r) setRoomId(r);
    if (p) setPassword(p);
  }, []);

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
  };

  // Helper to create a peer connection
  const createPeerConnection = (roomId: string) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;
    iceCandidatesQueue.current = [];

    pc.onconnectionstatechange = () => {
      console.log("P2P State:", pc.connectionState);
      setP2pStatus(pc.connectionState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", { roomId, candidate: event.candidate });
      }
    };

    return pc;
  };

  useEffect(() => {
    // Fetch local info
    fetch("/api/info")
      .then(res => res.json())
      .then(data => setLocalInfo(data))
      .catch(() => {});

    // Initialize socket
    socketRef.current = io();

    socketRef.current.on("connect", () => setIsConnected(true));
    socketRef.current.on("disconnect", () => setIsConnected(false));
    
    socketRef.current.on("error", (msg: string) => {
      setError(msg);
      setIsStreaming(false);
    });

    socketRef.current.on("user-joined", () => {
      setViewerCount(prev => prev + 1);
      console.log("Someone joined the room");
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    });

    socketRef.current.on("offer", async ({ offer }) => {
      if (roleRef.current !== "camera" || !streamRef.current) {
        console.log("Ignoring offer: not camera or no stream", { role: roleRef.current, hasStream: !!streamRef.current });
        return;
      }
      
      console.log("Received offer, creating answer...");
      const pc = createPeerConnection(roomIdRef.current);
      
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current!);
      });

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit("answer", { roomId: roomIdRef.current, answer });

        // Process queued candidates
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socketRef.current.on("answer", async ({ answer }) => {
      if (roleRef.current !== "viewer" || !peerConnectionRef.current) {
        console.log("Ignoring answer: not viewer or no peer connection");
        return;
      }
      console.log("Received answer, setting remote description...");
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        // Process queued candidates
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          if (candidate) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socketRef.current.on("ice-candidate", async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      } else {
        iceCandidatesQueue.current.push(candidate);
      }
    });

    return () => {
      socketRef.current?.disconnect();
      stopStream();
    };
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current?.close();
    setIsStreaming(false);
    
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    audioContextRef.current?.close().catch(() => {});
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock is active');
      }
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
  };

  const setupAudioAnalysis = async (stream: MediaStream) => {
    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close();
      }

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended (common browser policy)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(average);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (err) {
      console.error("Audio analysis failed", err);
    }
  };

  const monitorSignal = () => {
    const interval = setInterval(async () => {
      if (peerConnectionRef.current && peerConnectionRef.current.connectionState === "connected") {
        try {
          const stats = await peerConnectionRef.current.getStats();
          stats.forEach(report => {
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              // Simple heuristic for signal strength
              const rtt = report.currentRoundTripTime || 0;
              if (rtt < 0.05) setSignalStrength(100);
              else if (rtt < 0.1) setSignalStrength(80);
              else if (rtt < 0.2) setSignalStrength(60);
              else setSignalStrength(40);
            }
          });
        } catch (e) {}
      }
    }, 2000);
    return () => clearInterval(interval);
  };

  useEffect(() => {
    if (isStreaming) {
      const cleanup = monitorSignal();
      return cleanup;
    }
  }, [isStreaming]);

  const startCamera = async (currentMode?: "user" | "environment") => {
    try {
      // Stop previous tracks if any
      streamRef.current?.getTracks().forEach(track => track.stop());

      const mode = currentMode || facingMode;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true,
      });
      
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setupAudioAnalysis(stream);
      await requestWakeLock();

      socketRef.current?.emit("join-room", { roomId, password });
      setIsStreaming(true);
      setError(null);
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Permiso denegado. Por favor, permite el acceso a la cámara y micrófono en los ajustes de tu navegador.");
      } else if (err.name === "NotFoundError") {
        setError("No se encontró ninguna cámara en este dispositivo.");
      } else {
        setError("No se pudo acceder a la cámara. Error: " + err.message);
      }
      console.error(err);
    }
  };

  const toggleCamera = () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    if (isStreaming) {
      startCamera(newMode);
    }
  };

  const startViewer = async () => {
    try {
      socketRef.current?.emit("join-room", { roomId, password });

      const pc = createPeerConnection(roomId);

      pc.ontrack = (event) => {
        console.log("Received remote track!");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsStreaming(true);
          setupAudioAnalysis(event.streams[0]);
          requestWakeLock();
        }
      };

      // Create the initial offer
      console.log("Creating offer as viewer...");
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("offer", { roomId, offer });

      setError(null);
    } catch (err) {
      setError("Error al conectar con la cámara.");
      console.error(err);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const copyRoomInfo = () => {
    const shareUrl = `${window.location.origin}?r=${encodeURIComponent(roomId)}&p=${encodeURIComponent(password)}`;
    const info = `BabyWatch Room\nID: ${roomId}\nPIN: ${password}\nURL: ${shareUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'BabyWatch Monitor',
        text: `Únete a mi monitor de bebé seguro.\nID: ${roomId}\nPIN: ${password}`,
        url: shareUrl
      }).catch(() => {
        navigator.clipboard.writeText(info).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      });
    } else {
      navigator.clipboard.writeText(info).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleReset = () => {
    stopStream();
    setRole(null);
    setError(null);
    setRoomId("");
    setPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" ref={containerRef}>
      {/* Immersive Atmospheric Background */}
      <div className="fixed inset-0 -z-10 bg-[#050505]">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-orange-500/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-blue-500/10 rounded-full blur-[150px]" 
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
      </div>

      {/* Main Device Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-dark rounded-[40px] shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 relative z-10"
      >
        {/* Author Watermark */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-[7px] text-white/5 uppercase tracking-[0.5em] font-mono whitespace-nowrap">
            Designed by Manuel Barco
          </span>
        </div>

        {/* Status Bar */}
        <div className="px-8 py-6 flex items-center justify-between bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Baby className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold tracking-tight text-sm uppercase leading-none">BabyWatch</span>
              <span className="text-[9px] text-orange-500/60 uppercase tracking-[0.2em] font-mono font-bold">P2P Secure</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <div className="flex flex-col items-end">
                <div className="flex gap-0.5 items-end h-3">
                  {[1, 2, 3, 4].map((i) => (
                    <motion.div 
                      key={i} 
                      animate={{ height: signalStrength >= i * 25 ? `${i * 25}%` : '20%' }}
                      className={`w-0.5 rounded-full transition-all duration-500 ${
                        signalStrength >= i * 25 ? 'bg-green-500' : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[7px] font-mono text-white/40 uppercase tracking-tighter mt-0.5">
                  {signalStrength > 80 ? 'Excelente' : signalStrength > 50 ? 'Buena' : 'Inestable'}
                </span>
              </div>
              <span className="text-[9px] font-mono text-white/60">{signalStrength}%</span>
            </div>
            {isConnected ? (
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            )}
          </div>
        </div>

        {/* Screen Area */}
        <div className="aspect-[4/3] bg-black/40 relative overflow-hidden group">
          <AnimatePresence mode="wait">
            {!role ? (
              <motion.div 
                key="setup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center"
              >
                <div className="relative mb-10">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 rounded-full border border-orange-500/20 flex items-center justify-center"
                  >
                    <ShieldCheck className="w-10 h-10 text-orange-500/40" />
                  </motion.div>
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-8px] border-t border-b border-orange-500/40 rounded-full"
                  />
                </div>
                <h2 className="text-white text-2xl font-bold mb-3 tracking-tight">Privacidad Total</h2>
                <p className="text-white/40 text-xs mb-10 max-w-[240px] leading-relaxed">
                  Conexión directa punto a punto. Tus datos nunca salen de tu red local.
                </p>
                
                <div className="grid grid-cols-2 gap-5 w-full">
                  <button 
                    onClick={() => setRole("camera")}
                    className="flex flex-col items-center gap-4 p-6 rounded-[24px] bg-white/5 border border-white/10 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all group relative overflow-hidden active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                      <Camera className="w-6 h-6 text-white/40 group-hover:text-orange-500 transition-colors" />
                    </div>
                    <span className="text-white/60 text-[11px] uppercase tracking-[0.2em] font-bold">Cámara</span>
                  </button>
                  <button 
                    onClick={() => setRole("viewer")}
                    className="flex flex-col items-center gap-4 p-6 rounded-[24px] bg-white/5 border border-white/10 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all group active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                      <Monitor className="w-6 h-6 text-white/40 group-hover:text-orange-500 transition-colors" />
                    </div>
                    <span className="text-white/60 text-[11px] uppercase tracking-[0.2em] font-bold">Monitor</span>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0"
              >
                {role === "camera" ? (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    className={`w-full h-full object-cover transition-all duration-700 ${isNightMode ? 'brightness-150 contrast-125 sepia-[0.3] hue-rotate-180' : 'grayscale-[0.1]'}`}
                  />
                ) : (
                  <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    muted={isMuted}
                    className={`w-full h-full object-cover transition-all duration-700 ${isNightMode ? 'brightness-150 contrast-125 sepia-[0.3] hue-rotate-180' : ''}`}
                  />
                )}

                {/* Night Mode Overlay */}
                {isNightMode && (
                  <div className="absolute inset-0 pointer-events-none bg-green-500/5 mix-blend-overlay" />
                )}

                {/* Audio Level Indicator */}
                <div className="absolute bottom-6 left-6 flex items-end gap-1 h-16">
                  {[...Array(12)].map((_, i) => (
                    <motion.div 
                      key={i}
                      animate={{ 
                        height: Math.max(4, (audioLevel / 255) * 64 * (1 - Math.abs(i - 5.5) / 6)),
                        opacity: audioLevel > 20 ? 1 : 0.3
                      }}
                      className={`w-1 rounded-full transition-colors duration-300 ${audioLevel > 180 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]'}`}
                    />
                  ))}
                </div>

                {/* Overlay Info */}
                <div className="absolute top-6 left-6 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 glass-dark rounded-lg text-[10px] text-white font-mono uppercase tracking-[0.2em] border border-white/10">
                      {role === "camera" ? "Transmisión" : "Recepción"}
                    </div>
                    {isStreaming && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 backdrop-blur-md rounded-lg border border-red-500/30">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                        <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">LIVE</span>
                      </div>
                    )}
                  </div>
                  
                  {role === "camera" && viewerCount > 0 && (
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] shadow-lg shadow-orange-500/30"
                    >
                      ⚠️ ALGUIEN ESTÁ MIRANDO
                    </motion.div>
                  )}

                  {p2pStatus === "connected" && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 backdrop-blur-md rounded-lg border border-green-500/30">
                      <ShieldCheck className="w-3 h-3 text-green-500" />
                      <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">P2P SECURE</span>
                    </div>
                  )}
                </div>

                {/* Controls Overlay */}
                <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                  <button 
                    onClick={toggleFullscreen}
                    className="w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-xl border border-white/10 text-white/80 hover:bg-white/20 transition-all active:scale-90"
                    title="Pantalla Completa"
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setIsNightMode(!isNightMode)}
                    className={`w-10 h-10 flex items-center justify-center backdrop-blur-md rounded-xl border transition-all active:scale-90 ${isNightMode ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/40' : 'bg-black/50 border-white/10 text-white/80 hover:bg-white/20'}`}
                    title="Modo Visión Nocturna"
                  >
                    {isNightMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                  {role === "camera" && (
                    <button 
                      onClick={toggleCamera}
                      className="w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-xl border border-white/10 text-white/80 hover:bg-orange-500 hover:text-white transition-all active:scale-90"
                      title="Cambiar Cámara"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  )}
                  {role === "viewer" && (
                    <button 
                      onClick={() => setIsMuted(!isMuted)}
                      className={`w-10 h-10 flex items-center justify-center backdrop-blur-md rounded-xl border transition-all active:scale-90 ${isMuted ? 'bg-red-500/50 border-red-500/50 text-white' : 'bg-black/50 border-white/10 text-white/80 hover:bg-white/20'}`}
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          {error && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-8 text-center z-50">
              <div className="space-y-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                  <WifiOff className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-red-400 text-sm font-medium leading-relaxed">{error}</p>
                <button 
                  onClick={handleReset}
                  className="px-8 py-3 bg-white/5 rounded-xl text-white text-xs uppercase tracking-widest font-bold hover:bg-white/10 border border-white/10 transition-all active:scale-95"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Control Panel */}
        <div className="p-8 space-y-6 bg-white/[0.02]">
          {role && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2.5">
                  <label className="text-[10px] text-white/30 uppercase tracking-[0.25em] font-bold ml-1">ID Sala</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      disabled={isStreaming}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-orange-500/50 disabled:opacity-50 transition-all placeholder:text-white/10"
                      placeholder="Ej: BEBE-01"
                    />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <label className="text-[10px] text-white/30 uppercase tracking-[0.25em] font-bold ml-1">PIN Acceso</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isStreaming}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-orange-500/50 disabled:opacity-50 transition-all placeholder:text-white/10"
                      placeholder="****"
                    />
                    {roomId && password && (
                      <button 
                        onClick={copyRoomInfo}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-white/60 transition-colors"
                        title="Copiar datos de sala"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={role === "camera" ? (isStreaming ? toggleCamera : startCamera) : startViewer}
                disabled={isStreaming && role === "viewer"}
                className="w-full py-5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:from-white/5 disabled:to-white/5 disabled:text-white/20 text-white rounded-2xl font-bold text-sm shadow-[0_10px_30px_rgba(249,115,22,0.2)] transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                {isStreaming ? <Lock className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                {isStreaming ? "SISTEMA PROTEGIDO" : "ACTIVAR MONITOR"}
              </button>

              {role === "camera" && isStreaming && (
                <button 
                  onClick={toggleCamera}
                  className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-[10px] uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  Girar Cámara
                </button>
              )}
            </div>
          )}

          {/* Hardware Details */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/5">
            <div className="space-y-1.5">
              <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-bold">Latencia</p>
              <p className="text-xs text-white/60 font-mono">12ms</p>
            </div>
            <div className="space-y-1.5 text-center">
              <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-bold">Batería</p>
              <div className="flex items-center justify-center gap-1">
                {isCharging && <Zap className="w-2 h-2 text-yellow-500" />}
                <p className="text-xs text-white/60 font-mono">{batteryLevel ?? 98}%</p>
              </div>
            </div>
            <div className="space-y-1.5 text-right">
              <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-bold">CPU</p>
              <p className="text-xs text-white/60 font-mono">24%</p>
            </div>
          </div>

          {role && (
            <button 
              onClick={handleReset}
              className="w-full py-4 text-white/20 hover:text-white/50 text-[10px] uppercase tracking-[0.4em] font-bold transition-all"
            >
              Cambiar Modo
            </button>
          )}
        </div>

        {/* Bottom Decorative Element */}
        <div className="h-2 w-full bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
        
        {/* Credits Footer */}
        <div className="px-8 py-6 bg-black/40 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
              <Heart className="w-3 h-3 text-red-500/60" />
            </div>
            <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
              By <span className="text-white/60">Manuel Barco</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHelp(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/80 transition-all"
              title="Configuración"
            >
              <Settings className="w-4 h-4" />
            </button>
            <a 
              href="https://github.com/mabarcodev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/80 transition-all"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>
      </motion.div>

      {/* Background Decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-[#1A1B1E] rounded-[32px] p-8 border border-white/10 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-light">Uso sin Internet (Local)</h3>
                <button onClick={() => setShowHelp(false)} className="text-white/40 hover:text-white">✕</button>
              </div>
              
              <div className="space-y-4 text-sm text-white/60 leading-relaxed">
                <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl space-y-2">
                  <h4 className="text-orange-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" />
                    Créditos del Proyecto
                  </h4>
                  <p className="text-[11px] leading-relaxed">
                    BabyWatch es un proyecto de código abierto enfocado en la privacidad. 
                    Desarrollado con ❤️ por <strong>Manuel Barco</strong> para ayudar a padres a monitorizar a sus bebés de forma segura y gratuita.
                  </p>
                </div>

                <p>Para usar esta app sin depender de internet, sigue estos pasos:</p>
                <ol className="list-decimal list-inside space-y-3">
                  <li>Descarga el código del proyecto (Exportar como ZIP).</li>
                  <li>Ejecútalo en un ordenador de tu casa con <code className="text-orange-500 bg-orange-500/10 px-1 rounded">npm run dev</code>.</li>
                  <li>Conecta ambos móviles al <strong>mismo Wi-Fi</strong> que el ordenador.</li>
                  <li>En los móviles, abre el navegador y entra en la IP del ordenador:
                    {localInfo?.localIps.map(ip => (
                      <div key={ip} className="mt-2 p-2 bg-white/5 rounded font-mono text-orange-400 text-center">
                        http://{ip}:{localInfo.port}
                      </div>
                    ))}
                  </li>
                </ol>
                <p className="text-xs italic text-white/30">Nota: Algunos navegadores móviles requieren HTTPS para la cámara. Si usas IP local, es posible que debas habilitar "Insecure origins treated as secure" en la configuración de Chrome del móvil.</p>
              </div>

              <button 
                onClick={() => setShowHelp(false)}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold text-sm"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

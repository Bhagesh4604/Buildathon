import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, Volume2, AlertCircle, Clapperboard, X, Play, Globe, Monitor, StopCircle, User, ArrowLeft, History, FileText, MousePointer2, CheckCircle, Code2, Terminal, Maximize2, Minimize2, BookOpen, PenTool } from 'lucide-react';
import { db } from '../services/mockDatabase';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, arrayBufferToBase64, AUDIO_SAMPLE_RATE_INPUT, AUDIO_SAMPLE_RATE_OUTPUT } from '../services/audioUtils';
import { analyzeAndFixCode } from '../services/geminiService';
import { createShapeId, toRichText } from '@tldraw/tldraw';
import { Whiteboard } from './Whiteboard';
import { SupportedLanguage, AIVoice, TranscriptItem, LiveSession, CodeSnippet } from '../types';

interface LiveTutorProps {
  onBack?: () => void;
}

// Tool Definition for Coding
const writeCodeDeclaration: FunctionDeclaration = {
  name: 'writeCode',
  description: 'Write programming code for the student to see. Use this when asked to teach how to code, write a script, or demonstrate a concept via code. Explain the code verbally while this tool is active.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: { type: Type.STRING, description: 'The complete code snippet to write.' },
      language: { type: Type.STRING, description: 'The programming language (e.g., python, javascript).' },
      filename: { type: Type.STRING, description: 'A suitable filename (e.g., script.py)' }
    },
    required: ['code', 'language']
  }
};

// Tool Definition for General Subjects (Math, Science, History notes)
const writeNotesDeclaration: FunctionDeclaration = {
  name: 'writeNotes',
  description: 'Write key concepts, math formulas, historical timelines, or summaries on a virtual whiteboard. Use this for non-coding subjects like Math, Physics, History, etc.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Topic title (e.g., "Newton\'s Second Law")' },
      content: { type: Type.STRING, description: 'The structured notes, formula, or bullet points to write.' }
    },
    required: ['title', 'content']
  }
};

export const LiveTutor: React.FC<LiveTutorProps> = ({ onBack }) => {
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const [explanation, setExplanation] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const isMicOnRef = useRef(isMicOn);
  isMicOnRef.current = isMicOn;
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // History / Transcript State
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const codeSnippetsRef = useRef<CodeSnippet[]>([]);
  const [currentInput, setCurrentInput] = useState(''); 
  const [currentOutput, setCurrentOutput] = useState(''); 
  const [showHistory, setShowHistory] = useState(false);
  const [pastSessions, setPastSessions] = useState<LiveSession[]>([]);
  const sessionStartTimeRef = useRef<number>(0);

  // Screen Share State
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenIntervalRef = useRef<number | null>(null);

  // Remote Debugger / Ghost Mouse State
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [ghostMousePos, setGhostMousePos] = useState({ x: 50, y: 50 });
  const [fixedCodeResult, setFixedCodeResult] = useState<{ fixedCode: string, explanation: string } | null>(null);
  const [isFixingCode, setIsFixingCode] = useState(false);

  // Live Coding Studio State
  const [codeSession, setCodeSession] = useState<{ targetCode: string, displayedCode: string, language: string, filename: string, isVisible: boolean }>({
    targetCode: '',
    displayedCode: '',
    language: 'plaintext',
    filename: 'code.txt',
    isVisible: false
  });

  const [noteSession, setNoteSession] = useState<{ targetContent: string, displayedContent: string, title: string, isVisible: boolean }>({
    targetContent: '',
    displayedContent: '',
    title: '',
    isVisible: false
  });

  const typeWriterIntervalRef = useRef<number | null>(null);
  const noteWriterIntervalRef = useRef<number | null>(null);

  // Video Gen State
  const [showVideoPrompt, setShowVideoPrompt] = useState(false);
  const [videoPromptInput, setVideoPromptInput] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // State Refs for Closures (Audio Loop)
  const connectedRef = useRef(false);
  const sessionRef = useRef<any>(null); // To store the active session object
  
  // Analyzer for visualizer
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const student = db.getCurrentStudent();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(student.preferredLanguage);
  const [selectedVoice, setSelectedVoice] = useState<AIVoice>(student.preferredVoice || AIVoice.Kore);

  const apiKey = import.meta.env.VITE_API_KEY;

  useEffect(() => {
    setSelectedLanguage(student.preferredLanguage);
    setSelectedVoice(student.preferredVoice || AIVoice.Kore);
    setPastSessions(db.getLiveSessions(student.id));
  }, [student.id, student.preferredLanguage, student.preferredVoice]);

  // Ghost Mouse Animation Loop
  useEffect(() => {
    let mouseInterval: number;
    if (isDebugMode) {
      mouseInterval = window.setInterval(() => {
        setGhostMousePos({
           x: 20 + Math.random() * 60,
           y: 20 + Math.random() * 60
        });
      }, 2000);
    }
    return () => clearInterval(mouseInterval);
  }, [isDebugMode]);

  // Typewriter Effect for Live Code
  useEffect(() => {
    if (codeSession.isVisible && codeSession.targetCode) {
      if (typeWriterIntervalRef.current) clearInterval(typeWriterIntervalRef.current);
      let currentIndex = codeSession.displayedCode.length;
      if (!codeSession.targetCode.startsWith(codeSession.displayedCode)) {
        currentIndex = 0;
        setCodeSession(prev => ({ ...prev, displayedCode: '' }));
      }

      if (currentIndex < codeSession.targetCode.length) {
        typeWriterIntervalRef.current = window.setInterval(() => {
          if (currentIndex < codeSession.targetCode.length) {
            const char = codeSession.targetCode[currentIndex];
            setCodeSession(prev => ({ ...prev, displayedCode: prev.displayedCode + char }));
            currentIndex++;
          } else {
            if (typeWriterIntervalRef.current) clearInterval(typeWriterIntervalRef.current);
          }
        }, 15);
      }
    }
    return () => { if (typeWriterIntervalRef.current) clearInterval(typeWriterIntervalRef.current); };
    }, [codeSession.targetCode, codeSession.isVisible]);
  
    // Typewriter Effect for Notes/Whiteboard
    useEffect(() => {
      if (noteSession.isVisible && noteSession.targetContent) {
        if (noteWriterIntervalRef.current) clearInterval(noteWriterIntervalRef.current);
        let currentIndex = noteSession.displayedContent.length;
        if (!noteSession.targetContent.startsWith(noteSession.displayedContent)) {
          currentIndex = 0;
          setNoteSession(prev => ({ ...prev, displayedContent: '' }));
        }
  
        if (currentIndex < noteSession.targetContent.length) {
          noteWriterIntervalRef.current = window.setInterval(() => {
            if (currentIndex < noteSession.targetContent.length) {
              const char = noteSession.targetContent[currentIndex];
              setNoteSession(prev => ({ ...prev, displayedContent: prev.displayedContent + char }));
              currentIndex++;
            } else {
              if (noteWriterIntervalRef.current) clearInterval(noteWriterIntervalRef.current);
            }
          }, 30); // Slower for notes to feel like writing
        }
      }
      return () => { if (noteWriterIntervalRef.current) clearInterval(noteWriterIntervalRef.current); };
    }, [noteSession.targetContent, noteSession.isVisible]);
  
    // Cleanup Function
    const cleanupAudio = async () => {
    if (sessionStartTimeRef.current > 0) {
      const session: LiveSession = {
        id: `sess_${Date.now()}`,
        startTime: sessionStartTimeRef.current,
        endTime: Date.now(),
        transcript: [...transcript],
        codeSnippets: [...codeSnippetsRef.current]
      };
      db.saveLiveSession(student.id, session);
      setPastSessions(prev => [session, ...prev]);
    }
    
    setTranscript([]);
    codeSnippetsRef.current = [];
    setCurrentInput('');
    setCurrentOutput('');
    sessionStartTimeRef.current = 0;

    connectedRef.current = false;
    sessionRef.current = null;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    activeSourcesRef.current.clear();

    if (inputContextRef.current && inputContextRef.current.state !== 'closed') {
      try { await inputContextRef.current.close(); } catch (e) {}
    }
    inputContextRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { await audioContextRef.current.close(); } catch (e) {}
    }
    audioContextRef.current = null;

    if (typeWriterIntervalRef.current) clearInterval(typeWriterIntervalRef.current);
  };

  const stopScreenShare = () => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
    setIsDebugMode(false);
  };

  const handleDisconnect = () => {
    stopScreenShare();
    cleanupAudio();
    setIsConnected(false);
    setIsConnecting(false);
    connectedRef.current = false;
    setCodeSession(prev => ({ ...prev, isVisible: false }));
  };

  const startSession = async () => {
    if (!apiKey) {
      setErrorMessage("API Key is missing in environment variables.");
      return;
    }

    if (isConnecting) return;
    
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      await cleanupAudio(); 
      await new Promise(r => setTimeout(r, 500));

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: AUDIO_SAMPLE_RATE_OUTPUT });
      inputContextRef.current = new AudioContextClass({ sampleRate: AUDIO_SAMPLE_RATE_INPUT });

      await Promise.all([
        audioContextRef.current.resume(),
        inputContextRef.current.resume(),
      ]);

      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      analyzerRef.current.connect(audioContextRef.current.destination);

    if (!navigator.mediaDevices) {
        console.error("navigator.mediaDevices is undefined.");
        setErrorMessage("Your browser does not support the necessary features for the live tutor. (navigator.mediaDevices is undefined)");
        setIsConnecting(false);
        return;
    }
    if (!navigator.mediaDevices.getUserMedia) {
        console.error("navigator.mediaDevices.getUserMedia is undefined.");
        setErrorMessage("Your browser does not support the necessary features for the live tutor. (getUserMedia is undefined)");
        setIsConnecting(false);
        return;
    }
    console.log("navigator.mediaDevices:", navigator.mediaDevices);
    const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
    });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const ai = new GoogleGenAI({ apiKey: apiKey });
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          tools: [
            { functionDeclarations: [writeCodeDeclaration, writeNotesDeclaration] } // Added Notes Tool
          ],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are NXT TUTOR, an expert AI Multi-Subject Tutor capable of teaching Coding, Math, Science, History, and more.
          
          CAPABILITIES:
          1. **Explain:** Verbally explain concepts simply in ${selectedLanguage}.
          
          2. **Write Code (For Programming):** 
             - If teaching coding, use the 
writeCode
 tool.
             - Speak while writing.
             
          3. **Write Notes (For Math/Science/History/etc.):**
             - If explaining a formula (e.g., F=ma), a timeline, or a list of facts, use the 
writeNotes
 tool.
             - This opens a virtual whiteboard. Write key points there while you talk.
          
          BEHAVIOR:
          - Be encouraging and Socratic.
          - If the student shares their screen, look at their content and offer help.`,
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Socket Opened");
            sessionStartTimeRef.current = Date.now();
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              try {
                const uint8 = base64ToUint8Array(audioData);
                const audioBuffer = await decodeAudioData(uint8, audioContextRef.current);
                playAudioChunk(audioBuffer);
              } catch (e) {
                console.error("Error decoding audio chunk", e);
              }
            }

            // Handle Tool Calls
            const toolCall = msg.toolCall;
            if (toolCall) {
              for (const fc of toolCall.functionCalls) {
                
                // CODE TOOL
                if (fc.name === 'writeCode') {
                  const args = fc.args as any;
                  codeSnippetsRef.current.push({
                    language: args.language || 'plaintext',
                    code: args.code,
                    filename: args.filename,
                    timestamp: Date.now()
                  });

                  // Close Note Session if open
                  // setNoteSession(prev => ({...prev, isVisible: false}));

                  setCodeSession({
                    targetCode: args.code,
                    displayedCode: '',
                    language: args.language || 'plaintext',
                    filename: args.filename || 'script.js',
                    isVisible: true
                  });

                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: { id: fc.id, name: fc.name, response: { result: "Code editor active." } }
                    });
                  });
                }
                
                // NOTES TOOL
                if (fc.name === 'writeNotes') {
                   const args = fc.args as any;
                   
                   // Close Code Session if open
                   setCodeSession(prev => ({...prev, isVisible: false}));

                   setIsWhiteboardOpen(true);
                   if (whiteboardRef.current) {
                     whiteboardRef.current.addShapes([
                       {
                         id: createShapeId(),
                         type: 'text',
                         x: 100,
                         y: 100,
                         props: {
                           richText: toRichText(args.content),
                           size: 'm',
                           align: 'middle',
                           font: 'draw',
                           color: 'black'
                         }
                       }
                     ]);
                   }

                   sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: { id: fc.id, name: fc.name, response: { result: "Whiteboard active." } }
                    });
                  });
                }
              }
            }

            // Handle Transcription
            const userInput = msg.serverContent?.inputTranscription?.text;
            if (userInput) setCurrentInput(prev => prev + userInput);
            
            const modelOutput = msg.serverContent?.outputTranscription?.text;
            if (modelOutput) setCurrentOutput(prev => prev + modelOutput);

            if (msg.serverContent?.turnComplete) {
               setTranscript(prev => {
                 const newItems: TranscriptItem[] = [];
                 if (currentInput.trim()) newItems.push({ role: 'user', text: currentInput, timestamp: Date.now() });
                 if (currentOutput.trim()) newItems.push({ role: 'model', text: currentOutput, timestamp: Date.now() });
                 return [...prev, ...newItems];
               });
               setCurrentInput('');
               setCurrentOutput('');
            }
          },
          onclose: (e) => {
            console.log("Gemini Live Closed", e);
            handleDisconnect();
          },
          onerror: (err: any) => {
            console.error("Gemini Live Error Callback:", err);
            const msg = err.message || err.toString();
            if (msg.includes("unavailable") || msg.includes("aborted") || msg.includes("disconnect")) {
               setErrorMessage("Service is temporarily unavailable. Please try again.");
               handleDisconnect();
            }
          }
        }
      });

      sessionPromise.then((session) => {
        sessionRef.current = session;
        connectedRef.current = true;
        setIsConnected(true);
        setIsConnecting(false);
        setupAudioInput(); 
        startVisualizer();
      }).catch((err) => {
        console.error("Connection Failed:", err);
        setErrorMessage("Connection failed. Check console.");
        handleDisconnect();
      });

    } catch (error: any) {
      console.error("Session Start Error:", error);
      setErrorMessage(error.message || "Failed to start session.");
      handleDisconnect();
    }
  };

  const setupAudioInput = () => {
    if (!inputContextRef.current || !streamRef.current) return;

    const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
    sourceRef.current = source;
    const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!isMicOnRef.current || !connectedRef.current || !sessionRef.current) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);

      try {
        sessionRef.current.sendRealtimeInput({ media: pcmBlob });
      } catch (err) {}
    };

    source.connect(processor);
    processor.connect(inputContextRef.current.destination);
  };

  const handleScreenShare = async () => {
    if (!isConnected) { alert("Please start the live session first."); return; }

    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.onloadedmetadata = () => {
          screenVideoRef.current?.play();
          startScreenStreaming();
        };
      }
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) return;
      setErrorMessage("Failed to share screen.");
    }
  };

  const startScreenStreaming = () => {
    if (!screenVideoRef.current || !screenCanvasRef.current) return;
    screenIntervalRef.current = window.setInterval(async () => {
      if (!connectedRef.current || !sessionRef.current || !screenVideoRef.current || !screenCanvasRef.current) return;

      const video = screenVideoRef.current;
      const canvas = screenCanvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx && video.videoWidth > 0) {
        const scale = Math.min(1024 / video.videoWidth, 1);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob && connectedRef.current && sessionRef.current) {
             const buffer = await blob.arrayBuffer();
             const base64Data = arrayBufferToBase64(buffer);
             try {
                sessionRef.current.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64Data } });
             } catch(e) { } // ignore
          }
        }, 'image/jpeg', 0.6);
      }
    }, 1000); 
  };

  const handleAutoDebug = async () => {
    if (!screenCanvasRef.current) return;
    setIsDebugMode(true);
    setIsFixingCode(true);

    screenCanvasRef.current.toBlob(async (blob) => {
      if(blob) {
        const buffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        try {
          const result = await analyzeAndFixCode(base64, selectedLanguage);
          setFixedCodeResult(result);
        } catch(e) {
          setFixedCodeResult({ fixedCode: "// Failed to analyze", explanation: "Network error occurred." });
        } finally {
          setIsFixingCode(false);
        }
      }
    }, 'image/jpeg');
  };

  const playAudioChunk = (buffer: AudioBuffer) => {
    if (!audioContextRef.current || !analyzerRef.current) return;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(analyzerRef.current);
    const currentTime = audioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
    activeSourcesRef.current.add(source);
    source.onended = () => activeSourcesRef.current.delete(source);
  };

  const startVisualizer = () => {
    const render = () => {
      if (!analyzerRef.current || !avatarCanvasRef.current || !connectedRef.current) return;
      const canvas = avatarCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyzerRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzerRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const average = sum / bufferLength;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 60 + (average * 0.5);
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(99, 102, 241, ${Math.min(0.6, average / 128)})`; 
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, 60, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(99, 102, 241, ${Math.min(1, average / 64)})`;
      ctx.lineWidth = 4;
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(render);
    };
    render();
  };

  const handleGenerateVideo = async () => {
    if (!videoPromptInput.trim()) return;
    try {
       const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
       if (!hasKey) {
          const success = await (window as any).aistudio?.openSelectKey();
          if(!success && !(window as any).aistudio?.hasSelectedApiKey()) return;
       }
    } catch(e) {}

    setIsGeneratingVideo(true);
    setShowVideoPrompt(false);
    
    try {
       const ai = new GoogleGenAI({ apiKey: apiKey || '' });
       let operation = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: `Educational animation explaining ${videoPromptInput}. Clear visuals, simple math diagrams. Language: ${selectedLanguage}.`,
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
       });
       while (!operation.done) {
          await new Promise(r => setTimeout(r, 4000));
          operation = await ai.operations.getVideosOperation({operation});
       }
       const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
       if (uri) {
          const vidResp = await fetch(`${uri}&key=${apiKey}`);
          const blob = await vidResp.blob();
          setGeneratedVideoUrl(URL.createObjectURL(blob));
       }
    } catch (e) {
       alert("Failed to generate video.");
    } finally {
       setIsGeneratingVideo(false);
       setVideoPromptInput('');
    }
  };

  const whiteboardRef = useRef(null);

  const handleExplainDrawing = async () => {
    if (whiteboardRef.current) {
      const shapes = whiteboardRef.current.getShapes();
      if (shapes.length === 0) {
        setExplanation("The whiteboard is empty. Please draw something to get an explanation.");
        return;
      }

      setExplanation("Thinking...");

      try {
        const genAI = new GoogleGenAI(apiKey || '');
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `Please explain the following drawing from a whiteboard. The drawing is represented by a JSON object of shapes. Each shape has a type, position, and other properties. Here is the JSON object: ${JSON.stringify(shapes)}`;
        
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        setExplanation(text);
      } catch (error) {
        console.error("Error explaining drawing:", error);
        setExplanation("Sorry, I couldn't understand the drawing.");
      }
    }
  };

  useEffect(() => {
    return () => { cleanupAudio(); stopScreenShare(); };
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded-xl overflow-hidden text-white relative">
      {isWhiteboardOpen && <Whiteboard ref={whiteboardRef} onExplain={handleExplainDrawing} />}
      {explanation && (
        <div className="absolute bottom-24 right-6 bg-gray-800 p-4 rounded-xl shadow-lg z-30 max-w-sm">
          <h3 className="font-bold mb-2">Explanation</h3>
          <p className="text-sm">{explanation}</p>
          <button onClick={() => setExplanation(null)} className="mt-4 text-xs text-gray-400 hover:text-white">Close</button>
        </div>
      )}
      <video ref={screenVideoRef} className="hidden" muted playsInline />
      <canvas ref={screenCanvasRef} className="hidden" />

      <div className="flex-1 relative flex items-center justify-center bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>

        {onBack && !isConnected && (
           <button onClick={onBack} className="absolute top-6 left-6 z-50 p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-white transition-colors">
             <ArrowLeft className="w-5 h-5" />
           </button>
        )}
        
        {!isConnected && (
           <button onClick={() => setShowHistory(true)} className="absolute top-6 right-6 z-50 p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-white transition-colors">
             <History className="w-5 h-5" />
           </button>
        )}

        <div className={`relative z-10 flex flex-col items-center transition-all duration-500 ${generatedVideoUrl || isScreenSharing || codeSession.isVisible ? 'scale-75 -translate-y-24' : ''}`}>
          <div className="relative w-48 h-48">
            <canvas ref={avatarCanvasRef} width={300} height={300} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"/>
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-800 shadow-2xl mx-auto top-8 bg-gray-800">
               <img src="https://api.dicebear.com/7.x/bottts/svg?seed=NXT-TUTOR&backgroundColor=6366f1" alt="AI Tutor" className="w-full h-full object-cover"/>
            </div>
          </div>
          
          <div className="mt-8 text-center min-h-[60px]">
             <h2 className="text-2xl font-bold tracking-tight">NXT TUTOR Live Tutor</h2>
             {!errorMessage ? (
               <p className={`text-sm mt-2 font-medium ${isConnected ? 'text-indigo-400' : 'text-gray-400'}`}>
                 {isGeneratingVideo ? 'Generating Visuals...' : 
                  codeSession.isVisible ? 'Teaching Code...' : 
                  isScreenSharing ? 'Analyzing Screen...' : 
                  isConnected ? 'Listening...' : isConnecting ? 'Connecting...' : 'Ready to start'}
               </p>
             ) : (
               <div className="mt-2 text-xs bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-1 rounded-full inline-flex items-center space-x-1">
                 <AlertCircle className="w-3 h-3" />
                 <span>{errorMessage}</span>
               </div>
             )}
          </div>
        </div>

        {/* --- LIVE CODE STUDIO OVERLAY --- */}
        {codeSession.isVisible && (
          <div className="absolute inset-0 bg-gray-900/95 z-40 flex items-center justify-center p-4 md:p-12 animate-fade-in backdrop-blur-md">
             <div className="w-full max-w-5xl h-full max-h-[80vh] bg-[#1e1e1e] rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
                {/* Editor Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-black">
                   <div className="flex items-center space-x-2">
                      <Terminal className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-300 font-mono">{codeSession.filename}</span>
                      <span className="text-[10px] text-gray-500 ml-2">• AI Live Typing</span>
                   </div>
                   <div className="flex items-center space-x-3">
                      <div className="flex space-x-1.5">
                         <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                         <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                         <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                      </div>
                      <button 
                        onClick={() => setCodeSession(prev => ({...prev, isVisible: false}))}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Close Editor"
                      >
                         <Minimize2 className="w-4 h-4" />
                      </button>
                   </div>
                </div>
                
                {/* Editor Body */}
                <div className="flex-1 p-6 overflow-y-auto font-mono text-sm relative custom-scrollbar bg-[#1e1e1e]">
                   <div className="absolute top-0 left-0 bottom-0 w-12 bg-[#1e1e1e] border-r border-[#333] flex flex-col items-end pr-3 pt-6 text-gray-600 select-none">
                      {codeSession.displayedCode.split('\n').map((_, i) => (
                         <div key={i} className="leading-6">{i + 1}</div>
                      ))}
                   </div>
                   <pre className="pl-16 text-gray-300 leading-6 whitespace-pre-wrap">
                      {codeSession.displayedCode}
                      <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse align-middle ml-1"></span>
                   </pre>
                </div>

                {/* Status Bar */}
                <div className="bg-[#007acc] text-white px-3 py-1 text-[10px] flex justify-between items-center">
                   <div className="flex space-x-3">
                      <span>main*</span>
                      <span>Ln {codeSession.displayedCode.split('\n').length}, Col 1</span>
                   </div>
                   <div className="flex space-x-3">
                      <span>{codeSession.language.toUpperCase()}</span>
                      <span>UTF-8</span>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* --- LIVE WHITEBOARD OVERLAY (MATH/NOTES) --- */}
        {noteSession.isVisible && (
          <div className="absolute inset-0 bg-gray-900/95 z-40 flex items-center justify-center p-4 md:p-12 animate-fade-in backdrop-blur-md">
             <div className="w-full max-w-4xl h-full max-h-[80vh] bg-[#2d2d2d] rounded-xl border border-gray-600 shadow-2xl flex flex-col overflow-hidden">
                {/* Board Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#3d3d3d] border-b border-gray-600">
                   <div className="flex items-center space-x-2">
                      <BookOpen className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-white font-bold">{noteSession.title}</span>
                   </div>
                   <button 
                     onClick={() => setNoteSession(prev => ({...prev, isVisible: false}))}
                     className="text-gray-400 hover:text-white transition-colors"
                   >
                      <Minimize2 className="w-5 h-5" />
                   </button>
                </div>
                
                {/* Board Body */}
                <div className="flex-1 p-8 overflow-y-auto font-serif text-lg leading-relaxed relative custom-scrollbar bg-[#2d2d2d] text-white">
                   <div className="whitespace-pre-wrap">
                      {noteSession.displayedContent}
                      <span className="inline-block w-2 h-5 bg-green-500 animate-pulse align-middle ml-1"></span>
                   </div>
                </div>
                
                {/* Chalk Tray / Footer */}
                <div className="bg-[#3d3d3d] px-4 py-2 border-t border-gray-600 flex justify-between items-center">
                   <div className="flex items-center space-x-4">
                      <div className="flex items-center text-xs text-gray-400">
                         <PenTool className="w-3 h-3 mr-1" /> AI Writing...
                      </div>
                   </div>
                   <div className="text-[10px] text-gray-500">Smart Whiteboard v1.0</div>
                </div>
             </div>
          </div>
        )}

        {generatedVideoUrl && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-6 animate-slide-up z-30">
            <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
              <div className="flex justify-between items-center p-3 bg-gray-900 border-b border-gray-700">
                 <div className="flex items-center space-x-2 text-indigo-400">
                    <Clapperboard className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">AI Visual Solution</span>
                 </div>
                 <button onClick={() => setGeneratedVideoUrl(null)} className="hover:text-white text-gray-400"><X className="w-4 h-4" /></button>
              </div>
              <video src={generatedVideoUrl} controls autoPlay loop className="w-full aspect-video bg-black"/>
            </div>
          </div>
        )}

        {isScreenSharing && (
          <div className="absolute top-6 left-6 w-96 h-56 bg-gray-800 rounded-xl overflow-hidden border-2 border-green-500 shadow-lg z-20 relative group">
            <div className="absolute top-2 left-2 bg-green-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm z-10 flex items-center">
               <Monitor className="w-3 h-3 mr-1" /> SHARING SCREEN
            </div>
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={handleAutoDebug} disabled={isFixingCode || isDebugMode} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center shadow-lg">
                 {isFixingCode ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Code2 className="w-3 h-3 mr-1" />} {isDebugMode ? 'Debugging...' : 'Auto-Fix Code'}
               </button>
            </div>
            <video ref={(el) => { if (el && screenStreamRef.current) el.srcObject = screenStreamRef.current; }} autoPlay muted className="w-full h-full object-cover"/>
            {isDebugMode && (
              <div className="absolute w-6 h-6 z-20 transition-all duration-700 ease-in-out" style={{ left: `${ghostMousePos.x}%`, top: `${ghostMousePos.y}%` }}>
                <MousePointer2 className="w-6 h-6 text-red-500 fill-red-500/20" />
              </div>
            )}
          </div>
        )}

        {fixedCodeResult && (
           <div className="absolute inset-0 bg-black/80 z-40 flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
                 <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                    <div className="flex items-center space-x-2">
                       <CheckCircle className="w-5 h-5 text-green-500" />
                       <h3 className="font-bold text-white">AI Code Fix</h3>
                    </div>
                    <button onClick={() => { setFixedCodeResult(null); setIsDebugMode(false); }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-0 grid grid-cols-1 md:grid-cols-2">
                    <div className="p-6 border-r border-gray-700">
                       <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">Explanation</h4>
                       <p className="text-gray-200 leading-relaxed text-sm whitespace-pre-wrap">{fixedCodeResult.explanation}</p>
                    </div>
                    <div className="p-0 bg-black">
                       <pre className="p-6 text-xs md:text-sm font-mono text-green-400 overflow-x-auto">{fixedCodeResult.fixedCode}</pre>
                    </div>
                 </div>
              </div>
           </div>
        )}

        <div className="absolute bottom-6 right-6 w-48 h-36 bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-700 shadow-lg transition-transform hover:scale-105 z-20">
           <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover mirror ${!isCameraOn ? 'hidden' : ''}`}/>
           {!isCameraOn && <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-800"><VideoOff className="w-8 h-8" /></div>}
        </div>

        {showVideoPrompt && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-2">Generate Visual Explanation</h3>
                <input type="text" value={videoPromptInput} onChange={(e) => setVideoPromptInput(e.target.value)} placeholder="e.g. Pythagorean Theorem" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white mb-4"/>
                <div className="flex justify-end space-x-3">
                   <button onClick={() => setShowVideoPrompt(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                   <button onClick={handleGenerateVideo} disabled={!videoPromptInput.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Generate</button>
                </div>
             </div>
          </div>
        )}

        {showHistory && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
             <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                   <h3 className="font-bold text-white flex items-center"><History className="w-5 h-5 mr-2" />Session Transcripts</h3>
                   <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                   {pastSessions.map(session => (
                     <div key={session.id} className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                        <div className="text-xs text-gray-400 mb-2">{new Date(session.startTime).toLocaleTimeString()}</div>
                        {session.transcript.map((item, idx) => (
                          <div key={idx} className={`text-sm mb-1 ${item.role === 'user' ? 'text-indigo-300' : 'text-gray-300'}`}>
                             <span className="font-bold uppercase text-[10px] mr-2">{item.role}:</span>{item.text}
                          </div>
                        ))}
                        {session.codeSnippets && session.codeSnippets.length > 0 && (
                          <div className="mt-3 p-3 bg-black rounded-lg border border-gray-700">
                            <div className="text-xs text-gray-400 mb-2 flex items-center">
                               <Code2 className="w-3 h-3 mr-1"/> Generated Code
                            </div>
                            {session.codeSnippets.map((snip, i) => (
                               <div key={i} className="mb-2 last:mb-0">
                                   <div className="flex justify-between text-[10px] text-gray-500 bg-gray-800 px-2 py-1 rounded-t">
                                        <span>{snip.filename}</span>
                                        <span>{snip.language}</span>
                                   </div>
                                   <pre className="text-[10px] text-green-400 font-mono bg-gray-900 p-2 rounded-b overflow-x-auto">
                                       {snip.code}
                                   </pre>
                               </div>
                            ))}
                          </div>
                        )}
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}
      </div>

      <div className="bg-gray-800 p-6 flex justify-center items-center space-x-6 border-t border-gray-700 z-20">
         {!isConnected && !isConnecting ? (
           <div className="flex flex-col items-center space-y-4 w-full">
              <button onClick={startSession} className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg">
                <Volume2 className="w-6 h-6" /><span>Start Live Session</span>
              </button>
           </div>
         ) : isConnecting ? (
           <button disabled className="flex items-center space-x-3 bg-gray-700 text-gray-400 px-8 py-4 rounded-full font-semibold text-lg">
             <Loader2 className="w-6 h-6 animate-spin" /><span>Connecting...</span>
           </button>
         ) : (
           <>
             <button onClick={() => setIsMicOn(!isMicOn)} className={`p-4 rounded-full ${isMicOn ? 'bg-gray-700' : 'bg-red-500/20 text-red-500'}`}>{isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}</button>
             <button onClick={handleDisconnect} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center space-x-2"><PhoneOff className="w-5 h-5" /><span>End Call</span></button>
             <button onClick={() => setIsCameraOn(!isCameraOn)} className={`p-4 rounded-full ${isCameraOn ? 'bg-gray-700' : 'bg-red-500/20 text-red-500'}`}>{isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}</button>
             <div className="h-8 w-px bg-gray-700 mx-2"></div>
             <button onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)} className={`p-4 rounded-full ${isWhiteboardOpen ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}><PenTool className="w-6 h-6" /></button>
             <button onClick={isScreenSharing ? stopScreenShare : handleScreenShare} className={`p-4 rounded-full ${isScreenSharing ? 'bg-green-600 text-white' : 'bg-gray-700'}`}>{isScreenSharing ? <StopCircle className="w-6 h-6 animate-pulse" /> : <Monitor className="w-6 h-6" />}</button>
             <button onClick={() => setShowVideoPrompt(true)} disabled={isGeneratingVideo} className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white">{isGeneratingVideo ? <Loader2 className="w-6 h-6 animate-spin" /> : <Clapperboard className="w-6 h-6" />}</button>
           </>
         )}
      </div>

      <style>{`
        .mirror { transform: scaleX(-1); }
        @keyframes slide-up { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: #1e1e1e; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
      `}</style>
    </div>
  );
};

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Loader2, Globe, Bell, Volume2, Square, StopCircle, Plus, MessageSquare, ChevronLeft, Menu, PanelLeftClose, PanelLeftOpen, Paperclip, Mic, X, Image as ImageIcon, FileText, Sparkles } from 'lucide-react';
import { getSocraticResponse, getAudioOverview, generateChatTitle, transcribeAudio, visualizeText } from '@/services/geminiService';
import { db } from '@/services/mockDatabase';
import { Message, UserRole, Sentiment, SupportedLanguage, TeacherMessage, ChatConversation, Attachment } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  fontFamily: '"Jost", sans-serif',
});

const StepMessage: React.FC<{ message: Message }> = ({ message }) => {
  const [displayedSteps, setDisplayedSteps] = useState<string[]>([]);
  const mermaidRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (message.steps && message.steps.length > 0) {
      const allSteps = message.steps;
      let currentStep = 0;
      setDisplayedSteps([]);

      const timer = setInterval(() => {
        if (currentStep < allSteps.length) {
          setDisplayedSteps(prev => [...prev, allSteps[currentStep]]);
          currentStep++;
        } else {
          clearInterval(timer);
        }
      }, 500 + Math.random() * 300); // Slower, more deliberate typing

      return () => clearInterval(timer);
    }
  }, [message.steps]);

  useEffect(() => {
    displayedSteps.forEach((step, index) => {
      if (step.includes('```mermaid')) {
        const mermaidCodeMatch = step.match(/```mermaid\n([\s\S]*?)\n```/);
        if (mermaidCodeMatch && mermaidRefs.current[index]) {
          const code = mermaidCodeMatch[1];
          try {
            mermaid.render(`mermaid-chart-${message.id}-${index}`, code).then(({ svg }) => {
              if (mermaidRefs.current[index]) {
                mermaidRefs.current[index]!.innerHTML = svg;
              }
            });
          } catch (e) {
            console.error("Mermaid render error:", e);
          }
        }
      }
    });
  }, [displayedSteps, message.id]);

  const renderStepContent = (step: string, index: number) => {
    const mermaidMatch = step.match(/```mermaid\n([\s\S]*?)\n```/);
    if (mermaidMatch) {
      return <div ref={el => mermaidRefs.current[index] = el} className="mermaid-chart" />;
    }

    const codeMatch = step.match(/```(\w+)\n([\s\S]*?)\n```/);
    if (codeMatch) {
      return (
        <SyntaxHighlighter language={codeMatch[1]} style={vscDarkPlus} customStyle={{ borderRadius: '0.5rem', padding: '1rem', margin: '0.5rem 0' }}>
          {codeMatch[2]}
        </SyntaxHighlighter>
      );
    }

    if (step.startsWith('$$') && step.endsWith('$$')) {
      return <BlockMath math={step.substring(2, step.length - 2)} />;
    }

    const parts = step.split(/(\$.*? Ge$)/g);
    return (
      <p className="leading-relaxed">
        {parts.map((part, i) =>
          part.startsWith('$') && part.endsWith('$') ? (
            <InlineMath key={i} math={part.substring(1, part.length - 1)} />
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </p>
    );
  };

  return (
    <div className="space-y-4 font-mono">
      {displayedSteps.map((step, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.3 }}
        >
          {renderStepContent(step, index)}
        </motion.div>
      ))}
      {displayedSteps.length === (message.steps?.length || 0) && message.content && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (message.steps?.length || 0) * 0.1 + 0.2, duration: 0.3 }}
          className="mt-4 font-sans text-gray-500"
        >
          {message.content}
        </motion.p>
      )}
    </div>
  );
};

export const StudentChat: React.FC = () => {
  const currentStudent = db.getCurrentStudent();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [language, setLanguage] = useState<SupportedLanguage>(currentStudent.preferredLanguage || SupportedLanguage.ENGLISH);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showHistorySidebar, setShowHistorySidebar] = useState(true);
  
  // Audio Playback State
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Teacher Inbox
  const [teacherMessages, setTeacherMessages] = useState<TeacherMessage[]>([]);
  const [showInbox, setShowInbox] = useState(false);

  // File & Voice Input State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load Conversations and Messages
  useEffect(() => {
    const convs = db.getConversations(currentStudent.id);
    setConversations(convs);

    if (convs.length > 0) {
      // If we don't have an active conversation, pick the most recent one
      if (!activeConvId) {
        setActiveConvId(convs[0].id);
        setMessages(convs[0].messages);
      } else {
        // If we do have an active ID, sync messages
        const active = convs.find(c => c.id === activeConvId);
        if (active) setMessages(active.messages);
      }
    } else {
      // Initialize fresh if empty
      handleNewChat();
    }
  }, [currentStudent.id, activeConvId]);

  // Update language immediately if student changes it in Profile or other tabs
  useEffect(() => {
    setLanguage(currentStudent.preferredLanguage || SupportedLanguage.ENGLISH);
  }, [currentStudent.id, currentStudent.preferredLanguage]);

  // Poll for messages
  useEffect(() => {
    const interval = setInterval(() => {
      setTeacherMessages(db.getStudentMessages(currentStudent.id));
    }, 2000);
    setTeacherMessages(db.getStudentMessages(currentStudent.id));
    return () => clearInterval(interval);
  }, [currentStudent.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, attachment]); // Scroll when attachment added

  const handleNewChat = () => {
    const newId = db.createNewConversation(currentStudent.id);
    setActiveConvId(newId);
    setMessages([]);
    
    // Add welcome message
    const welcome: Message = { 
      id: `welcome_${Date.now()}`, 
      role: 'model', 
      content: "Hello! I'm your AI Tutor. I'm here to help you learn. How can I help you today?",
      timestamp: Date.now() 
    };
    db.saveChatMessage(currentStudent.id, newId, welcome);
    // Refresh list
    setConversations(db.getConversations(currentStudent.id));
    
    // Mobile: close sidebar on selection
    if (window.innerWidth < 768) setShowHistorySidebar(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    const conv = conversations.find(c => c.id === id);
    if (conv) setMessages(conv.messages);
    if (window.innerWidth < 768) setShowHistorySidebar(false);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as SupportedLanguage;
    setLanguage(newLang);
    db.setStudentLanguage(currentStudent.id, newLang);
  };

  // --- File Handling ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64 = (event.target.result as string).split(',')[1];
        const type = file.type.startsWith('image/') ? 'image' : 'pdf';
        
        setAttachment({
          type: type,
          mimeType: file.type,
          data: base64,
          name: file.name
        });
      }
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again if needed
    e.target.value = '';
  };

  const removeAttachment = () => setAttachment(null);

  // --- Voice Recording ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Transcribe
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setIsTyping(true); // Show loader while transcribing
          try {
            const text = await transcribeAudio(base64, 'audio/webm');
            setInput(prev => prev + (prev ? ' ' : '') + text);
          } catch (e) {
            console.error(e);
          } finally {
            setIsTyping(false);
          }
        };
        
        // Stop stream tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Mic error", e);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isTyping || !activeConvId) {
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
      attachment: attachment ? { ...attachment } : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    db.saveChatMessage(currentStudent.id, activeConvId, userMsg);
    
    const textToSend = input;
    setInput('');
    setAttachment(null);
    setIsTyping(true);

    const currentConv = conversations.find(c => c.id === activeConvId);
    if (currentConv && currentConv.title === 'New Chat' && messages.length <= 1) {
       generateChatTitle(userMsg.content || "Image Upload").then(title => {
          db.updateConversationTitle(currentStudent.id, activeConvId, title);
          setConversations(db.getConversations(currentStudent.id));
       });
    }

    try {
      const response = await getSocraticResponse(messages, textToSend, language, userMsg.attachment);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', ...response, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
      db.saveChatMessage(currentStudent.id, activeConvId, aiMsg);
      db.addLog({ studentId: currentStudent.id, studentInput: textToSend, aiOutput: response.tutor_response, reasoning: response.pedagogical_reasoning, timestamp: Date.now() });
      setConversations(db.getConversations(currentStudent.id));
    } catch (error) {
      console.error("Chat error", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleVisualize = async () => {
    if (!input.trim() || isTyping || !activeConvId) {
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `Visualize: ${input}`,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    db.saveChatMessage(currentStudent.id, activeConvId, userMsg);
    
    const textToVisualize = input;
    setInput('');
    setIsTyping(true);

    try {
      const response = await visualizeText(textToVisualize);
      if (response) {
        const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', ...response, timestamp: Date.now() };
        setMessages(prev => [...prev, aiMsg]);
        db.saveChatMessage(currentStudent.id, activeConvId, aiMsg);
      }
    } catch (error) {
      console.error("Visualize error", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleReadAloud = async (text: string, msgId: string) => {
    // ... (implementation remains the same)
  };

  const groupedConversations = useMemo(() => {
    // ... (implementation remains the same)
  }, [conversations]);

  return (
    <div className="flex flex-row h-full gap-0 relative isolate overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl font-sans">
      {/* ... (sidebar) ... */}
      <div className="flex-1 flex flex-col relative bg-gray-50 dark:bg-black">
        {/* ... (header) ... */}
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                 <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 mx-2 ${msg.role === 'user' ? 'bg-indigo-100' : 'bg-purple-100'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4 text-indigo-600" /> : <Bot className="w-4 h-4 text-purple-600" />}
                 </div>
                 <div className="flex flex-col">
                   <div
                     className={`rounded-2xl p-4 text-sm shadow-md transition-all duration-300 ${ 
                       msg.role === 'user'
                         ? 'bg-indigo-600 text-white rounded-tr-none'
                         : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                     }`}
                   >
                     {/* ... (attachment rendering) ... */}
                     {msg.steps && msg.steps.length > 0 ? <StepMessage message={msg} /> : msg.content}
                   </div>
                   {/* ... (read aloud button) ... */}
                 </div>
              </div>
            </motion.div>
          ))}
          {/* ... (typing indicator) ... */}
        </div>
        {/* ... (input area) ... */}
      </div>
      {/* ... (inbox) ... */}
    </div>
  );
};

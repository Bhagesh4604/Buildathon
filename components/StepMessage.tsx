
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
    if (typeof step !== 'string') {
      return null;
    }
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

    const parts = step.split(/(\$.*?\$)/g);
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
    <div className="space-y-3">
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

import React, { useState, useRef } from 'react';
import { motion, Variants } from 'framer-motion';
import { 
  PieChart, List, Activity, 
  Calendar, ChevronRight, Maximize2, Minimize2, Sparkles, Download
} from 'lucide-react';
import { InfographicData, InfographicSection } from '../types';
import html2canvas from 'html2canvas';

interface InfographicViewProps {
  data: InfographicData;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 50, damping: 15 }
  }
};

const SectionCard: React.FC<{ section: InfographicSection; index: number }> = ({ section, index }) => {
  const getIcon = () => {
    switch(section.visual_hint) {
      case 'chart': return <PieChart className="w-5 h-5" />;
      case 'timeline': return <Calendar className="w-5 h-5" />;
      case 'arrow-flow': return <Activity className="w-5 h-5" />;
      default: return <List className="w-5 h-5" />;
    }
  };

  const getBgColor = (i: number) => {
    const colors = ['bg-indigo-50', 'bg-emerald-50', 'bg-amber-50', 'bg-rose-50', 'bg-cyan-50'];
    return colors[i % colors.length];
  };

  const getAccentColor = (i: number) => {
    const colors = ['text-indigo-600', 'text-emerald-600', 'text-amber-600', 'text-rose-600', 'text-cyan-600'];
    return colors[i % colors.length];
  };

  const getBorderColor = (i: number) => {
    const colors = ['border-indigo-100', 'border-emerald-100', 'border-amber-100', 'border-rose-100', 'border-cyan-100'];
    return colors[i % colors.length];
  };

  const items = section.items || [];

  return (
    <motion.div 
      variants={itemVariants}
      className={`rounded-2xl p-6 border ${getBgColor(index)} ${getBorderColor(index)} mb-6 relative overflow-hidden break-inside-avoid shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* Decorative accent line */}
      <div className={`absolute top-0 left-0 w-1 h-full ${getAccentColor(index).replace('text', 'bg')} opacity-50`}></div>

      <div className="flex items-center gap-3 mb-4 pl-2">
        <div className={`p-2 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm ${getAccentColor(index)}`}>
          {getIcon()}
        </div>
        <h3 className={`font-bold text-lg text-gray-900 leading-tight`}>{section.heading}</h3>
      </div>

      <div className="space-y-3 pl-3">
        {section.content_type === 'comparison' ? (
          <div className="grid grid-cols-2 gap-3">
             {items.map((item, idx) => (
                <div key={idx} className="bg-white/70 p-3 rounded-lg text-sm font-medium text-gray-700 border border-white/50 shadow-sm">
                  {item}
                </div>
             ))}
          </div>
        ) : section.content_type === 'steps' ? (
           <div className="space-y-4 relative">
             {/* Vertical line for steps */}
             <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-300/50"></div>
             {items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 relative">
                   <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0 z-10 shadow-sm">
                     {idx + 1}
                   </div>
                   <p className="text-sm text-gray-700 pt-0.5 leading-relaxed">{item}</p>
                </div>
             ))}
           </div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 ${getAccentColor(index)} opacity-70`} />
              <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export const InfographicView: React.FC<InfographicViewProps> = ({ data }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const infographicRef = useRef<HTMLDivElement>(null);
  const highlight_insights = data?.highlight_insights || [];
  const sections = data?.sections || [];

  const handleDownload = () => {
    if (infographicRef.current) {
      html2canvas(infographicRef.current).then(canvas => {
        const link = document.createElement('a');
        link.download = 'infographic.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    }
  };

  return (
    <div 
      ref={infographicRef}
      className={`transition-all duration-300 bg-white shadow-xl border border-gray-100 overflow-hidden flex flex-col ${
        isFullscreen 
          ? 'fixed inset-0 z-50 rounded-none h-full' 
          : 'max-w-5xl mx-auto rounded-xl h-full border-t-0' // border-t-0 to blend with parent toolbar if needed
      }`}
    >
      {/* Slim Toolbar Header */}
      <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between bg-white/90 backdrop-blur-md sticky top-0 z-20 shrink-0">
         <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-1.5 bg-indigo-50 rounded-md">
               <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <h1 className="font-bold text-gray-800 text-lg truncate">
              {data?.title || 'Generated Infographic'}
            </h1>
         </div>
         
         <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              title="Download Infographic"
            >
              <Download className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
         </div>
      </div>

      {/* Content Body - Scrollable */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 overflow-y-auto bg-white custom-scrollbar p-6 md:p-8"
      >
        <div className="max-w-5xl mx-auto">
          {/* Insights Row (Top) */}
          {highlight_insights.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Key Takeaways</p>
              <div className="flex flex-wrap gap-3">
                {highlight_insights.map((insight, i) => (
                  <motion.span 
                    key={i}
                    variants={itemVariants}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm font-medium text-gray-700 shadow-sm"
                  >
                    {insight}
                  </motion.span>
                ))}
              </div>
            </div>
          )}

          {/* Sections Grid */}
          {sections.length === 0 ? (
            <div className="text-center text-gray-400 py-20 flex flex-col items-center">
              <List className="w-12 h-12 mb-4 opacity-20" />
              <p>No content sections generated.</p>
            </div>
          ) : (
            <div className="columns-1 md:columns-2 gap-6 space-y-6 pb-20">
               {sections.map((section, idx) => (
                 <SectionCard key={idx} section={section} index={idx} />
               ))}
            </div>
          )}
          
          <div className="mt-8 pt-6 text-center text-xs text-gray-400 border-t border-gray-100">
             AI Generated Content • NXT TUTOR Visual Engine
          </div>
        </div>
      </motion.div>
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { MindmapView } from './MindmapView';
import { InfographicView } from './InfographicView';
import { generateMindmap, generateInfographic } from '@/services/geminiService';
import { db } from '@/services/mockDatabase';
import { MindmapData, InfographicData, StoredVisual } from '@/types';
import { Network, FileImage, Loader2, Sparkles, Wand2, FolderOpen, Save, Trash2, X, Clock, Upload, FileText, Image as ImageIcon, Link as LinkIcon, PanelLeftClose, PanelLeftOpen, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const VisualStudio: React.FC = () => {
  const [mode, setMode] = useState<'mindmap' | 'infographic'>('mindmap');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  
  const [textInput, setTextInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [mindmapData, setMindmapData] = useState<MindmapData | null>(null);
  const [infographicData, setInfographicData] = useState<InfographicData | null>(null);
  
  // Layout State
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Library State
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedItems, setSavedItems] = useState<StoredVisual[]>([]);
  const student = db.getCurrentStudent();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved items on mount or when sidebar opens
  useEffect(() => {
    if (showLibrary) {
      setSavedItems(db.getVisuals(student.id));
    }
  }, [showLibrary, student.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      
      // Create preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFilePreview(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleGenerate = async () => {
    const hasText = textInput.trim().length > 0;
    const hasFile = !!uploadedFile;
    
    if (!hasText && !hasFile) return;
    
    setIsGenerating(true);
    // Don't clear data immediately to prevent flash, only if successful? 
    // Actually clear it to show loading state cleanly in main area
    setMindmapData(null);
    setInfographicData(null);

    try {
      let prompt = textInput;
      let imageBase64: string | undefined = undefined;

      // Process File if exists
      if (uploadedFile) {
        if (uploadedFile.type.startsWith('image/')) {
           // Convert image to base64
           imageBase64 = await new Promise<string>((resolve) => {
             const reader = new FileReader();
             reader.onloadend = () => {
               const base64String = (reader.result as string).split(',')[1];
               resolve(base64String);
             };
             reader.readAsDataURL(uploadedFile);
           });
           
           if (!prompt) prompt = "Analyze this image and generate the visual representation.";
        } else if (uploadedFile.type === 'text/plain' || uploadedFile.name.endsWith('.md')) {
           // Read text file
           const textContent = await new Promise<string>((resolve) => {
             const reader = new FileReader();
             reader.onload = (ev) => resolve(ev.target?.result as string);
             reader.readAsText(uploadedFile);
           });
           prompt = (prompt ? prompt + "\n\n" : "") + textContent;
        }
      }

      if (mode === 'mindmap') {
        const data = await generateMindmap(prompt, imageBase64);
        setMindmapData(data);
      } else {
        const data = await generateInfographic(prompt, imageBase64);
        setInfographicData(data);
      }
      // Close sidebar on success to show result
      if (window.innerWidth < 1024) setSidebarOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to generate visual. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToLibrary = () => {
    if (!mindmapData && !infographicData) return;
    
    const title = (mode === 'mindmap' ? mindmapData?.title : infographicData?.title) || 'Untitled Visual';
    
    const newVisual: StoredVisual = {
      id: `vis_${Date.now()}`,
      type: mode,
      title: title,
      data: mode === 'mindmap' ? mindmapData! : infographicData!,
      createdAt: Date.now()
    };
    
    db.saveVisual(student.id, newVisual);
    alert('Saved to Library!');
  };

  const handleLoadVisual = (visual: StoredVisual) => {
    setMode(visual.type);
    if (visual.type === 'mindmap') {
      setMindmapData(visual.data as MindmapData);
      setInfographicData(null);
    } else {
      setInfographicData(visual.data as InfographicData);
      setMindmapData(null);
    }
    setShowLibrary(false);
  };
  
  const handleDeleteVisual = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this?")) {
      db.removeVisual(student.id, id);
      setSavedItems(prev => prev.filter(item => item.id !== id));
    }
  };

  return (
    <div className="h-full flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm relative">
      
      {/* Configuration Sidebar */}
      <motion.div 
        initial={false}
        animate={{ width: isSidebarOpen ? 340 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden relative z-10"
      >
         <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between min-w-[340px]">
            <h2 className="font-bold text-gray-800 dark:text-white flex items-center">
               <Settings2 className="w-5 h-5 mr-2 text-indigo-500" />
               Configuration
            </h2>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400">
               <X className="w-5 h-5" />
            </button>
         </div>

         <div className="flex-1 overflow-y-auto p-5 space-y-6 min-w-[340px]">
            {/* Visual Type Selector */}
            <div className="space-y-3">
               <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visual Type</label>
               <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('mindmap')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${mode === 'mindmap' 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Network className="w-6 h-6 mb-2" />
                    <span className="text-sm font-medium">Mindmap</span>
                  </button>
                  <button
                    onClick={() => setMode('infographic')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${mode === 'infographic' 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <FileImage className="w-6 h-6 mb-2" />
                    <span className="text-sm font-medium">Infographic</span>
                  </button>
               </div>
            </div>

            {/* Input Source Selector */}
            <div className="space-y-3">
               <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Input Source</label>
               <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                  <button 
                    onClick={() => setInputMode('text')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${inputMode === 'text' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Text / Topic
                  </button>
                  <button 
                    onClick={() => setInputMode('file')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${inputMode === 'file' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Upload File
                  </button>
               </div>

               {inputMode === 'text' ? (
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={mode === 'mindmap' ? "Enter a topic (e.g. 'Photosynthesis') or paste content..." : "Paste summary points or text..."}
                    className="w-full h-40 p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none text-sm"
                  />
               ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors relative"
                  >
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".txt,.md,image/png,image/jpeg,image/jpg"
                     />
                     {uploadedFile ? (
                        <div className="flex flex-col items-center text-center p-4 w-full">
                           {filePreview ? (
                             <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg shadow-sm mb-2" />
                           ) : (
                             <FileText className="w-12 h-12 text-indigo-500 mb-2" />
                           )}
                           <p className="text-sm font-medium text-gray-900 dark:text-white truncate w-full px-4">{uploadedFile.name}</p>
                           <p className="text-xs text-gray-500 mb-2">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                           <button 
                             onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setFilePreview(null); }}
                             className="text-xs text-red-500 hover:text-red-600 font-bold"
                           >
                             Remove File
                           </button>
                        </div>
                     ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Click to upload</p>
                          <p className="text-xs text-gray-400 mt-1">Images, .txt, .md</p>
                        </>
                     )}
                  </div>
               )}
            </div>

            <button
               onClick={handleGenerate}
               disabled={isGenerating || (!textInput.trim() && !uploadedFile)}
               className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl flex items-center justify-center transition-all shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
               Generate Visual
            </button>
         </div>
      </motion.div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900/50 relative overflow-hidden">
         {/* Top Toolbar */}
         <div className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 px-4 flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center">
               <button 
                 onClick={() => setSidebarOpen(!isSidebarOpen)}
                 className="p-2 mr-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                 title="Toggle Configuration Panel"
               >
                 {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
               </button>
               <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                    <Wand2 className="w-5 h-5 mr-2 text-indigo-500" />
                    Visual Studio
                  </h1>
               </div>
            </div>
            
            <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLibrary(true)}
                  className="flex items-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Library
                </button>
                
                {(mindmapData || infographicData) && (
                  <button
                    onClick={handleSaveToLibrary}
                    className="flex items-center px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors text-sm font-medium border border-green-200 dark:border-green-800"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </button>
                )}
            </div>
         </div>

         {/* Content Area */}
         <div className="flex-1 relative overflow-hidden">
            {isGenerating && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-30">
                  <div className="relative">
                     <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                     <Sparkles className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium animate-pulse">Crafting your visual experience...</p>
                  <p className="text-xs text-gray-400 mt-1">Analyzing context • structuring nodes • styling layout</p>
               </div>
            )}

            {mode === 'mindmap' && mindmapData && (
              <div className="w-full h-full">
                 <MindmapView data={mindmapData} />
              </div>
            )}

            {mode === 'infographic' && infographicData && (
              <div className="w-full h-full p-6 md:p-8 overflow-y-auto custom-scrollbar">
                <InfographicView data={infographicData} />
              </div>
            )}

            {!isGenerating && !mindmapData && !infographicData && (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 pointer-events-none">
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-full shadow-sm mb-6">
                     {mode === 'mindmap' ? <Network className="w-16 h-16 text-indigo-100 dark:text-indigo-900" /> : <FileImage className="w-16 h-16 text-indigo-100 dark:text-indigo-900" />}
                  </div>
                  <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">Ready to Create</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-500 max-w-xs text-center">
                     Use the configuration panel on the left to input your content and generate a {mode}.
                  </p>
               </div>
            )}
         </div>
      </div>

      {/* Library Drawer (Overlay) */}
      <AnimatePresence>
        {showLibrary && (
           <div className="absolute inset-0 z-50 flex justify-end">
              <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                 onClick={() => setShowLibrary(false)}
              />
              <motion.div 
                 initial={{ x: '100%' }}
                 animate={{ x: 0 }}
                 exit={{ x: '100%' }}
                 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                 className="relative w-80 md:w-96 bg-white dark:bg-gray-900 h-full shadow-2xl border-l border-gray-200 dark:border-gray-800 flex flex-col"
              >
                 <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                       <FolderOpen className="w-5 h-5 mr-2 text-indigo-500" />
                       My Library
                    </h3>
                    <button onClick={() => setShowLibrary(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500">
                       <X className="w-5 h-5" />
                    </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {savedItems.length === 0 ? (
                       <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                          <FolderOpen className="w-12 h-12 mb-3 opacity-20" />
                          <p className="text-sm">No saved visuals yet.</p>
                       </div>
                    ) : (
                       savedItems.map(item => (
                          <div 
                             key={item.id} 
                             onClick={() => handleLoadVisual(item)}
                             className="group p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 cursor-pointer shadow-sm hover:shadow-md transition-all relative"
                          >
                             <div className="flex items-start justify-between">
                                <div className={`p-2 rounded-lg ${item.type === 'mindmap' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600'}`}>
                                   {item.type === 'mindmap' ? <Network className="w-4 h-4" /> : <FileImage className="w-4 h-4" />}
                                </div>
                                <button 
                                   onClick={(e) => handleDeleteVisual(e, item.id)}
                                   className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                >
                                   <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                             <h4 className="font-bold text-gray-800 dark:text-gray-200 mt-2 truncate pr-4">{item.title}</h4>
                             <div className="flex items-center mt-2 text-xs text-gray-400">
                                <Clock className="w-3 h-3 mr-1" />
                                {new Date(item.createdAt).toLocaleDateString()}
                             </div>
                          </div>
                       ))
                    )}
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
};

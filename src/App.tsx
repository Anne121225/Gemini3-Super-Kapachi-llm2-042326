import React, { useState, useRef, useEffect } from 'react';
import { Settings, StopCircle, Play, Activity, Terminal, UploadCloud, Cpu, Sparkles, X, FileText, Download, Scissors } from 'lucide-react';
import { streamGemini } from './lib/gemini';
import { Part } from '@google/genai';
import { PDFDocument } from 'pdf-lib';

type FileItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  text?: string;
  inlineData?: { mimeType: string, data: string };
  status: string;
  fileObj?: File;
};

export default function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  
  // LLM Config State
  const [showConfig, setShowConfig] = useState(false);
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [systemPrompt, setSystemPrompt] = useState(`You are an expert analytical agent. Please use the following skill to create a markdown in traditional chinese in 3000 to 4000 words. Please adding additional 5 tables and 3 infograph (by code to be included in interactive webpage) skill:增強型技能：AI 驅動的 Obsidian 知識轉化工具 (EPUB/PDF/DOCX/FB JSON)
此技能不僅是格式轉換器，更是一個智慧型內容架構師。它在原始的 Pandoc 與 PyMuPDF 轉換流程基礎上，整合了三項創新的 AI 增強功能，將靜態文件轉化為具備深度關聯與多模態資訊的 Obsidian 筆記。

核心增強功能
1. AI 語意修復與結構重組 (AI Semantic Reconstruction)
原始轉檔常遇到 PDF 斷行錯誤、OCR 遺漏或標題層級混亂的問題。此功能利用 AI 在轉檔過程中進行即時語意掃描：

斷句修復： 自動識別並合併因 PDF 換頁而被迫中斷的句子與段落。
智慧標題生成： 當原始文件缺乏明確 H1-H3 標籤時，AI 會根據內容脈絡自動生成語意正確的 Markdown 標題，確保 Obsidian 的大綱視圖 (Outline) 清晰可用。
無效資訊過濾： 自動識別並移除轉檔殘留的頁碼、頁首頁尾、冗長的索引表或重複的書目資訊，僅保留核心知識內容。
2. 多模態圖像視覺描述 (AI Vision-to-Alt Text)
轉檔過程中提取的圖片 (Assets) 不再只是冷冰冰的檔名，此功能利用視覺 AI 模型處理 assets/ 資料夾中的圖片：

自動 Alt-Text： 為每張圖片生成簡短的文字描述並插入 Markdown 代碼中（例如 ![[image.png|AI 產生的圖表描述]]），讓筆記內容可透過文字搜尋圖片。
圖表解析： 若圖片為圖表或數據圖，AI 會提取關鍵數據趨勢並在圖片下方附註簡短摘要。
OCR 補強： 針對無法選取文字的圖片（如掃描件或內嵌文字），自動執行高精度 OCR 並將文字以註釋形式存於圖片下方。
3. 自動化知識圖譜關聯與標籤 (AI Graph Interlinking)
為了讓轉出的文件完美融入 Obsidian 的雙向鏈結體系，此功能在 Frontmatter 階段進行 AI 分析：

概念提取 (WikiLinks)： AI 會掃描內文，自動將關鍵術語、人物、或核心主題包裝成 [[概念名稱]]，方便使用者直接點擊建立新筆記或與現有筆記串連。
智慧標籤體系： 根據文章內容自動生成推薦標籤 (Tags)，例如 #領域/人工智慧、#類型/技術報告，而非僅依賴原有的 metadata。
內容摘要與亮點： 在 Markdown 開頭自動生成一個由 AI 撰寫的「內容精華」與「核心觀點」區塊，讓使用者在進入長篇大論前能快速掌握重點。
優化後的處理流程 (Enhanced Workflow)
環境與類型判斷： 承襲原流程，確認工具鏈並識別輸入路徑。
AI 輔助提取與轉換：
執行 Pandoc/PyMuPDF 基礎轉檔。
[AI 增強] 執行語意修復與結構優化，修正排版問題。
多模態處理：
提取圖片並儲存至相對路徑。
[AI 增強] 對提取的圖片進行視覺分析，寫入 Markdown 描述。
元數據與語法優化：
寫入標準 Frontmatter。
[AI 增強] 根據 AI 分析結果寫入主題標籤、雙向鏈結與內容摘要。
執行程式碼區塊語法高亮偵測。
終端清理與品質報告：
完成中英文間距優化 (Pangu) 與標點修正。
提供包含「AI 優化點總結」的最終轉檔報告。
適用場景
當你擁有一堆電子書、學術 PDF 或雜亂的 Facebook 歷史貼文，且希望它們在匯入 Obsidian 後立即具備高度可讀性、可搜尋性與結構化關聯時，請使用此技能。. Default to Traditional Chinese unless asked otherwise.`);

  // Session & Execution State
  const [files, setFiles] = useState<FileItem[]>([]);
  const [summary, setSummary] = useState<string>('# 綜合技術規格與轉換報告\n\nWaiting for transformation request...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>(['System initialized.', 'Awaiting data ingestion...']);
  const [chatPrompt, setChatPrompt] = useState('');
  
  // Input State
  const [inputType, setInputType] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  
  // Trimming State
  const [trimmingFileId, setTrimmingFileId] = useState<string | null>(null);
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd, setTrimEnd] = useState('');

  // Visuals & Effects state
  const [visualEffect, setVisualEffect] = useState('nordic');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs]);

  const appendLog = (msg: string) => {
    setLiveLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      appendLog('WARNING: Execution manually aborted by user.');
      setIsGenerating(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Str = (reader.result as string).split(',')[1];
        resolve(base64Str);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    
    appendLog(`Detected ${fileList.length} incoming file(s). Reading data...`);
    const newFiles: FileItem[] = await Promise.all(
      Array.from(fileList).map(async (file) => {
        const id = Math.random().toString(36).substring(7);
        if (file.type === 'application/pdf') {
          const base64 = await fileToBase64(file);
          appendLog(`Ingested PDF: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
          return {
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            inlineData: { mimeType: 'application/pdf', data: base64 },
            status: 'Loaded PDF',
            fileObj: file
          };
        } else {
          const text = await file.text();
          appendLog(`Ingested Text: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
          return {
            id,
            name: file.name,
            type: file.type || 'text/plain',
            size: file.size,
            text,
            status: 'Extracted',
            fileObj: file
          };
        }
      })
    );
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleAddPaste = () => {
    if (!pastedText.trim()) return;
    const size = new Blob([pastedText]).size;
    const id = Math.random().toString(36).substring(7);
    setFiles(prev => [
      ...prev,
      {
        id,
        name: `Pasted_Text_${id}.txt`,
        type: 'text/plain',
        size,
        text: pastedText,
        status: 'Pasted'
      }
    ]);
    setPastedText('');
    appendLog(`Ingested Pasted Text (${(size / 1024).toFixed(1)} KB)`);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const executePDFTrim = async () => {
    if (!trimmingFileId) return;
    const fileItem = files.find(f => f.id === trimmingFileId);
    if (!fileItem || !fileItem.fileObj) return;

    try {
      const start = parseInt(trimStart, 10);
      const end = parseInt(trimEnd, 10);
      if (isNaN(start) || isNaN(end) || start > end || start < 1) {
        appendLog('ERROR: Invalid trim range.');
        return;
      }

      appendLog(`Trimming PDF ${fileItem.name} pages ${start}-${end}...`);
      const arrayBuffer = await fileItem.fileObj.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();

      if (end > pageCount) {
        appendLog(`ERROR: Trim end (${end}) exceeds PDF pages (${pageCount}).`);
        return;
      }

      const trimmedDoc = await PDFDocument.create();
      const pagesToCopy = Array.from({length: end - start + 1}, (_, i) => start - 1 + i);
      const copiedPages = await trimmedDoc.copyPages(pdfDoc, pagesToCopy);
      copiedPages.forEach(page => trimmedDoc.addPage(page));

      const trimmedBytes = await trimmedDoc.save();
      const trimmedBlob = new Blob([trimmedBytes], { type: 'application/pdf' });
      const trimmedFile = new File([trimmedBlob], `Trimmed_${start}-${end}_${fileItem.name}`, { type: 'application/pdf' });
      const base64 = await fileToBase64(trimmedFile);

      appendLog(`SUCCESS: Trimmed PDF now ${(trimmedFile.size / 1024).toFixed(1)} KB.`);

      setFiles(prev => prev.map(f => {
        if (f.id === trimmingFileId) {
          return {
            ...f,
            name: trimmedFile.name,
            size: trimmedFile.size,
            inlineData: { mimeType: 'application/pdf', data: base64 },
            status: 'Trimmed PDF',
            fileObj: trimmedFile
          };
        }
        return f;
      }));

      // Trigger standard download
      const url = URL.createObjectURL(trimmedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = trimmedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (e: any) {
      appendLog(`TRIM ERROR: ${e.message}`);
    } finally {
      setTrimmingFileId(null);
      setTrimStart('');
      setTrimEnd('');
    }
  };

  const getGeminiParts = (basePrompt: string): Part[] => {
    const parts: Part[] = [{ text: basePrompt + '\n\n' }];
    files.forEach(f => {
      parts.push({ text: `\n=== SOURCE: ${f.name} ===\n` });
      if (f.inlineData) {
        parts.push({ inlineData: f.inlineData });
      } else if (f.text) {
        parts.push({ text: f.text });
      }
    });
    return parts;
  };

  const executeTransformation = async () => {
    if (files.length === 0) {
      appendLog('ERROR: Discarded request. No files available in the context queue.');
      return;
    }

    setIsGenerating(true);
    setSummary('');
    appendLog('Initiating Macro-Synthesis Transformation Pipeline...');
    appendLog(`Selected Model: ${model}`);
    
    const basePrompt = `Please summarize and synthesize the following documents into a comprehensive Markdown report. Maintain highly structural formatting.`;
    const parts = getGeminiParts(basePrompt);
    
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      await streamGemini(parts, model, systemPrompt, abortCtrl.signal, (chunk) => {
        setSummary(prev => prev + chunk);
      });
      if (!abortCtrl.signal.aborted) {
        appendLog('SUCCESS: Transformation complete. Output stabilized.');
      }
    } catch (e: any) {
      appendLog(`CRITICAL FAILURE: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const executeMagic = async (magicName: string) => {
    if (!summary || summary.includes('Waiting for transformation') || isGenerating) return;
    
    appendLog(`Activating WOW Feature: [${magicName}]`);
    setIsGenerating(true);
    
    const contextPrompt = `\n\nCurrent Summary Context:\n${summary}\n\nPlease apply the ${magicName} protocol to this context.`;
    // We can just pass the contextPrompt as text since it only relies on the summary
    
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    
    setSummary(prev => prev + `\n\n---\n**Executing ${magicName}...**\n\n`);

    try {
      await streamGemini([{ text: contextPrompt }], model, systemPrompt, abortCtrl.signal, (chunk) => {
        setSummary(prev => prev + chunk);
      });
      if (!abortCtrl.signal.aborted) {
        appendLog(`SUCCESS: [${magicName}] protocol applied successfully.`);
      }
    } catch (e: any) {
      appendLog(`CRITICAL FAILURE during ${magicName}: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePromptAgent = async () => {
    if (!chatPrompt.trim() || isGenerating) return;
    
    appendLog(`User Prompt: ${chatPrompt}`);
    setIsGenerating(true);
    
    const promptContext = `\n\nCurrent Context:\n${summary}\n\nUser Question/Instruction:\n${chatPrompt}`;
    const userQ = chatPrompt;
    setChatPrompt('');
    
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    
    setSummary(prev => prev + `\n\n---\n**Q: ${userQ}**\n\n`);

    try {
      await streamGemini([{ text: promptContext }], model, systemPrompt, abortCtrl.signal, (chunk) => {
        setSummary(prev => prev + chunk);
      });
      appendLog('Agent responded successfully.');
    } catch (e: any) {
      appendLog(`CRITICAL FAILURE: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Aesthetic Maps
  const effectClasses: Record<string, string> = {
    nordic: 'bg-white text-[#1D1D1F]',
    matrix: 'bg-black text-green-500 font-mono shadow-[0_0_15px_rgba(34,197,94,0.3)_inset] border-green-900',
    pulse: 'bg-blue-900/5 text-blue-900 ring-2 ring-blue-500/50 animate-[pulse_4s_ease-in-out_infinite]',
    cyber: 'bg-[#0f0f13] text-[#ef4444] border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.2)_inset]',
    glass: 'bg-white/40 backdrop-blur-md border-white/60 shadow-xl text-slate-800',
    ethereal: 'bg-gradient-to-br from-indigo-50/50 to-purple-50/50 text-indigo-950 shadow-[0_0_20px_rgba(167,139,250,0.15)]'
  };

  return (
    <div className={`w-full h-screen font-sans flex flex-col overflow-hidden transition-colors duration-500 ${visualEffect !== 'nordic' ? 'bg-slate-100' : 'bg-[#F8F9FA]'}`}>
      
      {/* Top Header Navigation */}
      <header className="h-16 border-b border-[#E5E5E5] bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
            <div className={`w-4 h-4 border-2 border-white rotate-45 ${isGenerating ? 'animate-spin' : ''}`}></div>
          </div>
          <h1 className="text-lg font-bold tracking-tight">KNOWLEDGE AGENT v3.0</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${showConfig ? 'bg-black text-white border-black' : 'bg-white text-[#48484A] border-[#E5E5E5] hover:bg-gray-50'} transition-all`}
          >
            <Settings size={14} /> Configure LLM
          </button>
          
          <div className="w-px h-6 bg-[#E5E5E5]"></div>
          
          <div className="flex bg-[#F2F2F7] p-1 rounded-lg">
            <button onClick={() => setLang('zh')} className={`px-4 py-1 text-xs font-semibold rounded ${lang === 'zh' ? 'bg-white shadow-sm' : 'text-[#8E8E93] hover:text-[#48484A]'}`}>
              繁體中文
            </button>
            <button onClick={() => setLang('en')} className={`px-4 py-1 text-xs font-semibold rounded ${lang === 'en' ? 'bg-white shadow-sm' : 'text-[#8E8E93] hover:text-[#48484A]'}`}>
              English
            </button>
          </div>
        </div>
      </header>

      {/* Configuration Drawer */}
      {showConfig && (
        <div className="absolute top-16 right-0 z-30 w-[400px] bg-white border-l border-b border-[#E5E5E5] shadow-2xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-sm tracking-widest uppercase">Agent Parameters</h3>
            <button onClick={() => setShowConfig(false)} className="text-[#8E8E93] hover:text-black"><X size={16} /></button>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E93]">Inference Model</label>
            <select 
              value={model} 
              onChange={e => setModel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D1D1D6] rounded bg-[#F9F9F9] focus:outline-none focus:border-black transition-colors"
            >
              <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (Default)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E93]">System Prompt</label>
            <textarea 
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-xs border border-[#D1D1D6] rounded bg-[#F9F9F9] focus:outline-none focus:border-black transition-colors font-mono resize-none leading-relaxed"
            />
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden flex-col lg:flex-row relative z-10">
        
        {/* Left Sidebar: Controls & Config */}
        <aside className="w-full lg:w-[320px] border-r border-[#E5E5E5] bg-white flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          
          <div className="p-6 flex flex-col gap-8 flex-1">
            {/* Input Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#8E8E93]">
                  <UploadCloud size={14} /> Input Data Source
                </label>
              </div>

              <div className="flex bg-[#F2F2F7] p-1 rounded-lg">
                <button 
                  onClick={() => setInputType('upload')} 
                  className={`flex-1 py-1 text-[10px] font-bold uppercase uppercase tracking-wider rounded ${inputType === 'upload' ? 'bg-white shadow-sm' : 'text-[#8E8E93] hover:text-[#48484A]'}`}
                >
                  File Upload
                </button>
                <button 
                  onClick={() => setInputType('paste')} 
                  className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${inputType === 'paste' ? 'bg-white shadow-sm' : 'text-[#8E8E93] hover:text-[#48484A]'}`}
                >
                  Paste Text
                </button>
              </div>

              {inputType === 'upload' ? (
                <div className="space-y-2 relative">
                  <input type="file" multiple onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="w-full h-28 border-2 border-dashed border-[#D1D1D6] rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-slate-50 hover:border-[#8E8E93] transition-colors relative">
                    <span className="text-xs font-semibold text-[#1D1D1F]">Click to Browse or Drag Files</span>
                    <span className="text-[10px] bg-[#E5E5E5] px-2 py-1 rounded font-medium text-[#48484A]">TXT, MD, PDF support</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea 
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder="Paste your raw text or code here..."
                    className="w-full h-28 p-2 text-xs border border-[#D1D1D6] rounded bg-white focus:outline-none focus:border-black resize-none custom-scrollbar"
                  />
                  <button 
                    onClick={handleAddPaste}
                    disabled={!pastedText.trim()}
                    className="w-full py-2 bg-[#F2F2F7] hover:bg-[#E5E5E5] text-[#1D1D1F] text-xs font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-50"
                  >
                    Add to Queue
                  </button>
                </div>
              )}
            </section>

            {/* AI Magics */}
            <section className="space-y-4">
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#8E8E93]">
                <Sparkles size={14} /> WOW AI Features
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: '01', name: 'Semantic Map' },
                  { id: '02', name: 'Logic Checker' },
                  { id: '03', name: 'Entity Linker' },
                  { id: '04', name: 'Style Shift' },
                  { id: '05', name: 'Auto-Cite' },
                  { id: '06', name: 'Insight Flux' }
                ].map((magic) => (
                  <button 
                    key={magic.id} 
                    onClick={() => executeMagic(magic.name)}
                    disabled={isGenerating}
                    className="p-3 text-left border border-[#E5E5E5] rounded hover:border-black transition-all group disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                  >
                    <div className="text-[10px] font-bold mb-1 opacity-40 group-hover:opacity-100 transition-opacity">{magic.id}</div>
                    <div className="text-xs font-semibold truncate">{magic.name}</div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="p-6 border-t border-[#E5E5E5] bg-[#FCFCFD]">
            {isGenerating ? (
               <button 
                onClick={stopGeneration}
                className="w-full py-4 bg-red-500 text-white font-bold text-sm tracking-widest rounded uppercase hover:bg-red-600 transition-colors flex items-center justify-center gap-2 animate-pulse"
              >
                <StopCircle size={18} /> STOP EXECUTION
              </button>
            ) : (
              <button 
                onClick={executeTransformation}
                className="w-full py-4 bg-black text-white font-bold text-sm tracking-widest rounded uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Play size={16} /> Execute Transformation
              </button>
            )}
          </div>
        </aside>

        {/* Main Content Area: Queue, Dashboard & Preview */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden gap-6 relative">
          
          {/* Top Panel: Queue & Interactive Dashboard */}
          <div className="shrink-0 flex gap-6 h-56">
            
            {/* Live Queue */}
            <div className="flex-1 flex flex-col">
               <div className="flex justify-between items-end mb-3">
                <h2 className="text-xl font-light font-serif">Processing Queue</h2>
                <span className="text-xs font-bold text-[#8E8E93]">{files.length} Files Stagged</span>
              </div>
              <div className="flex-1 bg-white border border-[#E5E5E5] rounded-lg p-2 overflow-y-auto custom-scrollbar grid grid-cols-2 lg:grid-cols-3 gap-2 content-start group">
                {files.length === 0 ? (
                   <div className="col-span-full h-full flex items-center justify-center text-xs text-[#8E8E93]">No files loaded.</div>
                ) : files.map((file) => (
                  <div key={file.id} className="border border-[#E5E5E5] rounded p-2 flex flex-col justify-between h-20 bg-slate-50 relative group/item">
                    <button onClick={() => removeFile(file.id)} className="absolute top-1 right-1 opacity-0 group-hover/item:opacity-100 p-0.5 text-gray-400 hover:text-red-500 rounded transition-opacity bg-white/80 border border-gray-200">
                      <X size={12} />
                    </button>
                    <div className="truncate text-xs font-semibold text-[#1D1D1F] pr-4 flex items-center gap-1">
                      {file.type === 'application/pdf' ? <FileText size={12} className="text-red-500"/> : <FileText size={12} className="text-blue-500" />}
                      <span className="truncate">{file.name}</span>
                    </div>
                    
                    {file.type === 'application/pdf' && trimmingFileId !== file.id && (
                      <button 
                        onClick={() => setTrimmingFileId(file.id)}
                        className="text-[9px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 self-start flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                      >
                        <Scissors size={10} /> Trim PDF
                      </button>
                    )}

                    {trimmingFileId === file.id && (
                      <div className="flex items-center gap-1 bg-white p-1 rounded border border-indigo-200 shadow-sm absolute inset-0 z-10 m-1 text-[10px]">
                        <input 
                          type="number" 
                          min={1}
                          value={trimStart} 
                          onChange={(e)=>setTrimStart(e.target.value)} 
                          placeholder="Pg" 
                          className="w-8 border-b focus:outline-none" 
                        />
                        <span className="text-gray-400">-</span>
                        <input 
                          type="number" 
                          min={1}
                          value={trimEnd} 
                          onChange={(e)=>setTrimEnd(e.target.value)} 
                          placeholder="Pg" 
                          className="w-8 border-b focus:outline-none" 
                        />
                        <button onClick={executePDFTrim} className="px-1 text-white bg-indigo-500 rounded ml-1 font-bold">Cut</button>
                        <button onClick={() => setTrimmingFileId(null)} className="px-1 text-gray-500 hover:text-black"><X size={10}/></button>
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[9px] uppercase tracking-wider text-green-600 font-bold truncate max-w-[80px]">{file.status}</span>
                      <span className="text-[10px] text-[#8E8E93] shrink-0">{(file.size / 1024).toFixed(1)}kb</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WOW Interactive Dashboard & Live Logs */}
            <div className="w-[380px] bg-[#1e1e1e] rounded-lg flex flex-col shadow-inner overflow-hidden border border-black relative shrink-0">
              <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40">
                <div className="flex items-center gap-2 text-white/80">
                  {isGenerating ? <Activity size={14} className="text-green-400 animate-pulse" /> : <Terminal size={14} />}
                  <span className="text-xs font-mono tracking-widest font-bold">LIVE TELEMETRY</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/50 font-mono">
                  <span>RAM: {isGenerating ? '1.4GB' : '0.8GB'}</span>
                  <span>CPU: {isGenerating ? '84%' : '12%'}</span>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] leading-relaxed text-[#d4d4d4] scroll-smooth container-snap custom-scrollbar">
                {liveLogs.map((log, i) => (
                  <div key={i} className={`${log.includes('ERROR') || log.includes('FAILURE') || log.includes('WARNING') ? 'text-red-400 font-bold' : log.includes('SUCCESS') ? 'text-green-400' : ''}`}>
                    {log}
                  </div>
                ))}
                {isGenerating && (
                  <div className="flex items-center gap-2 mt-2 text-yellow-500">
                    <Cpu size={12} className="animate-spin" /> Fetching logic layers...
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>

          {/* Bottom Panel: Output Preview & Visualizations */}
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Visual Effect Selector (Appears only after generations or implicitly available) */}
            <div className="flex justify-between items-end mb-3">
              <h2 className="text-xl font-light font-serif">Synthesized Intelligence</h2>
              <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-full border border-[#E5E5E5] shadow-sm">
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#8E8E93] mr-2">WOW Effects</span>
                {['nordic', 'matrix', 'pulse', 'glass', 'cyber', 'ethereal'].map((fx) => (
                  <button 
                    key={fx} 
                    onClick={() => setVisualEffect(fx)}
                    className={`w-4 h-4 rounded-full border border-black/10 transition-transform ${visualEffect === fx ? 'scale-125 ring-2 ring-black/30' : 'hover:scale-110 opacity-60'} 
                      ${fx === 'nordic' ? 'bg-white' : fx === 'matrix' ? 'bg-green-500' : fx === 'pulse' ? 'bg-blue-500' : fx === 'glass' ? 'bg-gray-200' : fx === 'cyber' ? 'bg-red-500' : 'bg-purple-300'}`}
                    title={fx.toUpperCase()}
                  />
                ))}
              </div>
            </div>

            {/* Summary Output Area */}
            <div className={`flex-1 rounded-xl flex flex-col overflow-hidden transition-all duration-700 ease-in-out border border-[#E5E5E5] ${effectClasses[visualEffect]}`}>
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed max-w-4xl mx-auto">
                  {summary}
                </pre>
              </div>
              
              <div className="p-4 bg-black/5 backdrop-blur-sm border-t border-black/10 flex gap-2 shrink-0">
                <input 
                  type="text" 
                  value={chatPrompt}
                  onChange={e => setChatPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePromptAgent()}
                  disabled={isGenerating}
                  placeholder="Keep prompting on summary..." 
                  className="flex-1 px-4 py-2 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-black bg-white/80 border border-black/10 shadow-inner disabled:bg-gray-100 disabled:opacity-50"
                />
                <button 
                  onClick={handlePromptAgent}
                  disabled={isGenerating || !chatPrompt.trim()}
                  className="px-6 py-2 bg-black text-white text-xs font-bold rounded-full disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                >
                  Prompt Agent
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); }
      `}} />
    </div>
  );
}



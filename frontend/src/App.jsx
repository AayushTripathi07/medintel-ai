import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Send, User, Bot, Loader2, Info, BookOpen, FlaskConical, MessageSquare, History, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Handle dynamic routing for live deployment (Vercel) vs local testing
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5005/api';

const App = () => {
  const [isCaseActive, setIsCaseActive] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ database: 'Checking...', ollama: 'Checking...', huggingface: 'Checking...' });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [userContext, setUserContext] = useState({
    patientName: '',
    disease: '',
    intent: '',
    location: ''
  });

  const chatEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Poll system health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await axios.get(`${API_BASE}/health`);
        setSystemStatus(res.data);
      } catch (err) {
        console.error('Health check failed');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history`);
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch history');
    }
  };

  const startNewCase = () => {
    setIsCaseActive(false);
    setMessages([]);
    setConversationId(null);
    setUserContext({ patientName: '', disease: '', intent: '', location: '' });
  };

  const submitIntake = (e) => {
    e.preventDefault();
    if (!userContext.disease || !userContext.intent) return;
    setIsCaseActive(true);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = { role: 'user', content: input, timestamp: new Date() };
    setMessages([...messages, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        message: input,
        conversationId,
        userContext
      });

      const assistantMsg = {
        role: 'assistant',
        content: res.data.response,
        sources: res.data.sources,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);
      setConversationId(res.data.conversationId);
      fetchHistory();
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Could not connect to the medical knowledge base. Is the server running?',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversation = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/conversation/${id}`);
      const conv = res.data;
      setMessages(conv.messages);
      setConversationId(conv._id);
      setUserContext(conv.userContext || { patientName: '', disease: '', intent: '', location: '' });
      setIsCaseActive(true);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to load conversation');
    }
  };

  if (!isCaseActive) {
    return (
      <div className="flex h-screen bg-transparent items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-panel p-8 shadow-2xl border border-blue-500/20"
        >
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-500/10 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <FlaskConical size={48} className="text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center text-white mb-2 tracking-tight">MedIntel AI</h1>
          <p className="text-center text-slate-400 text-sm mb-8">Initialize a new patient research case. Our AI will dynamically synthesize clinical trials and PubMed publications.</p>
          
          <form onSubmit={submitIntake} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Patient ID / Name</label>
              <input required type="text" value={userContext.patientName} onChange={(e) => setUserContext({...userContext, patientName: e.target.value})} className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors" placeholder="e.g. John Doe" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Disease / Condition</label>
              <input required type="text" value={userContext.disease} onChange={(e) => setUserContext({...userContext, disease: e.target.value})} className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors" placeholder="e.g. Parkinson's disease" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Primary Research Intent</label>
              <input required type="text" value={userContext.intent} onChange={(e) => setUserContext({...userContext, intent: e.target.value})} className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors" placeholder="e.g. Deep Brain Stimulation" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Geography (Optional)</label>
              <input type="text" value={userContext.location} onChange={(e) => setUserContext({...userContext, location: e.target.value})} className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-slate-300 outline-none focus:border-blue-500 transition-colors" placeholder="e.g. Toronto, Canada" />
            </div>
            
            <button type="submit" className="w-full mt-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
              <Search size={18} /> Begin Case Analysis
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3 tracking-wider text-center">Or Resume Previous Case</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {history.map(conv => (
                <button key={conv._id} onClick={() => loadConversation(conv._id)} className="w-full text-left p-3 glass-panel hover:bg-white/10 text-sm text-slate-300 transition-all border-white/5 flex items-center justify-between">
                  <span className="truncate flex-1">{conv.userContext?.patientName || 'Anonymous'} - {conv.userContext?.disease || 'General'}</span>
                  <span className="text-[10px] text-slate-500 ml-2">{new Date(conv.updatedAt).toLocaleDateString()}</span>
                </button>
              ))}
              {history.length === 0 && <div className="text-center text-xs text-slate-600 italic">No previous cases found</div>}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-transparent overflow-hidden">
      {/* Sidebar: History & Context */}
      <aside className={`w-80 glass-panel border-r border-white/5 flex flex-col transition-all duration-300 ${showHistory ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} z-20 absolute lg:relative h-full`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="text-blue-500" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              MedIntel AI
            </h1>
          </div>
          <button onClick={startNewCase} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Start New Case">
            <Plus size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Patient Context Widget */}
          <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-400 mb-3">
              <User size={16} /> Active Case Profile
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Patient Name</label>
                <input type="text" value={userContext.patientName} onChange={(e) => setUserContext({...userContext, patientName: e.target.value})} className="bg-black/20 border border-white/5 rounded px-2 py-1.5 text-slate-200 outline-none focus:border-blue-500/50 transition-colors" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Known Condition</label>
                <input type="text" value={userContext.disease} onChange={(e) => setUserContext({...userContext, disease: e.target.value})} className="bg-black/20 border border-white/5 rounded px-2 py-1.5 text-blue-300 outline-none focus:border-blue-500/50 transition-colors" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Research Intent</label>
                <input type="text" value={userContext.intent} onChange={(e) => setUserContext({...userContext, intent: e.target.value})} className="bg-black/20 border border-white/5 rounded px-2 py-1.5 text-slate-200 outline-none focus:border-blue-500/50 transition-colors" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Geography</label>
                <input type="text" value={userContext.location} onChange={(e) => setUserContext({...userContext, location: e.target.value})} className="bg-black/20 border border-white/5 rounded px-2 py-1.5 text-slate-200 outline-none focus:border-blue-500/50 transition-colors" />
              </div>
            </div>
          </div>

          {/* History List */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-400 mb-3 px-2">
              <History size={16} /> Case History
            </h3>
            <div className="space-y-2">
              {history.map((conv) => (
                <button
                  key={conv._id}
                  onClick={() => loadConversation(conv._id)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${conversationId === conv._id ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' : 'hover:bg-white/5 text-slate-400'}`}
                >
                  <div className="truncate font-medium">{conv.userContext?.disease || 'General'} Check</div>
                  <div className="text-[10px] opacity-50 mt-1">{conv.userContext?.patientName || 'Anonymous'} • {new Date(conv.updatedAt).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative w-full lg:w-auto">
        <header className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowHistory(!showHistory)} className="lg:hidden p-2 hover:bg-white/5 rounded-lg">
              <MessageSquare size={20} />
            </button>
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span className="text-sm font-medium text-slate-300">Neural Synthesis Active</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 font-mono flex gap-3">
            <span className="hidden sm:inline">DB: {systemStatus.database}</span>
            <span className="hidden sm:inline">Node: {systemStatus.huggingface === 'Available' ? 'Cloud' : 'Local'}</span>
            <span className={systemStatus.ollama === 'Active' || systemStatus.huggingface === 'Available' ? 'text-emerald-500' : 'text-rose-500'}>
              AI: {systemStatus.ollama === 'Active' ? 'Ollama Active' : (systemStatus.huggingface === 'Available' ? 'HF Cloud Active' : 'Offline')}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 space-y-8" onClick={() => setShowHistory(false)}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-6">
              <div className="p-4 bg-emerald-500/10 rounded-full">
                <Search size={40} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Case Initiated: {userContext.patientName || 'Anonymous'}</h2>
                <p className="text-slate-400 text-sm">System is primed with clinical context for <strong>{userContext.disease}</strong>. Enter your specific clinical inquiry below to begin cross-referencing global databases.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-4">
                {[
                  `Latest treatments for ${userContext.disease || 'this condition'}`, 
                  `Are there active clinical trials for ${userContext.disease || 'this condition'} in ${userContext.location || 'this area'}?`, 
                  `Summarize the newest PubMed publications on ${userContext.intent || 'this topic'}`, 
                  `What are the contraindications for standard therapies?`
                ].map(q => (
                  <button key={q} onClick={() => setInput(q)} className="p-4 glass-panel hover:bg-white/10 border border-white/5 text-xs text-slate-300 text-left transition-all rounded-xl">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}
              >
                {msg.role === 'assistant' && <div className="p-2 bg-blue-600 rounded-lg h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/20"><Bot size={18} /></div>}
                
                <div className={`max-w-[85%] sm:max-w-3xl space-y-4 ${msg.role === 'user' ? 'order-1' : ''}`}>
                  <div className={`p-3 sm:p-4 rounded-2xl text-sm sm:text-base ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-lg' : 'glass-panel text-slate-200'}`}>
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      {msg.sources.map((source, sIdx) => (
                        <a 
                          key={sIdx} 
                          href={source.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-3 glass-panel hover:bg-white/10 transition-all border-white/5 group rounded-xl"
                        >
                          <div className="flex items-start gap-3">
                            {source.type === 'trial' ? <FlaskConical size={16} className="text-emerald-400 mt-0.5 shrink-0" /> : <BookOpen size={16} className="text-blue-400 mt-0.5 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-slate-300 truncate group-hover:text-white transition-colors">{source.title}</div>
                              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className={source.type === 'trial' ? 'text-emerald-500/70' : 'text-blue-500/70'}>{source.source}</span>
                                <span>•</span>
                                <span>{source.year || source.status}</span>
                              </div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && <div className="p-2 bg-slate-800 rounded-lg h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 shadow-lg border border-white/10"><User size={18} /></div>}
              </motion.div>
            ))
          )}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
              <div className="p-2 bg-blue-600 rounded-lg h-10 w-10 flex items-center justify-center shrink-0"><Loader2 size={20} className="animate-spin text-white" /></div>
              <div className="p-4 glass-panel text-slate-400 text-sm animate-pulse flex items-center border-white/5 rounded-xl">
                Reasoning across research nodes... Analyzing local LLM models...
              </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 sm:p-6 bg-gradient-to-t from-black/80 to-transparent">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto glass-panel p-2 flex items-center gap-2 shadow-2xl border-white/10 rounded-xl relative z-10 w-full bg-black/40">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Query research for ${userContext.patientName || 'patient'}...`}
              className="flex-1 bg-transparent border-none outline-none px-2 sm:px-4 py-2 text-sm sm:text-base text-slate-200 placeholder:text-slate-500 w-full focus:ring-0"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className={`p-2.5 sm:p-3 rounded-lg flex shrink-0 transition-all ${isLoading || !input.trim() ? 'bg-white/5 text-slate-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30'}`}
            >
              <Send size={18} />
            </button>
          </form>
          <div className="text-[9px] sm:text-[10px] text-center text-slate-600 mt-3 sm:mt-4 uppercase tracking-widest font-bold">
            Powered by MedIntel Decentralized Open Intelligence // Research-Backed Responses
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  Layers, 
  CheckSquare, 
  MessageSquare, 
  Search, 
  FileDown, 
  AlertTriangle, 
  HelpCircle, 
  Plus, 
  Activity, 
  User, 
  Calendar,
  X,
  CheckCircle,
  Clock,
  Code
} from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import { api, type SearchResult } from './services/api';

const DEFAULT_WORKSPACE = '00000000-0000-0000-0000-000000000000';

export default function App() {
  const { isConnected, dashboardData } = useWebSocket(DEFAULT_WORKSPACE);
  
  // Local state
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaDesc, setNewIdeaDesc] = useState('');
  
  const [selectedIdeaForProj, setSelectedIdeaForProj] = useState<any | null>(null);
  const [projOwner, setProjOwner] = useState('');
  const [projDeadline, setProjDeadline] = useState('Friday');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const [pdfHireName, setPdfHireName] = useState('');
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  
  // Mock Webhook simulator state
  const [mockSource, setMockSource] = useState<'whatsapp' | 'slack' | 'github'>('slack');
  const [mockText, setMockText] = useState('');
  const [mockSender, setMockSender] = useState('');
  const [mockChannel, setMockChannel] = useState('#general');
  const [mockGithubTitle, setMockGithubTitle] = useState('');
  const [mockGithubDesc, setMockGithubDesc] = useState('');
  const [mockGithubNum, setMockGithubNum] = useState(101);
  const [isWebhookSending, setIsWebhookSending] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);

  // Global error notification
  const [appError, setAppError] = useState<string | null>(null);

  // Listen for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsIdeaModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Set default form values for mock simulator
  useEffect(() => {
    if (mockSource === 'slack') {
      setMockSender('Rahul');
      setMockText('We agreed to use PostgreSQL database for our backend. It has pgvector built-in.');
    } else if (mockSource === 'whatsapp') {
      setMockSender('+14155238886');
      setMockText('Sarah should build the React dashboard frontend components by Wednesday.');
    } else if (mockSource === 'github') {
      setMockSender('GitHubWebhook');
      setMockGithubTitle('feat: implement supabase db models');
      setMockGithubDesc('This PR configures database queries, connections, and runs migrations for PostgreSQL pgvector schemas.');
    }
  }, [mockSource]);

  // Handle Idea creation
  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdeaTitle || !newIdeaDesc) return;
    try {
      await api.createIdea(newIdeaTitle, newIdeaDesc, DEFAULT_WORKSPACE);
      setNewIdeaTitle('');
      setNewIdeaDesc('');
      setIsIdeaModalOpen(false);
    } catch (err: any) {
      setAppError(err.message || 'Failed to create idea');
    }
  };

  // Handle Project conversion
  const handleConvertProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIdeaForProj) return;
    try {
      await api.convertIdeaToProject(selectedIdeaForProj.id, projOwner, projDeadline, DEFAULT_WORKSPACE);
      setSelectedIdeaForProj(null);
      setProjOwner('');
      setProjDeadline('Friday');
    } catch (err: any) {
      setAppError(err.message || 'Failed to convert idea to project');
    }
  };

  // Handle Task status toggle
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    let nextStatus: 'todo' | 'in_progress' | 'blocked' | 'done' = 'done';
    if (currentStatus === 'done') {
      nextStatus = 'todo';
    } else if (currentStatus === 'todo') {
      nextStatus = 'in_progress';
    } else if (currentStatus === 'in_progress') {
      nextStatus = 'blocked';
    } else if (currentStatus === 'blocked') {
      nextStatus = 'done';
    }
    
    try {
      await api.updateTaskStatus(taskId, nextStatus, DEFAULT_WORKSPACE);
    } catch (err: any) {
      setAppError(err.message || 'Failed to update task status');
    }
  };

  // Handle Semantic Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.search(searchQuery, DEFAULT_WORKSPACE);
      setSearchResults(results);
    } catch (err: any) {
      setAppError(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle PDF Generation
  const handleGeneratePDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfHireName) return;
    setIsPdfGenerating(true);
    try {
      await api.generatePDF(pdfHireName, DEFAULT_WORKSPACE);
      setPdfHireName('');
    } catch (err: any) {
      setAppError(err.message || 'Failed to generate PDF');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // Handle Webhook Simulation
  const handleTriggerWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWebhookSending(true);
    setWebhookMessage(null);
    try {
      if (mockSource === 'slack') {
        await api.simulateSlack(mockText, mockSender, mockChannel, DEFAULT_WORKSPACE);
        setWebhookMessage('Slack event processed and broadcasted!');
      } else if (mockSource === 'whatsapp') {
        await api.simulateWhatsApp(mockText, mockSender, DEFAULT_WORKSPACE);
        setWebhookMessage('WhatsApp webhook digested and processed!');
      } else if (mockSource === 'github') {
        await api.simulateGitHub(mockGithubNum, mockGithubTitle, mockGithubDesc, DEFAULT_WORKSPACE);
        setWebhookMessage(`GitHub PR #${mockGithubNum} ingested!`);
        setMockGithubNum(prev => prev + 1);
      }
      setMockText('');
    } catch (err: any) {
      setAppError(err.message || 'Webhook trigger failed');
    } finally {
      setIsWebhookSending(false);
    }
  };

  // Extract dashboard statistics
  const decisions = dashboardData?.decisions || [];
  const actionItems = dashboardData?.actionItems || [];
  const ideas = dashboardData?.ideas || [];
  const projects = dashboardData?.projects || [];
  const tasks = dashboardData?.tasks || [];
  const blockers = dashboardData?.blockers || [];

  return (
    <div className="min-h-screen bg-hub-bg text-slate-100 flex flex-col font-sans selection:bg-blue-tide selection:text-slate-900">
      
      {/* HEADER SECTION */}
      <header className="border-b border-hub-border bg-hub-bg/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-driftwood/20 rounded-lg border border-driftwood/30 text-soft-sand">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-slate-100">
              STARTUP<span className="text-soft-sand">HUB</span>
            </h1>
            <p className="text-xs text-blue-tide">AI-Native Workspace</p>
          </div>
        </div>

        {/* Real-time Status Badge */}
        <div className="flex items-center space-x-2 bg-hub-card px-3 py-1.5 rounded-full border border-hub-border text-xs">
          <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
          <span className="text-slate-300 font-medium">{isConnected ? 'Live Connected' : 'Disconnected (Offline)'}</span>
        </div>

        {/* Global Semantic Search Form */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-6 relative">
          <input
            type="text"
            placeholder="Semantic vector search across Slack, GitHub, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-hub-card/85 text-sm text-slate-200 pl-10 pr-4 py-2 rounded-lg border border-hub-border focus:outline-none focus:border-blue-tide transition-colors"
          />
          {isSearching ? (
            <span className="absolute left-3 top-3.5 h-3.5 w-3.5 border-2 border-blue-tide border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-blue-tide" />
          )}
          {searchQuery && (
            <button 
              type="button" 
              onClick={() => { setSearchQuery(''); setSearchResults(null); }}
              className="absolute right-3 top-2.5 text-blue-tide hover:text-slate-100"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          )}
        </form>

        {/* Shortcut Info & Action */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:block text-xs text-blue-tide bg-hub-card/50 px-2 py-1.5 rounded border border-hub-border">
            Quick Add: <kbd className="bg-hub-border px-1 rounded text-slate-100">Cmd+K</kbd>
          </div>
          <button 
            onClick={() => setIsIdeaModalOpen(true)}
            className="flex items-center space-x-1.5 bg-blue-tide/15 hover:bg-blue-tide/25 text-blue-tide px-4 py-2 rounded-lg border border-blue-tide/30 text-sm font-semibold transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>New Idea</span>
          </button>
        </div>
      </header>

      {/* ERROR BANNER */}
      {appError && (
        <div className="bg-rose-950/80 border-b border-rose-800 text-rose-200 px-6 py-2.5 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>{appError}</span>
          </div>
          <button onClick={() => setAppError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SEARCH RESULTS LAYOUT OVERLAY */}
      {searchResults && (
        <div className="bg-hub-card/95 border-b border-hub-border px-6 py-5">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-bold text-soft-sand flex items-center space-x-2">
                <Search className="h-5 w-5" />
                <span>Vector Search Results ({searchResults.length} matches)</span>
              </h3>
              <button 
                onClick={() => { setSearchQuery(''); setSearchResults(null); }} 
                className="text-xs text-blue-tide hover:text-slate-200 border border-hub-border px-2 py-1 rounded"
              >
                Close Search
              </button>
            </div>
            
            <div className="space-y-3">
              {searchResults.map((r) => (
                <div key={r.id} className="p-3 bg-hub-bg rounded border border-hub-border flex items-start justify-between space-x-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-hub-border text-blue-tide uppercase">
                        {r.type}
                      </span>
                      {r.details?.sender && (
                        <span className="text-xs text-slate-400 font-medium">
                          Sender: {r.details.sender}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200">{r.text}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-soft-sand block bg-driftwood/10 border border-driftwood/20 px-2 py-1 rounded">
                      Match: {Math.round(r.score * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD PANELS CONTENT GRID */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-x-hidden">
        
        {/* PANEL 1: IDEATION (Ideas & Projects) */}
        <section className="space-y-6 lg:col-span-1">
          
          {/* IDEAS INBOX */}
          <div className="bg-hub-card rounded-xl border border-hub-border p-4 flex flex-col h-[380px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-hub-border/60">
              <h2 className="text-sm font-bold text-blue-tide uppercase tracking-wider flex items-center space-x-2">
                <Lightbulb className="h-4.5 w-4.5" />
                <span>Ideas Inbox</span>
              </h2>
              <span className="bg-hub-border text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                {ideas.filter((i: any) => i.status === 'inbox').length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {ideas.filter((i: any) => i.status === 'inbox').length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
                  <HelpCircle className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-xs">No ideas in the inbox yet.</p>
                  <p className="text-[10px] mt-1 text-slate-600">Press Cmd+K to capture an idea instantly.</p>
                </div>
              ) : (
                ideas
                  .filter((i: any) => i.status === 'inbox')
                  .map((i: any) => (
                    <div 
                      key={i.id} 
                      className="p-3 bg-hub-bg/60 rounded-lg border border-hub-border hover:border-soft-sand transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200">{i.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">{i.description}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-hub-border/40 flex items-center justify-between">
                        <span className="text-[10px] text-blue-tide">Source: {i.source}</span>
                        <button
                          onClick={() => setSelectedIdeaForProj(i)}
                          className="text-xs text-soft-sand hover:text-slate-100 hover:underline font-semibold"
                        >
                          Make Project &rarr;
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* ACTIVE PROJECTS LIST */}
          <div className="bg-hub-card rounded-xl border border-hub-border p-4 flex flex-col h-[380px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-hub-border/60">
              <h2 className="text-sm font-bold text-blue-tide uppercase tracking-wider flex items-center space-x-2">
                <Layers className="h-4.5 w-4.5" />
                <span>Active Projects</span>
              </h2>
              <span className="bg-hub-border text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                {projects.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {projects.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
                  <Layers className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-xs">No active projects yet.</p>
                  <p className="text-[10px] mt-1 text-slate-600">Convert an idea to populate a project with automated task lists.</p>
                </div>
              ) : (
                projects.map((p: any) => {
                  const projTasks = tasks.filter((t: any) => t.project_id === p.id);
                  const doneTasks = projTasks.filter((t: any) => t.status === 'done').length;
                  const progress = projTasks.length > 0 ? Math.round((doneTasks / projTasks.length) * 100) : 0;
                  
                  return (
                    <div key={p.id} className="p-3 bg-hub-bg/60 rounded-lg border border-hub-border">
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-bold text-slate-200">{p.title}</h4>
                        <span className="text-[10px] bg-hub-border text-soft-sand px-1.5 py-0.5 rounded uppercase font-mono">
                          {p.owner}
                        </span>
                      </div>
                      
                      {/* Requirements display */}
                      <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed bg-hub-bg p-1.5 rounded border border-hub-border/40">
                        {p.description}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-blue-tide mb-1">
                          <span>Task Progress ({doneTasks}/{projTasks.length})</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-hub-border h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-soft-sand h-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Tasks breakdown (Click status to toggle) */}
                      {projTasks.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-hub-border/40 pt-2.5">
                          {projTasks.map((t: any) => (
                            <div 
                              key={t.id} 
                              onClick={() => handleToggleTaskStatus(t.id, t.status)}
                              className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-hub-border/30 cursor-pointer border border-transparent hover:border-hub-border/50 transition-all"
                            >
                              <div className="flex items-center space-x-2 truncate">
                                {t.status === 'done' ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                ) : t.status === 'in_progress' ? (
                                  <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                ) : t.status === 'blocked' ? (
                                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                ) : (
                                  <span className="h-3.5 w-3.5 rounded-full border border-slate-500 shrink-0"></span>
                                )}
                                <span className={`truncate ${t.status === 'done' ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                  {t.title}
                                </span>
                              </div>
                              <span className="text-[9px] text-blue-tide font-mono shrink-0 ml-2">
                                {t.assigned_to}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </section>

        {/* CENTER COLUMN: DASHBOARD & WORKSPACE LOGS (Decisions & Action Items) */}
        <section className="lg:col-span-2 space-y-6">
          
          {/* real-time decisions stream */}
          <div className="bg-hub-card rounded-xl border border-hub-border p-5 flex flex-col h-[380px]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-hub-border/60">
              <h2 className="text-sm font-bold text-blue-tide uppercase tracking-wider flex items-center space-x-2">
                <MessageSquare className="h-4.5 w-4.5" />
                <span>Workspace Decisions Feed</span>
              </h2>
              <span className="bg-hub-border text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                {decisions.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {decisions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
                  <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No workspace decisions extracted yet.</p>
                  <p className="text-xs text-slate-600 mt-1 max-w-xs">
                    Simulate WhatsApp or Slack conversations on the right to trigger AI extraction logic.
                  </p>
                </div>
              ) : (
                decisions.map((d: any) => (
                  <div key={d.id} className="p-3 bg-hub-bg/50 rounded-lg border border-hub-border border-l-4 border-l-soft-sand">
                    <p className="text-sm text-slate-100 font-medium leading-relaxed">
                      {d.decision_text}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-blue-tide">
                      <span>Logged: {new Date(d.created_at).toLocaleTimeString()}</span>
                      <span>Verified: Fallback Rules</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ACTION ITEMS & dependency warning block */}
          <div className="bg-hub-card rounded-xl border border-hub-border p-5 flex flex-col h-[380px]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-hub-border/60">
              <h2 className="text-sm font-bold text-blue-tide uppercase tracking-wider flex items-center space-x-2">
                <CheckSquare className="h-4.5 w-4.5" />
                <span>Extracted Action Items</span>
              </h2>
              <span className="bg-hub-border text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                {actionItems.length}
              </span>
            </div>

            {/* BLOCKER WARNING BOX (Displays if any circular dependencies exist) */}
            {blockers.length > 0 && (
              <div className="mb-4 bg-driftwood/10 border border-driftwood/35 p-3 rounded-lg flex items-start space-x-3 text-driftwood">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-soft-sand">
                    Circular Dependencies & Blockers Detected
                  </h4>
                  <ul className="list-disc pl-4 text-[11px] mt-1 space-y-1 text-slate-300">
                    {blockers.map((b: any, index: number) => (
                      <li key={index}>
                        {b.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {actionItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
                  <CheckSquare className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No action items extracted yet.</p>
                </div>
              ) : (
                actionItems.map((item: any) => (
                  <div 
                    key={item.id}
                    className="p-3 bg-hub-bg/50 rounded-lg border border-hub-border flex items-center justify-between space-x-4"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{item.task}</h4>
                      <div className="flex items-center space-x-3 mt-1.5 text-[10px] text-blue-tide">
                        <span className="flex items-center space-x-1">
                          <User className="h-3 w-3" />
                          <span>Owner: {item.owner}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Deadline: {item.deadline}</span>
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={async () => {
                        try {
                          await api.updateTaskStatus(item.id, item.status === 'completed' ? 'pending' : 'completed', DEFAULT_WORKSPACE);
                        } catch (err: any) {
                          setAppError(err.message);
                        }
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                        item.status === 'completed' 
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                          : 'bg-hub-border text-slate-300 border-hub-border hover:border-slate-400'
                      }`}
                    >
                      {item.status === 'completed' ? 'Completed' : 'Pending'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

        {/* PANEL 3: ONBOARDING PDF & WEBHOOK SIMULATOR */}
        <section className="space-y-6 lg:col-span-1">
          
          {/* AUTO-GENERATE ONBOARDING PDF */}
          <div className="bg-hub-card rounded-xl border border-hub-border p-4">
            <h2 className="text-sm font-bold text-blue-tide uppercase tracking-wider mb-3 pb-2 border-b border-hub-border/60 flex items-center space-x-2">
              <FileDown className="h-4.5 w-4.5" />
              <span>Onboarding PDF</span>
            </h2>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Compile decisions, architecture constraints, and active project tasks into a formatted PDF brief for new hires.
            </p>

            <form onSubmit={handleGeneratePDF} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-blue-tide mb-1">New Hire Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={pdfHireName}
                  onChange={(e) => setPdfHireName(e.target.value)}
                  className="w-full bg-hub-bg text-xs text-slate-200 px-3 py-2 rounded border border-hub-border focus:outline-none focus:border-soft-sand"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isPdfGenerating || !pdfHireName}
                className="w-full bg-soft-sand hover:bg-slate-200 text-slate-900 text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {isPdfGenerating ? (
                  <span>Generating PDF...</span>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    <span>Download Onboarding Brief</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* INTERACTIVE WEBHOOK MOCK SIMULATOR */}
          <div className="bg-hub-card rounded-xl border border-hub-border p-4">
            <h2 className="text-sm font-bold text-blue-tide uppercase tracking-wider mb-3 pb-2 border-b border-hub-border/60 flex items-center space-x-2">
              <Activity className="h-4.5 w-4.5 animate-pulse" />
              <span>Webhook Simulator</span>
            </h2>

            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Simulate events from Slack threads, Twilio WhatsApp, or GitHub triggers to verify live state extraction.
            </p>

            <div className="grid grid-cols-3 gap-1 mb-4 bg-hub-bg p-1 rounded border border-hub-border">
              {(['slack', 'whatsapp', 'github'] as const).map(src => (
                <button
                  key={src}
                  type="button"
                  onClick={() => { setMockSource(src); setWebhookMessage(null); }}
                  className={`text-[10px] font-bold py-1 rounded transition-colors uppercase ${
                    mockSource === src 
                      ? 'bg-hub-border text-soft-sand border border-hub-border' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>

            <form onSubmit={handleTriggerWebhook} className="space-y-3">
              
              {/* SENDER INPUT (Only WhatsApp & Slack) */}
              {mockSource !== 'github' && (
                <div>
                  <label className="block text-[10px] font-semibold text-blue-tide mb-1">
                    {mockSource === 'whatsapp' ? 'Phone Number (From)' : 'Sender Username'}
                  </label>
                  <input
                    type="text"
                    value={mockSender}
                    onChange={(e) => setMockSender(e.target.value)}
                    className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none focus:border-soft-sand"
                    required
                  />
                </div>
              )}

              {/* SLACK CHANNEL (Only Slack) */}
              {mockSource === 'slack' && (
                <div>
                  <label className="block text-[10px] font-semibold text-blue-tide mb-1">Slack Channel</label>
                  <input
                    type="text"
                    value={mockChannel}
                    onChange={(e) => setMockChannel(e.target.value)}
                    className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none"
                    required
                  />
                </div>
              )}

              {/* MESSAGE TEXT (Slack & WhatsApp) */}
              {mockSource !== 'github' && (
                <div>
                  <label className="block text-[10px] font-semibold text-blue-tide mb-1">Message Content</label>
                  <textarea
                    value={mockText}
                    onChange={(e) => setMockText(e.target.value)}
                    rows={3}
                    placeholder="Enter chat dialogue..."
                    className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none focus:border-soft-sand resize-none"
                    required
                  />
                  <p className="text-[9px] text-slate-500 mt-1">
                    {mockSource === 'slack' 
                      ? 'Decision trigger words: decide, agreed, use, chosen.'
                      : 'Action item trigger words: will, should, by [date].'
                    }
                  </p>
                </div>
              )}

              {/* GITHUB FIELDS */}
              {mockSource === 'github' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-semibold text-blue-tide mb-1">PR #</label>
                      <input
                        type="number"
                        value={mockGithubNum}
                        onChange={(e) => setMockGithubNum(Number(e.target.value))}
                        className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-blue-tide mb-1">PR Title</label>
                      <input
                        type="text"
                        value={mockGithubTitle}
                        onChange={(e) => setMockGithubTitle(e.target.value)}
                        className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-blue-tide mb-1">PR Description</label>
                    <textarea
                      value={mockGithubDesc}
                      onChange={(e) => setMockGithubDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {webhookMessage && (
                <div className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/20 border border-emerald-900 p-2 rounded">
                  {webhookMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isWebhookSending}
                className="w-full bg-hub-border hover:bg-slate-700 text-slate-100 text-xs font-bold py-2 rounded transition-colors flex items-center justify-center space-x-1.5"
              >
                {isWebhookSending ? <span>Sending...</span> : <span>Simulate Event</span>}
              </button>

            </form>
          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-hub-border bg-hub-bg py-4 px-6 text-center text-xs text-slate-500 flex items-center justify-between">
        <span>&copy; 2026 StartupHub Inc. Hackathon Release.</span>
        <span className="flex items-center space-x-1 text-slate-600">
          <Code className="h-3.5 w-3.5" />
          <span>PostgreSQL + pgvector + Anthropic Claude SDK</span>
        </span>
      </footer>

      {/* MODAL 1: INSTANT IDEA CAPTURE (Cmd+K overlay) */}
      {isIdeaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-hub-card border border-hub-border rounded-xl w-full max-w-md p-5 relative shadow-2xl">
            <button 
              onClick={() => setIsIdeaModalOpen(false)}
              className="absolute right-4 top-4 text-blue-tide hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center space-x-2 text-soft-sand mb-4">
              <Lightbulb className="h-5 w-5" />
              <h3 className="text-md font-bold uppercase tracking-wider">Instant Idea Capture</h3>
            </div>

            <form onSubmit={handleCreateIdea} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-blue-tide mb-1">Idea Title</label>
                <input
                  type="text"
                  placeholder="e.g. Realtime PDF Generator"
                  value={newIdeaTitle}
                  onChange={(e) => setNewIdeaTitle(e.target.value)}
                  className="w-full bg-hub-bg text-sm text-slate-200 px-3 py-2 rounded-lg border border-hub-border focus:outline-none focus:border-soft-sand"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-tide mb-1">Description</label>
                <textarea
                  placeholder="Explain the problem it solves, technology stack, or target metrics..."
                  value={newIdeaDesc}
                  onChange={(e) => setNewIdeaDesc(e.target.value)}
                  rows={4}
                  className="w-full bg-hub-bg text-sm text-slate-200 px-3 py-2 rounded-lg border border-hub-border focus:outline-none focus:border-soft-sand resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIdeaModalOpen(false)}
                  className="px-4 py-2 bg-hub-bg hover:bg-hub-border text-slate-400 text-xs font-bold rounded-lg border border-hub-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-soft-sand hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                >
                  Save Idea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MAKE PROJECT & AUTOGENERATE TASK LISTS */}
      {selectedIdeaForProj && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-hub-card border border-hub-border rounded-xl w-full max-w-md p-5 relative shadow-2xl">
            <button 
              onClick={() => setSelectedIdeaForProj(null)}
              className="absolute right-4 top-4 text-blue-tide hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center space-x-2 text-soft-sand mb-3">
              <Layers className="h-5 w-5" />
              <h3 className="text-md font-bold uppercase tracking-wider">Convert Idea to Project</h3>
            </div>

            <div className="bg-hub-bg p-3 rounded-lg border border-hub-border/50 text-xs mb-4">
              <h4 className="font-bold text-slate-200">{selectedIdeaForProj.title}</h4>
              <p className="text-slate-400 mt-1">{selectedIdeaForProj.description}</p>
            </div>

            <form onSubmit={handleConvertProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-blue-tide mb-1">Project Owner</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul"
                  value={projOwner}
                  onChange={(e) => setProjOwner(e.target.value)}
                  className="w-full bg-hub-bg text-sm text-slate-200 px-3 py-2 rounded-lg border border-hub-border focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-tide mb-1">Target Deadline</label>
                <input
                  type="text"
                  placeholder="e.g. Wednesday, Friday, or June 20th"
                  value={projDeadline}
                  onChange={(e) => setProjDeadline(e.target.value)}
                  className="w-full bg-hub-bg text-sm text-slate-200 px-3 py-2 rounded-lg border border-hub-border focus:outline-none"
                  required
                />
              </div>

              <div className="bg-driftwood/10 border border-driftwood/25 p-3 rounded text-[11px] text-slate-300">
                <HelpCircle className="h-4 w-4 inline mr-1 text-soft-sand align-text-bottom" />
                <span>
                  Converting this idea will query the vector database for related Slack/WhatsApp messages and extract requirements. It then breaks down the scope into tasks assigned to the owner automatically.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIdeaForProj(null)}
                  className="px-4 py-2 bg-hub-bg hover:bg-hub-border text-slate-400 text-xs font-bold rounded-lg border border-hub-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-soft-sand hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                >
                  Generate Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

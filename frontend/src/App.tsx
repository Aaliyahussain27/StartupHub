import React, { useState, useEffect, useRef } from 'react';
import {
  Lightbulb,
  Layers,
  CheckSquare,
  Search,
  FileDown,
  AlertTriangle,
  HelpCircle,
  Plus,
  Activity,
  X,
  Code,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquarePlus,
  MessageSquare,
  GitMerge,
  Link2
} from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import { api, type SearchResult, type SimilarIdea } from './services/api';
import { ToastContainer, type Toast, type ToastType } from './components/Toast';
import { DailyBriefing } from './components/DailyBriefing';
import { ProjectWorkspace } from './components/ProjectWorkspace';

const DEFAULT_WORKSPACE = '00000000-0000-0000-0000-000000000000';

export default function App() {
  const { isConnected, dashboardData } = useWebSocket(DEFAULT_WORKSPACE);

  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaDesc, setNewIdeaDesc] = useState('');

  // Project Deadline Management State Setup (Supports Interactive Native Calendar Inputs)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedIdeaForProj, setSelectedIdeaForProj] = useState<any | null>(null);
  const [projOwner, setProjOwner] = useState('Ovee'); 
  const [projDeadline, setProjDeadline] = useState('2026-06-19'); 

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [pdfHireName, setPdfHireName] = useState('');
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const [mockSource, setMockSource] = useState<'whatsapp' | 'slack' | 'github'>('slack');
  const [mockText, setMockText] = useState('');
  const [mockSender, setMockSender] = useState('');
  const [mockChannel, setMockChannel] = useState('#general');
  const [mockGithubTitle, setMockGithubTitle] = useState('');
  const [mockGithubDesc, setMockGithubDesc] = useState('');
  const [mockGithubNum, setMockGithubNum] = useState(101);
  const [isWebhookSending, setIsWebhookSending] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);

  const [appError, setAppError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [activeTool, setActiveTool] = useState<'briefing' | 'onboarding' | 'simulator' | null>(null);
  const [activeProject, setActiveProject] = useState<any | null>(null);
  const [activeIdea, setActiveIdea] = useState<any | null>(null);
  const [similarIdeas, setSimilarIdeas] = useState<SimilarIdea[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [mergingId, setMergingId] = useState<string | null>(null);

  const [duplicateCandidates, setDuplicateCandidates] = useState<SimilarIdea[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Sidebar section collapse/expand state
  const [sectionOpen, setSectionOpen] = useState({ ideas: true, projects: true, tools: true });
  const toggleSection = (key: 'ideas' | 'projects' | 'tools') => {
    setSectionOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Whole-sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Per-idea comments (local until backend support exists)
  const [ideaComments, setIdeaComments] = useState<Record<string, string[]>>({});
  const [openCommentIdeaId, setOpenCommentIdeaId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');

  const addIdeaComment = (ideaId: string) => {
    if (!commentDraft.trim()) return;
    setIdeaComments(prev => ({ ...prev, [ideaId]: [...(prev[ideaId] || []), commentDraft.trim()] }));
    setCommentDraft('');
    setOpenCommentIdeaId(null);
  };

  // Comment input for the idea working-window view
  const [ideaDetailCommentDraft, setIdeaDetailCommentDraft] = useState('');
  const addIdeaDetailComment = (ideaId: string) => {
    if (!ideaDetailCommentDraft.trim()) return;
    setIdeaComments(prev => ({ ...prev, [ideaId]: [...(prev[ideaId] || []), ideaDetailCommentDraft.trim()] }));
    setIdeaDetailCommentDraft('');
  };

  const pushToast = (type: ToastType, title: string, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-4), { id, type, title, message }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const prevDataRef = useRef<any>(null);

  useEffect(() => {
    if (!dashboardData) return;
    const prev = prevDataRef.current;
    if (prev) {
      if (dashboardData.decisions?.length > (prev.decisions?.length || 0)) {
        const newest = dashboardData.decisions[0];
        pushToast('decision', 'New Decision', newest?.decision_text?.slice(0, 80) || 'A decision was logged.');
      }
      if (dashboardData.actionItems?.length > (prev.actionItems?.length || 0)) {
        const newest = dashboardData.actionItems[0];
        pushToast('info', 'Action Item', `${newest?.owner}: ${newest?.task?.slice(0, 60) || 'New task added.'}`);
      }
      if (dashboardData.ideas?.length > (prev.ideas?.length || 0)) {
        const newest = dashboardData.ideas[0];
        pushToast('success', 'Idea Captured', newest?.title || 'New idea added to inbox.');
      }
      if (dashboardData.projects?.length > (prev.projects?.length || 0)) {
        const newest = dashboardData.projects[0];
        pushToast('success', 'Project Created', newest?.title || 'A new project was generated.');
      }
      if ((dashboardData.blockers?.length || 0) > (prev.blockers?.length || 0)) {
        pushToast('warning', 'Blocker Detected', 'A task blocker was flagged — check the action items panel.');
      }
    }
    prevDataRef.current = dashboardData;
  }, [dashboardData]);

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

  useEffect(() => {
    setMockText('');
    setMockSender('');
    setMockGithubTitle('');
    setMockGithubDesc('');
  }, [mockSource]);

  useEffect(() => {
    if (!activeIdea?.id) {
      setSimilarIdeas([]);
      return;
    }
    setLoadingSimilar(true);
    api.getSimilarIdeas(activeIdea.id, DEFAULT_WORKSPACE)
      .then(setSimilarIdeas)
      .catch(() => setSimilarIdeas([]))
      .finally(() => setLoadingSimilar(false));
  }, [activeIdea?.id]);

  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdeaTitle || !newIdeaDesc) return;
    try {
      const { idea, similar } = await api.createIdea(newIdeaTitle, newIdeaDesc, DEFAULT_WORKSPACE);
      setNewIdeaTitle('');
      setNewIdeaDesc('');
      setIsIdeaModalOpen(false);

      const likelyDuplicates = similar.filter(s => s.score >= 0.45);
      if (likelyDuplicates.length > 0) {
        setDuplicateCandidates(likelyDuplicates);
        setActiveIdea(idea);
        setIsDuplicateModalOpen(true);
        pushToast('warning', 'Possible Duplicate', `"${idea.title}" looks similar to ${likelyDuplicates.length} existing idea(s).`);
      } else if (similar.length > 0) {
        pushToast('info', 'Related Ideas Found', `${similar.length} similar idea(s) linked in the idea view.`);
        setActiveIdea(idea);
      }
    } catch (err: any) {
      setAppError(err.message || 'Failed to create idea');
    }
  };

  const handleMergeIdeas = async (keepId: string, mergeId: string, keepTitle?: string) => {
    setMergingId(mergeId);
    try {
      const result = await api.mergeIdeas(keepId, mergeId, DEFAULT_WORKSPACE);
      setSimilarIdeas(prev => prev.filter(s => s.id !== mergeId));
      setDuplicateCandidates(prev => prev.filter(s => s.id !== mergeId));
      if (activeIdea?.id === keepId || activeIdea?.id === mergeId) {
        setActiveIdea(result.idea);
      }
      if (isDuplicateModalOpen) setIsDuplicateModalOpen(false);
      pushToast('success', 'Ideas Merged', `"${result.mergedFrom.title}" folded into "${keepTitle || result.idea.title}".`);
    } catch (err: any) {
      setAppError(err.message || 'Failed to merge ideas');
    } finally {
      setMergingId(null);
    }
  };

  const handleConvertProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIdeaForProj) return;
    try {
      await api.convertIdeaToProject(selectedIdeaForProj.id, projOwner, projDeadline, DEFAULT_WORKSPACE);
      setSelectedIdeaForProj(null);
      setIsProjectModalOpen(false);
    } catch (err: any) {
      setAppError(err.message || 'Failed to convert idea to project');
    }
  };

  const handleSaveDeadlineUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProjectModalOpen(false);
    pushToast('success', 'Deadline Configured', 'Project settings matrix safely applied.');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) { setSearchResults(null); return; }
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

  const handleTriggerWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWebhookSending(true);
    setWebhookMessage(null);
    try {
      if (mockSource === 'slack') {
        await api.simulateSlack(mockText, mockSender, mockChannel, DEFAULT_WORKSPACE);
        setWebhookMessage('Slack event processed and broadcasted!');
        pushToast('success', 'Slack Event', 'Message ingested — Claude is extracting decisions.');
      } else if (mockSource === 'whatsapp') {
        await api.simulateWhatsApp(mockText, mockSender, DEFAULT_WORKSPACE);
        setWebhookMessage('WhatsApp webhook digested and processed!');
        pushToast('success', 'WhatsApp Event', 'Message ingested — AI processing in progress.');
      } else if (mockSource === 'github') {
        await api.simulateGitHub(mockGithubNum, mockGithubTitle, mockGithubDesc, DEFAULT_WORKSPACE);
        setWebhookMessage(`GitHub PR #${mockGithubNum} ingested!`);
        pushToast('info', 'GitHub PR', `PR #${mockGithubNum} "${mockGithubTitle.slice(0, 40)}" logged.`);
        setMockGithubNum(prev => prev + 1);
      }
      setMockText('');
    } catch (err: any) {
      setAppError(err.message || 'Webhook trigger failed');
    } finally {
      setIsWebhookSending(false);
    }
  };

  const decisions = dashboardData?.decisions || [];
  const ideas = dashboardData?.ideas || [];
  
  // Inject structured creation defaults for dynamic calculation logic
  const projects = (dashboardData?.projects || []).map((p: any) => ({
    ...p,
    activeSince: p.activeSince || '2026-06-10',
    deadline: p.id === activeProject?.id ? projDeadline : (p.deadline || projDeadline),
    owner: p.id === activeProject?.id ? projOwner : (p.owner || projOwner)
  }));

  const tasks = dashboardData?.tasks || [];
  const blockers = dashboardData?.blockers || [];

  return (
    <div className="min-h-screen bg-hub-bg text-slate-100 flex flex-col font-sans selection:bg-blue-tide selection:text-slate-900">

      {/* HEADER */}
      <header className="border-b border-hub-border bg-hub-bg/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-driftwood/20 rounded-lg border border-driftwood/30 text-soft-sand">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-slate-100">STARTUP<span className="text-soft-sand">HUB</span></h1>
            <p className="text-xs text-blue-tide">AI-Native Workspace</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-hub-card px-3 py-1.5 rounded-full border border-hub-border text-xs">
          <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
          <span className="text-slate-300 font-medium">{isConnected ? 'Live Connected' : 'Disconnected (Offline)'}</span>
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-6 relative">
          <input
            type="text"
            placeholder="Semantic vector search across Slack, GitHub, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-hub-card/85 text-sm text-slate-200 pl-10 pr-4 py-2 rounded-lg border border-hub-border focus:outline-none focus:border-blue-tide transition-colors"
          />
          {isSearching
            ? <span className="absolute left-3 top-3.5 h-3.5 w-3.5 border-2 border-blue-tide border-t-transparent rounded-full animate-spin"></span>
            : <Search className="absolute left-3 top-2.5 h-4 w-4 text-blue-tide" />}
          {searchQuery && (
            <button type="button" onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="absolute right-3 top-2.5 text-blue-tide hover:text-slate-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex items-center space-x-4">
          <div className="hidden md:block text-xs text-blue-tide bg-hub-card/50 px-2 py-1.5 rounded border border-hub-border">
            Quick Add: <kbd className="bg-hub-border px-1 rounded text-slate-100">Cmd+K</kbd>
          </div>
          <button onClick={() => setIsIdeaModalOpen(true)} className="flex items-center space-x-1.5 bg-blue-tide/15 hover:bg-blue-tide/25 text-blue-tide px-4 py-2 rounded-lg border border-blue-tide/30 text-sm font-semibold transition-all">
            <Plus className="h-4 w-4" /><span>New Idea</span>
          </button>
        </div>
      </header>

      {/* ERROR BANNER */}
      {appError && (
        <div className="bg-rose-950/80 border-b border-rose-800 text-rose-200 px-6 py-2.5 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2"><AlertTriangle className="h-4 w-4 text-rose-400" /><span>{appError}</span></div>
          <button onClick={() => setAppError(null)} className="text-rose-400 hover:text-rose-200"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* SEARCH RESULTS */}
      {searchResults && (
        <div className="bg-hub-card/95 border-b border-hub-border px-6 py-5">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-bold text-soft-sand flex items-center space-x-2">
                <Search className="h-5 w-5" /><span>Vector Search Results ({searchResults.length} matches)</span>
              </h3>
              <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="text-xs text-blue-tide hover:text-slate-200 border border-hub-border px-2 py-1 rounded">Close Search</button>
            </div>
            <div className="space-y-3">
              {searchResults.map((r) => (
                <div key={r.id} className="p-3 bg-hub-bg rounded border border-hub-border flex items-start justify-between space-x-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-hub-border text-blue-tide uppercase">{r.type}</span>
                      {r.details?.sender && <span className="text-xs text-slate-400 font-medium">Sender: {r.details.sender}</span>}
                    </div>
                    <p className="text-sm text-slate-200">{r.text}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-soft-sand block bg-driftwood/10 border border-driftwood/20 px-2 py-1 rounded">Match: {Math.round(r.score * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MAIN SIDEBAR + WORKSPACE GRID */}
      <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6 overflow-x-hidden items-stretch">

        {/* COMPREHENSIVE SIDEBAR PANEL TREE */}
        <section className={`shrink-0 transition-all duration-200 ${sidebarCollapsed ? 'w-full lg:w-14' : 'w-full lg:w-80'}`}>
          <div className="bg-hub-card rounded-xl border border-hub-border p-3 flex flex-col gap-1 h-full sticky top-24">

            <div className={`flex items-center px-2 py-2 mb-1 border-b border-hub-border/60 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!sidebarCollapsed && <span className="text-xs font-bold text-blue-tide uppercase tracking-wider">Workspace</span>}
              <button
                onClick={() => setSidebarCollapsed(prev => !prev)}
                className="text-slate-500 hover:text-slate-200 transition-colors"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-2 pt-1">
                <button onClick={() => { setSidebarCollapsed(false); setSectionOpen(prev => ({ ...prev, ideas: true })); }} className="p-2 rounded-lg hover:bg-hub-bg/60 text-amber-400" title="Ideas">
                  <Lightbulb className="h-4 w-4" />
                </button>
                <button onClick={() => { setSidebarCollapsed(false); setSectionOpen(prev => ({ ...prev, projects: true })); }} className="p-2 rounded-lg hover:bg-hub-bg/60 text-blue-tide" title="Projects">
                  <Layers className="h-4 w-4" />
                </button>
                <button onClick={() => { setSidebarCollapsed(false); setSectionOpen(prev => ({ ...prev, tools: true })); }} className="p-2 rounded-lg hover:bg-hub-bg/60 text-slate-500" title="Tools">
                  <Activity className="h-4 w-4" />
                </button>
              </div>
            ) : (
            <>
              {/* IDEAS SECTION */}
              <div>
                <button
                  onClick={() => toggleSection('ideas')}
                  className="flex items-center gap-2 px-2 py-1.5 w-full text-left hover:bg-hub-bg/40 rounded-lg transition-colors"
                >
                  {sectionOpen.ideas ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronRight className="h-3 w-3 text-slate-500" />}
                  <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ideas</span>
                  <span className="ml-auto text-[10px] bg-hub-border text-slate-400 rounded-full px-1.5 py-0.5 font-mono">{ideas.filter((i: any) => i.status === 'inbox').length}</span>
                </button>
                {sectionOpen.ideas && (
                  ideas.filter((i: any) => i.status === 'inbox').length === 0
                    ? <p className="text-[11px] text-slate-600 px-7 py-1">No ideas yet — press Cmd+K</p>
                    : ideas.filter((i: any) => i.status === 'inbox').map((i: any) => (
                      <div key={i.id} className="px-7 py-1.5">
                        <div
                          onClick={() => { setActiveIdea(i); setActiveProject(null); setActiveTool(null); }}
                          className={`flex items-center justify-between rounded-lg group cursor-pointer transition-colors px-1 -mx-1 ${activeIdea?.id === i.id ? 'bg-hub-bg' : 'hover:bg-hub-bg/60'}`}
                        >
                          <span className={`text-[12px] truncate flex-1 ${activeIdea?.id === i.id ? 'text-slate-100' : 'text-slate-300'}`}>{i.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenCommentIdeaId(openCommentIdeaId === i.id ? null : i.id); setCommentDraft(''); }}
                            className="text-slate-500 hover:text-blue-tide transition-colors ml-2 shrink-0 relative"
                            title="Add comment"
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                            {(ideaComments[i.id]?.length || 0) > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-blue-tide text-slate-900 rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">{ideaComments[i.id].length}</span>
                            )}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedIdeaForProj(i); setIsProjectModalOpen(true); }}
                            className="text-[10px] text-blue-tide opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-2"
                          >
                            → Project
                          </button>
                        </div>
                        {i.description && (
                          <p className="text-[10px] text-slate-500 truncate pl-1 mt-0.5">{i.description}</p>
                        )}
                        {openCommentIdeaId === i.id && (
                          <div className="mt-1.5 pl-1 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {(ideaComments[i.id] || []).map((c, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-400 bg-hub-bg/60 rounded px-2 py-1">
                                <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-blue-tide" />
                                <span className="leading-snug">{c}</span>
                              </div>
                            ))}
                            <div className="flex gap-1.5">
                              <input
                                autoFocus
                                type="text"
                                value={commentDraft}
                                onChange={(e) => setCommentDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') addIdeaComment(i.id); if (e.key === 'Escape') setOpenCommentIdeaId(null); }}
                                placeholder="Add a comment..."
                                className="flex-1 bg-hub-bg text-[11px] text-slate-200 px-2 py-1 rounded border border-hub-border focus:outline-none focus:border-blue-tide"
                              />
                              <button onClick={() => addIdeaComment(i.id)} className="text-[10px] font-bold text-slate-900 bg-soft-sand hover:bg-slate-200 px-2 rounded transition-colors">Add</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>

              <div className="border-t border-hub-border/40 my-1" />

              {/* PROJECTS SECTION */}
              <div>
                <button
                  onClick={() => toggleSection('projects')}
                  className="flex items-center gap-2 px-2 py-1.5 w-full text-left hover:bg-hub-bg/40 rounded-lg transition-colors"
                >
                  {sectionOpen.projects ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronRight className="h-3 w-3 text-slate-500" />}
                  <Layers className="h-3.5 w-3.5 text-blue-tide" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Projects</span>
                  <span className="ml-auto text-[10px] bg-hub-border text-slate-400 rounded-full px-1.5 py-0.5 font-mono">{projects.length}</span>
                </button>
                {sectionOpen.projects && (
                  projects.length === 0
                    ? <p className="text-[11px] text-slate-600 px-7 py-1">No projects loaded yet</p>
                    : projects.map((p: any) => {
                      const projTasks = tasks.filter((t: any) => t.project_id === p.id);
                      const done = projTasks.filter((t: any) => t.status === 'done').length;
                      const pct = projTasks.length > 0 ? Math.round((done / projTasks.length) * 100) : 0;
                      return (
                        <div
                          key={p.id}
                          onClick={() => { setActiveProject(p); setActiveTool(null); setActiveIdea(null); }}
                          className={`px-7 py-1.5 rounded-lg cursor-pointer transition-colors ${activeProject?.id === p.id ? 'bg-hub-bg' : 'hover:bg-hub-bg/60'}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[12px] truncate flex-1 ${activeProject?.id === p.id ? 'text-slate-100' : 'text-slate-300'}`}>{p.title}</span>
                            <span className="text-[10px] text-slate-500 ml-2">{pct}%</span>
                          </div>
                          <div className="mt-1 h-0.5 bg-hub-border rounded-full w-full">
                            <div className="h-0.5 bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="border-t border-hub-border/40 my-1" />

              {/* TOOLS SECTION */}
              <div>
                <button
                  onClick={() => toggleSection('tools')}
                  className="flex items-center gap-2 px-2 py-1.5 w-full text-left hover:bg-hub-bg/40 rounded-lg transition-colors"
                >
                  {sectionOpen.tools ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronRight className="h-3 w-3 text-slate-500" />}
                  <Activity className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tools</span>
                </button>
                {sectionOpen.tools && ([
                  { label: 'AI Briefing',          key: 'briefing',   icon: <CheckSquare className="h-3.5 w-3.5" /> },
                  { label: 'Onboarding Generator', key: 'onboarding', icon: <FileDown    className="h-3.5 w-3.5" /> },
                  { label: 'Event Simulator',      key: 'simulator',  icon: <Activity    className="h-3.5 w-3.5" /> },
                ] as const).map(tool => (
                  <div
                    key={tool.key}
                    onClick={() => { setActiveTool(tool.key); setActiveProject(null); setActiveIdea(null); }}
                    className={`flex items-center gap-2 px-7 py-1.5 rounded-lg cursor-pointer transition-colors ${activeTool === tool.key ? 'bg-hub-bg text-slate-200' : 'hover:bg-hub-bg/60 text-slate-400'}`}
                  >
                    <span className={activeTool === tool.key ? 'text-blue-tide' : 'text-slate-500'}>{tool.icon}</span>
                    <span className="text-[12px]">{tool.label}</span>
                  </div>
                ))}
              </div>
            </>
            )}

          </div>
        </section>

        {/* CENTER COLUMN WORKSPACE ROUTER */}
        <section className="flex-1 min-w-0">

          {activeTool === 'briefing' && (
            <DailyBriefing workspaceId={DEFAULT_WORKSPACE} />
          )}

          {activeTool === 'onboarding' && (
            <div className="bg-hub-card rounded-xl border border-hub-border p-5">
              <h2 className="text-sm font-bold text-blue-tide uppercase tracking-wider mb-3 pb-2 border-b border-hub-border/60 flex items-center space-x-2">
                <FileDown className="h-4 w-4" /><span>Onboarding PDF Generator</span>
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">Compile decisions, architecture constraints, and active project tasks into a formatted PDF brief for new hires.</p>
              <form onSubmit={handleGeneratePDF} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-blue-tide mb-1">New Hire Name</label>
                  <input type="text" placeholder="e.g. Jane Doe" value={pdfHireName} onChange={(e) => setPdfHireName(e.target.value)} className="w-full bg-hub-bg text-xs text-slate-200 px-3 py-2 rounded border border-hub-border focus:outline-none focus:border-soft-sand" required />
                </div>
                <button type="submit" disabled={isPdfGenerating || !pdfHireName} className="w-full bg-soft-sand hover:bg-slate-200 text-slate-900 text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5">
                  {isPdfGenerating ? <span>Generating PDF...</span> : <><FileDown className="h-4 w-4" /><span>Download Onboarding Brief</span></>}
                </button>
              </form>
            </div>
          )}

          {activeTool === 'simulator' && (
            <div className="bg-hub-card rounded-xl border border-hub-border p-5">
              <h2 className="text-sm font-bold text-blue-tide uppercase tracking-wider mb-3 pb-2 border-b border-hub-border/60 flex items-center space-x-2">
                <Activity className="h-4 w-4 animate-pulse" /><span>Webhook Simulator</span>
              </h2>
              <div className="grid grid-cols-3 gap-1 mb-4 bg-hub-bg p-1 rounded border border-hub-border">
                {(['slack', 'whatsapp', 'github'] as const).map(src => (
                  <button key={src} type="button" onClick={() => { setMockSource(src); setWebhookMessage(null); }}
                    className={`text-[10px] font-bold py-1 rounded transition-colors uppercase ${mockSource === src ? 'bg-hub-border text-soft-sand' : 'text-slate-500 hover:text-slate-300'}`}>
                    {src}
                  </button>
                ))}
              </div>
              <form onSubmit={handleTriggerWebhook} className="space-y-3">
                {mockSource !== 'github' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-semibold text-blue-tide mb-1">{mockSource === 'whatsapp' ? 'Phone Number (From)' : 'Sender Username'}</label>
                      <input type="text" value={mockSender} onChange={(e) => setMockSender(e.target.value)} className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none" required />
                    </div>
                    {mockSource === 'slack' && (
                      <div>
                        <label className="block text-[10px] font-semibold text-blue-tide mb-1">Slack Channel</label>
                        <input type="text" value={mockChannel} onChange={(e) => setMockChannel(e.target.value)} className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none" required />
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-semibold text-blue-tide mb-1">Message Content</label>
                      <textarea value={mockText} onChange={(e) => setMockText(e.target.value)} rows={4} placeholder="Enter chat dialogue..." className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none resize-none" required />
                    </div>
                  </>
                )}
                {mockSource === 'github' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="block text-[10px] font-semibold text-blue-tide mb-1">PR #</label>
                        <input type="number" value={mockGithubNum} onChange={(e) => setMockGithubNum(Number(e.target.value))} className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none" required />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-blue-tide mb-1">PR Title</label>
                        <input type="text" value={mockGithubTitle} onChange={(e) => setMockGithubTitle(e.target.value)} className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none" required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-blue-tide mb-1">PR Description</label>
                      <textarea value={mockGithubDesc} onChange={(e) => setMockGithubDesc(e.target.value)} rows={2} className="w-full bg-hub-bg text-xs text-slate-200 px-2.5 py-1.5 rounded border border-hub-border focus:outline-none resize-none" />
                    </div>
                  </div>
                )}
                {webhookMessage && <div className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/20 border border-emerald-900 p-2 rounded">{webhookMessage}</div>}
                <button type="submit" disabled={isWebhookSending} className="w-full bg-hub-border hover:bg-slate-700 text-slate-100 text-xs font-bold py-2 rounded transition-colors flex items-center justify-center">
                  {isWebhookSending ? 'Sending...' : 'Simulate Event'}
                </button>
              </form>
            </div>
          )}

          {activeIdea && !activeTool && (
            <div className="bg-hub-card rounded-xl border border-hub-border p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between pb-3 border-b border-hub-border/60">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-400/15 rounded-lg border border-amber-400/30 text-amber-400 mt-0.5">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-100">{activeIdea.title}</h2>
                    <p className="text-[11px] text-blue-tide uppercase tracking-wider font-semibold">Idea</p>
                  </div>
                </div>
                <button onClick={() => setActiveIdea(null)} className="text-blue-tide hover:text-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-blue-tide uppercase tracking-wider mb-2">Description</h3>
                <p className="text-sm text-slate-300 leading-relaxed bg-hub-bg/50 rounded-lg border border-hub-border/40 p-3 whitespace-pre-wrap">
                  {activeIdea.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-blue-tide uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" /> Similar Ideas
                </h3>
                <div className="flex flex-col gap-2 bg-hub-bg/50 rounded-lg border border-hub-border/40 p-3">
                  {loadingSimilar && <p className="text-[11px] text-slate-600">Scanning for duplicates...</p>}
                  {!loadingSimilar && similarIdeas.length === 0 && (
                    <p className="text-[11px] text-slate-600">No similar ideas found.</p>
                  )}
                  {similarIdeas.map((s) => (
                    <div key={s.id} className="flex items-start justify-between gap-3 bg-hub-card/60 rounded-lg border border-hub-border/50 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-200 truncate">{s.title}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${s.score >= 0.45 ? 'bg-amber-900/40 text-amber-400' : 'bg-hub-border text-blue-tide'}`}>
                            {Math.round(s.score * 100)}% match
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2">{s.description}</p>
                      </div>
                      <button
                        onClick={() => handleMergeIdeas(activeIdea.id, s.id, activeIdea.title)}
                        disabled={mergingId === s.id}
                        className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-slate-900 bg-soft-sand hover:bg-slate-200 px-2 py-1.5 rounded transition-colors disabled:opacity-50"
                        title="Merge this duplicate into the current idea"
                      >
                        <GitMerge className="h-3 w-3" />
                        {mergingId === s.id ? '...' : 'Merge'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-blue-tide uppercase tracking-wider mb-2">Comments</h3>
                <div className="flex flex-col gap-2 bg-hub-bg/50 rounded-lg border border-hub-border/40 p-3">
                  {(ideaComments[activeIdea.id]?.length || 0) === 0 && (
                    <p className="text-[11px] text-slate-600">No comments yet.</p>
                  )}
                  {(ideaComments[activeIdea.id] || []).map((c, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 bg-hub-card/60 rounded px-2.5 py-1.5">
                      <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-tide" />
                      <span className="leading-snug">{c}</span>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={ideaDetailCommentDraft}
                      onChange={(e) => setIdeaDetailCommentDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addIdeaDetailComment(activeIdea.id); }}
                      placeholder="Add a comment..."
                      className="flex-1 bg-hub-bg text-xs text-slate-200 px-3 py-2 rounded-lg border border-hub-border focus:outline-none focus:border-blue-tide"
                    />
                    <button
                      onClick={() => addIdeaDetailComment(activeIdea.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-900 bg-soft-sand hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-driftwood/10 border border-driftwood/25 p-3 rounded-lg">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Ready to start building? Convert this idea into a project to generate tasks.
                </p>
                <button
                  onClick={() => { setSelectedIdeaForProj(activeIdea); setIsProjectModalOpen(true); }}
                  className="ml-3 shrink-0 px-3 py-2 bg-soft-sand hover:bg-slate-200 text-slate-900 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap"
                >
                  Convert to Project
                </button>
              </div>
            </div>
          )}

          {!activeIdea && !activeTool && (
            <ProjectWorkspace
              decisions={decisions}
              blockers={blockers}
              tasks={tasks.filter((t: any) => activeProject ? t.project_id === activeProject.id : true)}
              projects={activeProject ? [activeProject] : (projects.length > 0 ? projects : [{ id: 'p1', title: 'StartupHub Core', status: 'active', activeSince: '2026-06-10', deadline: projDeadline, owner: projOwner }])}
              onAddDeadlineClick={() => setIsProjectModalOpen(true)}
              onAddTaskClick={() => pushToast('info', 'Task Registration Pipeline', 'Task creation injection triggered context safely.')}
            />
          )}

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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* MODAL: DUPLICATE MERGE PROMPT */}
      {isDuplicateModalOpen && activeIdea && duplicateCandidates.length > 0 && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-hub-card border border-amber-900/50 rounded-xl w-full max-w-lg p-5 relative shadow-2xl">
            <button onClick={() => setIsDuplicateModalOpen(false)} className="absolute right-4 top-4 text-blue-tide hover:text-slate-100"><X className="h-5 w-5" /></button>
            <div className="flex items-center space-x-2 text-amber-400 mb-3">
              <GitMerge className="h-5 w-5" />
              <h3 className="text-md font-bold uppercase tracking-wider">Possible Duplicate</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Your new idea <span className="text-slate-200 font-semibold">"{activeIdea.title}"</span> looks similar to existing ideas. Merge to combine notes and avoid duplicate work.
            </p>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {duplicateCandidates.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 bg-hub-bg rounded-lg border border-hub-border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{s.title}</p>
                    <p className="text-[10px] text-slate-500">{Math.round(s.score * 100)}% semantic match</p>
                  </div>
                  <button
                    onClick={() => handleMergeIdeas(s.id, activeIdea.id, s.title)}
                    disabled={mergingId === activeIdea.id}
                    className="shrink-0 text-[10px] font-bold text-slate-900 bg-soft-sand hover:bg-slate-200 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    Keep this, merge new in
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setIsDuplicateModalOpen(false)}
              className="w-full text-xs font-semibold text-slate-400 hover:text-slate-200 py-2 border border-hub-border rounded-lg"
            >
              Keep as separate idea
            </button>
          </div>
        </div>
      )}

      {/* MODAL: IDEA CAPTURE */}
      {isIdeaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-hub-card border border-hub-border rounded-xl w-full max-w-md p-5 relative shadow-2xl">
            <button onClick={() => setIsIdeaModalOpen(false)} className="absolute right-4 top-4 text-blue-tide hover:text-slate-100"><X className="h-5 w-5" /></button>
            <div className="flex items-center space-x-2 text-soft-sand mb-4">
              <Lightbulb className="h-5 w-5" />
              <h3 className="text-md font-bold uppercase tracking-wider">Instant Idea Capture</h3>
            </div>
            <form onSubmit={handleCreateIdea} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-blue-tide mb-1">Idea Title</label>
                <input type="text" placeholder="e.g. Realtime PDF Generator" value={newIdeaTitle} onChange={(e) => setNewIdeaTitle(e.target.value)} className="w-full bg-hub-bg text-sm text-slate-200 px-3 py-2 rounded-lg border border-hub-border focus:outline-none focus:border-soft-sand" required autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-tide mb-1">Description</label>
                <textarea placeholder="Explain the problem it solves..." value={newIdeaDesc} onChange={(e) => setNewIdeaDesc(e.target.value)} rows={4} className="w-full bg-hub-bg text-sm text-slate-200 px-3 py-2 rounded-lg border border-hub-border focus:outline-none focus:border-soft-sand resize-none" required />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsIdeaModalOpen(false)} className="px-4 py-2 bg-hub-bg hover:bg-hub-border text-slate-400 text-xs font-bold rounded-lg border border-hub-border">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-soft-sand hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-lg transition-colors">Save Idea</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INTERACTIVE CALENDAR DEADLINE SELECTOR / PROJECT CONVERSION */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-hub-card border border-hub-border rounded-xl w-full max-w-md p-5 relative shadow-2xl">
            <button onClick={() => setIsProjectModalOpen(false)} className="absolute right-4 top-4 text-blue-tide hover:text-slate-100"><X className="h-5 w-5" /></button>
            <div className="flex items-center space-x-2 text-soft-sand mb-3">
              <Layers className="h-5 w-5 text-amber-400" />
              <h3 className="text-md font-bold uppercase tracking-wider text-slate-200">Configure Target Parameters</h3>
            </div>
            
            {selectedIdeaForProj && (
              <div className="bg-hub-bg p-3 rounded-lg border border-hub-border/50 text-xs mb-4">
                <h4 className="font-bold text-slate-200">{selectedIdeaForProj.title}</h4>
                <p className="text-slate-400 mt-1 line-clamp-2">{selectedIdeaForProj.description}</p>
              </div>
            )}

            <form onSubmit={selectedIdeaForProj ? handleConvertProject : handleSaveDeadlineUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-blue-tide mb-1">Project Owner</label>
                <input type="text" placeholder="e.g. Ovee" value={projOwner} onChange={(e) => setProjOwner(e.target.value)} className="w-full bg-hub-bg text-sm text-slate-200 px-3 py-2 rounded-lg border border-hub-border focus:outline-none" required autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-tide mb-1">Target Calendar Deadline</label>
                <input 
                  type="date" 
                  value={projDeadline} 
                  onChange={(e) => setProjDeadline(e.target.value)} 
                  className="w-full bg-hub-bg text-sm text-slate-200 px-3 py-2 rounded-lg border border-hub-border focus:outline-none focus:border-blue-tide font-mono" 
                  required 
                />
              </div>
              <div className="bg-driftwood/10 border border-driftwood/25 p-3 rounded text-[11px] text-slate-300">
                <HelpCircle className="h-4 w-4 inline mr-1 text-soft-sand align-text-bottom" />
                Updating changes the live workspace matrix. Subtask deadline intervals adjust automatically.
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 bg-hub-bg hover:bg-hub-border text-slate-400 text-xs font-bold rounded-lg border border-hub-border">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-tide text-slate-950 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Apply Matrix Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
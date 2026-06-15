import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquarePlus,
  MessageSquare,
  GitMerge,
  Link2,
  Sun,
  Moon,
  Mic,
  Eye,
  EyeOff
} from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import { api, type SearchResult, type SimilarIdea } from './services/api';
import { ToastContainer, type Toast, type ToastType } from './components/Toast';
import { DailyBriefing } from './components/DailyBriefing';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { CommunicationHub } from './components/CommunicationHub';
import { MeetingTranscription } from './components/MeetingTranscription';
import { useAppStore } from './store/useAppStore';

const DEFAULT_WORKSPACE = '00000000-0000-0000-0000-000000000000';

export function BrandLogo() {
  return (
    <div className="flex items-center space-x-2.5">
      <div className="p-1.5 bg-slate-100 dark:bg-hub-card rounded-xl border border-slate-200 dark:border-hub-border transition-colors">
        <img src="/icon-light.svg" alt="StartupHub" className="h-7 w-7 block dark:hidden select-none" />
        <img src="/icon-dark.svg" alt="StartupHub" className="h-7 w-7 hidden dark:block select-none" />
      </div>
      <div>
        <h1 className="text-lg font-extrabold tracking-wider text-slate-900 dark:text-slate-100 transition-colors">
          STARTUP<span className="text-slate-500 dark:text-soft-sand font-medium">HUB</span>
        </h1>
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 tracking-widest uppercase mt-[-2px]">Workspace</p>
      </div>
    </div>
  );
}

export function StartupHubLogo() {
  return (
    <div className="flex items-center gap-2 select-none animate-fadeIn">
      <img src="/logo-light.svg" alt="StartupHub Logo" className="h-6 block dark:hidden" />
      <img src="/logo-dark.svg" alt="StartupHub Logo" className="h-6 hidden dark:block" />
    </div>
  );
}


export default function App() {
  // Core Real-Time Ingestion Connection Hooks
  const { isConnected, dashboardData, momentumAlerts, blockerEscalation } = useWebSocket(DEFAULT_WORKSPACE);
  const queryClient = useQueryClient();

  // Central Zustand Store integration
  const {
    theme,
    toggleTheme,
    currentUser,
    setCurrentUser,
    activeProject,
    setActiveProject,
    activeTool,
    setActiveTool,
    activeIdea,
    setActiveIdea
  } = useAppStore();

  // TanStack Query for workspace users
  const { data: workspaceUsers = [] } = useQuery({
    queryKey: ['workspaceUsers', currentUser?.id],
    queryFn: () => api.getUsers(DEFAULT_WORKSPACE),
    enabled: !!currentUser
  });

  // TanStack Query for similar ideas matching the active idea
  const { data: similarIdeas = [], isLoading: loadingSimilar } = useQuery({
    queryKey: ['similarIdeas', activeIdea?.id],
    queryFn: () => activeIdea?.id ? api.getSimilarIdeas(activeIdea.id, DEFAULT_WORKSPACE) : Promise.resolve([]),
    enabled: !!activeIdea?.id
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // User Auth States
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('sh-auth-token');
      if (token) {
        try {
          const res = await api.getCurrentUser();
          setCurrentUser(res.user);
        } catch (err) {
          console.warn('Auth check failed, clearing token');
          localStorage.removeItem('sh-auth-token');
        }
      }
      setAuthChecking(false);
    };
    checkAuth();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      let res;
      if (authMode === 'login') {
        res = await api.login(authEmail, authPassword);
      } else {
        res = await api.register(authEmail, authPassword);
      }
      localStorage.setItem('sh-auth-token', res.token);
      setCurrentUser(res.user);
      
      pushToast('success', 'Welcome', authMode === 'login' ? 'Successfully logged in.' : 'Account created successfully.');
      
      window.location.reload();
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sh-auth-token');
    setCurrentUser(null);
    pushToast('info', 'Logged Out', 'You have been safely signed out.');
  };

  // UI State Variables
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaDesc, setNewIdeaDesc] = useState('');

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedIdeaForProj, setSelectedIdeaForProj] = useState<any | null>(null);
  const [projOwner, setProjOwner] = useState('Ovee'); 
  const [projDeadline, setProjDeadline] = useState('2026-06-19'); 
  const [projTitle, setProjTitle] = useState('');
  const [projDesc, setProjDesc] = useState(''); 

  // Task creation states
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');

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

  const [mergingId, setMergingId] = useState<string | null>(null);

  const [duplicateCandidates, setDuplicateCandidates] = useState<SimilarIdea[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Related messages for active idea
  const [relatedMessages, setRelatedMessages] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Related meetings for active idea
  const [relatedMeetings, setRelatedMeetings] = useState<any[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  const [sectionOpen, setSectionOpen] = useState({ ideas: true, projects: true, tools: true });
  const toggleSection = (key: 'ideas' | 'projects' | 'tools') => {
    setSectionOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [ideaComments, setIdeaComments] = useState<Record<string, string[]>>({});
  const [openCommentIdeaId, setOpenCommentIdeaId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');

  // Comment Handlers
  const addIdeaComment = (ideaId: string) => {
    if (!commentDraft.trim()) return;
    setIdeaComments(prev => ({ ...prev, [ideaId]: [...(prev[ideaId] || []), commentDraft.trim()] }));
    setCommentDraft('');
    setOpenCommentIdeaId(null);
  };

  const [ideaDetailCommentDraft, setIdeaDetailCommentDraft] = useState('');
  const addIdeaDetailComment = (ideaId: string) => {
    if (!ideaDetailCommentDraft.trim()) return;
    setIdeaComments(prev => ({ ...prev, [ideaId]: [...(prev[ideaId] || []), ideaDetailCommentDraft.trim()] }));
    setIdeaDetailCommentDraft('');
  };

  // Notification Engine Pipelines
  const pushToast = (type: ToastType, title: string, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-4), { id, type, title, message }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const prevDataRef = useRef<any>(null);

  // Broadcast Notification Listener Hook
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

  // Global Command Overlay Listener Hook
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

  // Webhook form cleanups
  useEffect(() => {
    setMockText('');
    setMockSender('');
    setMockGithubTitle('');
    setMockGithubDesc('');
  }, [mockSource]);



  // Load related messages whenever active idea changes
  useEffect(() => {
    if (!activeIdea?.id) { setRelatedMessages([]); return; }
    setLoadingRelated(true);
    api.getRelatedMessages(activeIdea.id, DEFAULT_WORKSPACE)
      .then(setRelatedMessages)
      .catch(() => setRelatedMessages([]))
      .finally(() => setLoadingRelated(false));
  }, [activeIdea?.id]);

  // Load related meetings whenever active idea changes
  useEffect(() => {
    if (!activeIdea?.id) { setRelatedMeetings([]); return; }
    setLoadingMeetings(true);
    api.getRelatedMeetings(activeIdea.id, DEFAULT_WORKSPACE)
      .then(setRelatedMeetings)
      .catch(() => setRelatedMeetings([]))
      .finally(() => setLoadingMeetings(false));
  }, [activeIdea?.id]);

  // Fire toasts when momentum/blocker alerts arrive via WebSocket
  useEffect(() => {
    if (!momentumAlerts) return;
    const names = momentumAlerts.stalledProjects.map(p => `"${p.title}" (${p.daysSinceActivity}d)`).join(', ');
    pushToast('warning', 'Momentum Alert', `${momentumAlerts.stalledProjects.length} stalled project(s): ${names}`);
  }, [momentumAlerts]);

  useEffect(() => {
    if (!blockerEscalation) return;
    const names = blockerEscalation.escalatedBlockers.map(b => `"${b.title}" (${b.hoursBlocked}h)`).join(', ');
    pushToast('error', 'Blocker Escalated', `${blockerEscalation.escalatedBlockers.length} task(s) blocked > 24h: ${names}`);
  }, [blockerEscalation]);

  // Network Form Action Callbacks
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
      queryClient.invalidateQueries({ queryKey: ['similarIdeas'] });
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

  const handleSaveDeadlineUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProject = activeProject || projects[0];
    if (!targetProject) {
      setIsProjectModalOpen(false);
      return;
    }
    try {
      await api.updateProjectSettings(
        targetProject.id, 
        { owner: projOwner, deadline: projDeadline, title: projTitle, description: projDesc }, 
        DEFAULT_WORKSPACE
      );
      setIsProjectModalOpen(false);
      pushToast('success', 'Settings Saved', `Project settings updated successfully.`);
    } catch (err: any) {
      setAppError(err.message || 'Failed to update project settings');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const proj = projects.find((p: any) => p.id === projectId);
    const title = proj ? proj.title : 'this project';
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteProject(projectId, DEFAULT_WORKSPACE);
      pushToast('success', 'Project Deleted', `"${title}" has been successfully deleted.`);
      if (activeProject?.id === projectId) {
        setActiveProject(null);
      }
    } catch (err: any) {
      setAppError(err.message || 'Failed to delete project');
    }
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

  // Variable Assignments Derived From Stream Feeds
  const decisions = dashboardData?.decisions || [];
  const ideas = dashboardData?.ideas || [];
  
  // Backend already scopes projects by user when authenticated — no client-side filter needed
  const projects = (dashboardData?.projects || []).map((p: any) => ({
    ...p,
    activeSince: p.activeSince || '2026-06-10',
    deadline: p.id === activeProject?.id ? projDeadline : (p.deadline || ''),
    owner: p.id === activeProject?.id ? projOwner : (p.owner || '')
  }));

  const tasks = dashboardData?.tasks || [];
  const blockers = dashboardData?.blockers || [];
  const messages = dashboardData?.messages || [];
  const githubPrs = dashboardData?.githubPrs || [];

  // Task handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !activeProject) return;
    try {
      await api.createTask(activeProject.id, newTaskTitle, newTaskAssignedTo, DEFAULT_WORKSPACE);
      setNewTaskTitle('');
      setNewTaskAssignedTo('');
      setIsTaskModalOpen(false);
      pushToast('success', 'Task Created', `Successfully added task: "${newTaskTitle}"`);
    } catch (err: any) {
      setAppError(err.message || 'Failed to create task');
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center text-slate-400 text-xs font-mono">
        <span>Initializing startup workspace context...</span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden selection:bg-blue-tide/30">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-8">
            <StartupHubLogo />
            <h2 className="text-xl font-bold mt-4 tracking-wide text-slate-200 uppercase">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {authMode === 'login' ? 'Sign in to access your startup workspace' : 'Get started with your AI-native workspace'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            {authError && (
              <div className="bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs p-3 rounded-lg flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Email Address</label>
              <input
                type="text"
                placeholder="you@startuphub.ai"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-950 text-sm text-slate-200 px-3 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-glow-indigo/80 transition-colors"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-slate-950 text-sm text-slate-200 pl-3 pr-10 py-2.5 rounded-lg border border-slate-800 focus:outline-none focus:border-glow-indigo/80 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-lg transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
            >
              {authMode === 'login' ? 'Sign In' : 'Register'}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-slate-800/60 pt-4">
            <button
              onClick={() => {
                setAuthMode(prev => prev === 'login' ? 'register' : 'login');
                setAuthError(null);
                setShowPassword(false);
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium underline"
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-hub-bg text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-glow-indigo/20 transition-colors duration-200">

      {/* HEADER ROW */}
      <header className="border-b border-slate-200 dark:border-hub-border bg-white/80 dark:bg-hub-bg/80 backdrop-blur sticky top-0 z-40 px-4 py-3 flex items-center gap-2 transition-colors min-w-0">
        <BrandLogo />

        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-hub-card px-3 py-1.5 rounded-full border border-slate-200 dark:border-hub-border text-xs transition-colors">
          <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">{isConnected ? 'Live Connected' : 'Disconnected (Offline)'}</span>
        </div>

        <form onSubmit={handleSearch} className="flex-1 min-w-0 max-w-xs mx-2 relative">
          <input
            type="text"
            placeholder="Semantic vector search across Slack, GitHub, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 dark:bg-hub-card/85 text-sm text-slate-800 dark:text-slate-200 pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-glow-indigo/60 transition-colors"
          />
          {isSearching
            ? <span className="absolute left-3 top-3.5 h-3.5 w-3.5 border-2 border-slate-400 dark:border-blue-tide border-t-transparent rounded-full animate-spin"></span>
            : <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-400" />}
          {searchQuery && (
            <button type="button" onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="absolute right-3 top-2.5 text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {currentUser && (
            <div className="flex items-center gap-2">
              <span className="hidden lg:inline text-xs font-semibold bg-slate-100 dark:bg-hub-card px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-hub-border text-slate-700 dark:text-slate-300 max-w-[140px] truncate">
                {currentUser.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 dark:text-rose-400 px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* THEME TOGGLE */}
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 dark:bg-hub-card border border-slate-200 dark:border-hub-border hover:bg-slate-200 dark:hover:bg-hub-border transition-all flex items-center justify-center shrink-0"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </button>

          {/* NEW IDEA BUTTON — always visible */}
          <button
            onClick={() => setIsIdeaModalOpen(true)}
            className="flex items-center gap-1.5 bg-glow-indigo hover:bg-glow-indigo/90 px-3 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 shadow-md shadow-glow-indigo/20 shrink-0 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Idea</span>
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

      {/* SEARCH RESULTS MATCH OVERLAY */}
      {searchResults && (
        <div className="bg-white dark:bg-hub-card/95 border-b border-slate-200 dark:border-hub-border px-6 py-5 transition-colors">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-bold text-slate-800 dark:text-soft-sand flex items-center space-x-2">
                <Search className="h-5 w-5" /><span>Vector Search Results ({searchResults.length} matches)</span>
              </h3>
              <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-hub-border px-2 py-1 rounded">Close Search</button>
            </div>
            <div className="space-y-3">
              {searchResults.map((r) => (
                <div key={r.id} className="p-3 bg-slate-50 dark:bg-hub-bg rounded border border-slate-200 dark:border-hub-border flex items-start justify-between space-x-4 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-hub-border text-slate-700 dark:text-slate-400 uppercase tracking-wider">{r.type}</span>
                      {r.details?.sender && <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sender: {r.details.sender}</span>}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{r.text}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-soft-sand block bg-slate-200/50 dark:bg-driftwood/10 border border-slate-300 dark:border-driftwood/20 px-2 py-1 rounded">Match: {Math.round(r.score * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CORE WORKSPACE GRID */}
      <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6 overflow-x-hidden items-stretch">

        {/* SIDEBAR NAVIGATION COMPONENT */}
        <section className={`shrink-0 transition-all duration-200 ${sidebarCollapsed ? 'w-full lg:w-14' : 'w-full lg:w-80'}`}>
          <div className="bg-white dark:bg-hub-card rounded-xl border border-slate-200 dark:border-hub-border p-3 flex flex-col gap-1 h-full sticky top-24 transition-colors">

            <div className={`flex items-center px-2 py-2 mb-1 border-b border-slate-100 dark:border-hub-border/60 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!sidebarCollapsed && <StartupHubLogo />}
              <button
                onClick={() => setSidebarCollapsed(prev => !prev)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-2 pt-1">
                <button onClick={() => { setSidebarCollapsed(false); setSectionOpen(prev => ({ ...prev, ideas: true })); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-hub-bg/60 text-amber-500 dark:text-amber-400" title="Ideas">
                  <Lightbulb className="h-4 w-4" />
                </button>
                <button onClick={() => { setSidebarCollapsed(false); setSectionOpen(prev => ({ ...prev, projects: true })); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-hub-bg/60 text-slate-600 dark:text-slate-400" title="Projects">
                  <Layers className="h-4 w-4" />
                </button>
                <button onClick={() => { setSidebarCollapsed(false); setSectionOpen(prev => ({ ...prev, tools: true })); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-hub-bg/60 text-slate-400 dark:text-slate-500" title="Tools">
                  <Activity className="h-4 w-4" />
                </button>
              </div>
            ) : (
            <>
              {/* IDEAS SECTION */}
              <div>
                <button
                  onClick={() => toggleSection('ideas')}
                  className="flex items-center gap-2 px-2 py-1.5 w-full text-left hover:bg-slate-100 dark:hover:bg-hub-bg/40 rounded-lg transition-colors"
                >
                  {sectionOpen.ideas ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ideas</span>
                  <span className="ml-auto text-[10px] bg-slate-100 dark:bg-hub-border text-slate-600 dark:text-slate-400 rounded-full px-1.5 py-0.5 font-mono">{ideas.filter((i: any) => i.status === 'inbox').length}</span>
                </button>
                {sectionOpen.ideas && (
                  ideas.filter((i: any) => i.status === 'inbox').length === 0
                    ? <p className="text-[11px] text-slate-400 dark:text-slate-600 px-7 py-1">No ideas yet — press Cmd+K</p>
                    : ideas.filter((i: any) => i.status === 'inbox').map((i: any) => (
                      <div key={i.id} className="px-7 py-1.5">
                        <div
                          onClick={() => { setActiveIdea(i); setActiveProject(null); setActiveTool(null); }}
                          className={`flex items-center justify-between rounded-lg group cursor-pointer transition-colors px-1 -mx-1 ${activeIdea?.id === i.id ? 'bg-slate-100 dark:bg-hub-bg' : 'hover:bg-slate-50 dark:hover:bg-hub-bg/60'}`}
                        >
                          <span className={`text-[12px] truncate flex-1 ${activeIdea?.id === i.id ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>{i.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenCommentIdeaId(openCommentIdeaId === i.id ? null : i.id); setCommentDraft(''); }}
                            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-glow-indigo transition-colors ml-2 shrink-0 relative"
                            title="Add comment"
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                            {(ideaComments[i.id]?.length || 0) > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-glow-indigo text-white rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">{ideaComments[i.id].length}</span>
                            )}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedIdeaForProj(i); setIsProjectModalOpen(true); }}
                            className="text-[10px] text-glow-indigo opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-2"
                          >
                            → Project
                          </button>
                        </div>
                        {i.description && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate pl-1 mt-0.5">{i.description}</p>
                        )}
                        {openCommentIdeaId === i.id && (
                          <div className="mt-1.5 pl-1 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {(ideaComments[i.id] || []).map((c, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-hub-bg/60 rounded px-2 py-1 border border-slate-100 dark:border-0">
                                <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-glow-indigo" />
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
                                className="flex-1 bg-slate-50 dark:bg-hub-bg text-[11px] text-slate-800 dark:text-slate-200 px-2 py-1 rounded border border-slate-200 dark:border-hub-border focus:outline-none focus:border-glow-indigo/60 focus:ring-1 focus:ring-glow-indigo/20 transition-all"
                              />
                              <button onClick={() => addIdeaComment(i.id)} className="text-[10px] font-bold text-slate-800 dark:text-slate-900 bg-slate-200 dark:bg-soft-sand hover:bg-slate-300 dark:hover:bg-slate-200 px-2 rounded transition-colors">Add</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-hub-border/40 my-1" />

              {/* PROJECTS SECTION */}
              <div>
                <button
                  onClick={() => toggleSection('projects')}
                  className="flex items-center gap-2 px-2 py-1.5 w-full text-left hover:bg-slate-100 dark:hover:bg-hub-bg/40 rounded-lg transition-colors"
                >
                  {sectionOpen.projects ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
                  <Layers className="h-3.5 w-3.5 text-glow-indigo" />
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Projects</span>
                  <span className="ml-auto text-[10px] bg-slate-100 dark:bg-hub-border text-slate-600 dark:text-slate-400 rounded-full px-1.5 py-0.5 font-mono">{projects.length}</span>
                </button>
                {sectionOpen.projects && (
                  projects.length === 0
                    ? <p className="text-[11px] text-slate-500 dark:text-slate-600 px-7 py-1">No projects loaded yet</p>
                    : projects.map((p: any) => {
                      const projTasks = tasks.filter((t: any) => t.project_id === p.id);
                      const done = projTasks.filter((t: any) => t.status === 'done').length;
                      const pct = projTasks.length > 0 ? Math.round((done / projTasks.length) * 100) : 0;
                      // Derive role: owner if you created it, else member
                      const isOwner = currentUser && (p.owner === currentUser.email || p.created_by === currentUser.id);
                      const roleLabel = isOwner ? 'owner' : 'member';
                      const roleCls = isOwner
                        ? 'bg-glow-indigo/10 text-glow-indigo border border-glow-indigo/20'
                        : 'bg-slate-100 dark:bg-hub-border text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-hub-border';
                      return (
                        <div
                          key={p.id}
                          onClick={() => { setActiveProject(p); setActiveTool(null); setActiveIdea(null); }}
                          className={`px-7 py-1.5 rounded-lg cursor-pointer transition-colors ${activeProject?.id === p.id ? 'bg-slate-100 dark:bg-hub-bg' : 'hover:bg-slate-50 dark:hover:bg-hub-bg/60'}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[12px] truncate flex-1 ${activeProject?.id === p.id ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>{p.title}</span>
                            {currentUser && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${roleCls}`}>{roleLabel}</span>}
                            <span className="text-[10px] text-slate-500 ml-1 shrink-0">{pct}%</span>
                          </div>
                          <div className="mt-1 h-0.5 bg-slate-200 dark:bg-hub-border rounded-full w-full">
                            <div className="h-0.5 bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-hub-border/40 my-1" />

              {/* TOOLS SECTION */}
              <div>
                <button
                  onClick={() => toggleSection('tools')}
                  className="flex items-center gap-2 px-2 py-1.5 w-full text-left hover:bg-slate-100 dark:hover:bg-hub-bg/40 rounded-lg transition-colors"
                >
                  {sectionOpen.tools ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
                  <Activity className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tools</span>
                </button>
                {sectionOpen.tools && ([
                  { label: 'Comms Hub',            key: 'comms',      icon: <MessageSquare className="h-3.5 w-3.5" /> },
                  { label: 'AI Daily Briefing',    key: 'briefing',   icon: <CheckSquare   className="h-3.5 w-3.5" /> },
                  { label: 'Meeting Transcribe',   key: 'meetings',   icon: <Mic           className="h-3.5 w-3.5" /> },
                  { label: 'Onboarding Generator', key: 'onboarding', icon: <FileDown      className="h-3.5 w-3.5" /> },
                  { label: 'Event Simulator',      key: 'simulator',  icon: <Activity      className="h-3.5 w-3.5" /> },
                ] as const).map(tool => (
                  <div
                    key={tool.key}
                    onClick={() => { setActiveTool(tool.key); setActiveProject(null); setActiveIdea(null); }}
                    className={`flex items-center gap-2 px-7 py-1.5 rounded-lg cursor-pointer transition-colors ${activeTool === tool.key ? 'bg-slate-100 dark:bg-hub-bg text-slate-900 dark:text-slate-200' : 'hover:bg-slate-50 dark:hover:bg-hub-bg/60 text-slate-500 dark:text-slate-400'}`}
                  >
                    <span className={activeTool === tool.key ? 'text-glow-indigo' : 'text-slate-400 dark:text-slate-500'}>{tool.icon}</span>
                    <span className="text-[12px]">{tool.label}</span>
                  </div>
                ))}
              </div>
            </>
            )}

          </div>
        </section>

        {/* CENTER FRAME INTERACTIVE CONTENT AREA */}
        <section className="flex-1 min-w-0">

          {activeTool === 'comms' && (
            <CommunicationHub
              messages={messages}
              decisions={decisions}
              actionItems={dashboardData?.actionItems || []}
              githubPrs={githubPrs}
              currentUser={currentUser}
            />
          )}

          {activeTool === 'briefing' && (
            <DailyBriefing workspaceId={DEFAULT_WORKSPACE} />
          )}

          {activeTool === 'onboarding' && (
            <div className="bg-white dark:bg-hub-card rounded-xl border border-slate-200 dark:border-hub-border p-5 transition-colors">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-400 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100 dark:border-b-hub-border/60 flex items-center space-x-2">
                <FileDown className="h-4 w-4 text-slate-500 dark:text-slate-400" /><span>Onboarding PDF Generator</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">Compile decisions, architecture constraints, and active project tasks into a formatted PDF brief for new hires.</p>
              <form onSubmit={handleGeneratePDF} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">New Hire Name</label>
                  <input type="text" placeholder="e.g. Jane Doe" value={pdfHireName} onChange={(e) => setPdfHireName(e.target.value)} className="w-full bg-slate-50 dark:bg-hub-bg text-xs text-slate-800 dark:text-slate-200 px-3 py-2 rounded border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-soft-sand" required />
                </div>
                <button type="submit" disabled={isPdfGenerating || !pdfHireName} className="w-full bg-slate-800 dark:bg-soft-sand hover:bg-slate-900 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5">
                  {isPdfGenerating ? <span>Generating PDF...</span> : <><FileDown className="h-4 w-4" /><span>Download Onboarding Brief</span></>}
                </button>
              </form>
            </div>
          )}

          {activeTool === 'meetings' && (
            <MeetingTranscription />
          )}

          {activeTool === 'simulator' && (
            <div className="bg-white dark:bg-hub-card rounded-xl border border-slate-200 dark:border-hub-border p-5 transition-colors">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-400 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100 dark:border-b-hub-border/60 flex items-center space-x-2">
                <Activity className="h-4 w-4 animate-pulse text-slate-500 dark:text-slate-400" /><span>Webhook Simulator</span>
              </h2>
              <div className="grid grid-cols-3 gap-1 mb-4 bg-slate-50 dark:bg-hub-bg p-1 rounded border border-slate-200 dark:border-hub-border">
                {(['slack', 'whatsapp', 'github'] as const).map(src => (
                  <button key={src} type="button" onClick={() => { setMockSource(src); setWebhookMessage(null); }}
                    className={`text-[10px] font-bold py-1 rounded transition-colors uppercase ${mockSource === src ? 'bg-slate-200 dark:bg-hub-border text-slate-800 dark:text-soft-sand' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                    {src}
                  </button>
                ))}
              </div>
              <form onSubmit={handleTriggerWebhook} className="space-y-3">
                {mockSource !== 'github' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">{mockSource === 'whatsapp' ? 'Phone Number (From)' : 'Sender Username'}</label>
                      <input type="text" value={mockSender} onChange={(e) => setMockSender(e.target.value)} className="w-full bg-slate-50 dark:bg-hub-bg text-xs text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded border border-slate-200 dark:border-hub-border focus:outline-none" required />
                    </div>
                    {mockSource === 'slack' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Slack Channel</label>
                        <input type="text" value={mockChannel} onChange={(e) => setMockChannel(e.target.value)} className="w-full bg-slate-50 dark:bg-hub-bg text-xs text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded border border-slate-200 dark:border-hub-border focus:outline-none" required />
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Message Content</label>
                      <textarea value={mockText} onChange={(e) => setMockText(e.target.value)} rows={4} placeholder="Enter chat dialogue..." className="w-full bg-slate-50 dark:bg-hub-bg text-xs text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded border border-slate-200 dark:border-hub-border focus:outline-none resize-none" required />
                    </div>
                  </>
                )}
                {mockSource === 'github' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">PR #</label>
                        <input type="number" value={mockGithubNum} onChange={(e) => setMockGithubNum(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-hub-bg text-xs text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded border border-slate-200 dark:border-hub-border focus:outline-none" required />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">PR Title</label>
                        <input type="text" value={mockGithubTitle} onChange={(e) => setMockGithubTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-hub-bg text-xs text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded border border-slate-200 dark:border-hub-border focus:outline-none" required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">PR Description</label>
                      <textarea value={mockGithubDesc} onChange={(e) => setMockGithubDesc(e.target.value)} rows={2} className="w-full bg-slate-50 dark:bg-hub-bg text-xs text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded border border-slate-200 dark:border-hub-border focus:outline-none resize-none" />
                    </div>
                  </div>
                )}
                {webhookMessage && <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-2 rounded">{webhookMessage}</div>}
                <button type="submit" disabled={isWebhookSending} className="w-full bg-slate-100 dark:bg-hub-border hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold py-2 rounded transition-colors flex items-center justify-center border border-slate-200 dark:border-0">
                  {isWebhookSending ? 'Sending...' : 'Simulate Event'}
                </button>
              </form>
            </div>
          )}

          {activeIdea && !activeTool && (
            <div className="bg-white dark:bg-hub-card rounded-xl border border-slate-200 dark:border-hub-border p-5 flex flex-col gap-4 transition-colors">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-b-hub-border/60">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-500/10 dark:bg-amber-400/15 rounded-lg border border-amber-300 dark:border-amber-400/30 text-amber-600 dark:text-amber-400 mt-0.5">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{activeIdea.title}</h2>
                    <p className="text-[11px] text-slate-400 dark:text-slate-400 uppercase tracking-wider font-bold">Idea Pane</p>
                  </div>
                </div>
                <button onClick={() => setActiveIdea(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-blue-tide uppercase tracking-wider mb-2">Description</h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-hub-bg/50 rounded-lg border border-slate-200 dark:border-hub-border/40 p-3 whitespace-pre-wrap">
                  {activeIdea.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-blue-tide uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" /> Similar Ideas
                </h3>
                <div className="flex flex-col gap-2 bg-slate-50 dark:bg-hub-bg/50 rounded-lg border border-slate-200 dark:border-hub-border/40 p-3">
                  {loadingSimilar && <p className="text-[11px] text-slate-500 dark:text-slate-600">Scanning for duplicates...</p>}
                  {!loadingSimilar && similarIdeas.length === 0 && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-600">No similar ideas found.</p>
                  )}
                  {similarIdeas.map((s) => (
                    <div key={s.id} className="flex items-start justify-between gap-3 bg-white dark:bg-hub-card/60 rounded-lg border border-slate-100 dark:border-hub-border/50 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{s.title}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${s.score >= 0.45 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-hub-border text-slate-600 dark:text-blue-tide'}`}>
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

              {/* RELATED MESSAGES — semantic links from Slack/WhatsApp */}
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-blue-tide uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquarePlus className="h-3.5 w-3.5" /> Origin Messages
                </h3>
                <div className="flex flex-col gap-2 bg-slate-50 dark:bg-hub-bg/50 rounded-lg border border-slate-200 dark:border-hub-border/40 p-3">
                  {loadingRelated && <p className="text-[11px] text-slate-400 dark:text-slate-600">Finding related messages...</p>}
                  {!loadingRelated && relatedMessages.length === 0 && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-600">No related messages found. Send Slack/WhatsApp messages via the simulator to auto-link.</p>
                  )}
                  {relatedMessages.map((m, i) => (
                    <div key={m.id || i} className="flex items-start gap-2.5 bg-white dark:bg-hub-card/60 rounded-lg border border-slate-100 dark:border-hub-border/50 px-3 py-2">
                      <div className="shrink-0 mt-0.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase border ${
                          m.source === 'slack'
                            ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40'
                            : m.source === 'whatsapp'
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40'
                            : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/40'
                        }`}>{m.source || 'msg'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{m.sender || 'Unknown'}</span>
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100 dark:bg-hub-border text-slate-500 dark:text-blue-tide shrink-0">{Math.round(m.score * 100)}% match</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">{m.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LINKED MEETINGS — semantic links from transcribed meeting notes */}
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-blue-tide uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5" /> Linked Meetings
                </h3>
                <div className="flex flex-col gap-2 bg-slate-50 dark:bg-hub-bg/50 rounded-lg border border-slate-200 dark:border-hub-border/40 p-3">
                  {loadingMeetings && <p className="text-[11px] text-slate-400 dark:text-slate-600">Finding related meetings...</p>}
                  {!loadingMeetings && relatedMeetings.length === 0 && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-600">No related meetings found. Record and analyze meetings to auto-link.</p>
                  )}
                  {relatedMeetings.map((m) => (
                    <div key={m.id} className="flex items-start gap-2.5 bg-white dark:bg-hub-card/60 rounded-lg border border-slate-100 dark:border-hub-border/50 px-3 py-2 cursor-pointer hover:border-glow-indigo/40" onClick={() => { setActiveTool('meetings'); setActiveIdea(null); }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{m.title}</span>
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100 dark:bg-hub-border text-slate-500 dark:text-blue-tide shrink-0">{Math.round(m.score * 100)}% match</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{new Date(m.created_at).toLocaleDateString()} • {Math.floor(m.duration_seconds / 60)}m</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-blue-tide uppercase tracking-wider mb-2">Comments</h3>
                <div className="flex flex-col gap-2 bg-slate-50 dark:bg-hub-bg/50 rounded-lg border border-slate-200 dark:border-hub-border/40 p-3">
                  {(ideaComments[activeIdea.id]?.length || 0) === 0 && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-600">No comments yet.</p>
                  )}
                  {(ideaComments[activeIdea.id] || []).map((c, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-hub-card/60 rounded px-2.5 py-1.5 border border-slate-100 dark:border-0 shadow-sm">
                      <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-glow-indigo" />
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
                      className="flex-1 bg-white dark:bg-hub-bg text-xs text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-glow-indigo/60 focus:ring-1 focus:ring-glow-indigo/20 transition-all"
                    />
                    <button
                      onClick={() => addIdeaDetailComment(activeIdea.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-900 bg-slate-200 dark:bg-soft-sand hover:bg-slate-300 dark:hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-amber-500/5 dark:bg-driftwood/10 border border-amber-500/20 dark:border-driftwood/25 p-3 rounded-lg">
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Ready to start building? Convert this idea into a project to generate tasks.
                </p>
                <button
                  onClick={() => { setSelectedIdeaForProj(activeIdea); setIsProjectModalOpen(true); }}
                  className="ml-3 shrink-0 px-3 py-2 bg-slate-800 dark:bg-soft-sand hover:bg-slate-900 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap"
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
              projects={activeProject ? [activeProject] : projects}
              users={workspaceUsers}
              currentUser={currentUser}
              onAddDeadlineClick={() => {
                const target = activeProject || (projects.length > 0 ? projects[0] : null);
                if (target) {
                  setActiveProject(target);
                  setProjOwner(target.owner || '');
                  setProjDeadline(target.deadline || '');
                  setProjTitle(target.title || '');
                  setProjDesc(target.description || '');
                }
                setSelectedIdeaForProj(null);
                setIsProjectModalOpen(true);
              }}
              onAddTaskClick={() => {
                const target = activeProject || (projects.length > 0 ? projects[0] : null);
                if (!target) {
                  pushToast('warning', 'No Project', 'Convert an idea to a project first before adding tasks.');
                  return;
                }
                setActiveProject(target);
                setIsTaskModalOpen(true);
              }}
              onDeleteProjectClick={handleDeleteProject}
            />
          )}

        </section>

      </main>

      {/* FOOTER ROW */}
      <footer className="border-t border-slate-200 dark:border-hub-border bg-white dark:bg-hub-bg py-4 px-6 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between transition-colors">
        <span>&copy; 2026 StartupHub Inc. Hackathon Release.</span>
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
        <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-hub-card border border-slate-200 dark:border-hub-border rounded-xl w-full max-w-md p-5 relative shadow-2xl transition-colors">
            <button onClick={() => setIsIdeaModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-100"><X className="h-5 w-5" /></button>
            <div className="flex items-center space-x-2 text-slate-800 dark:text-soft-sand mb-4">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <h3 className="text-md font-bold uppercase tracking-wider">Instant Idea Capture</h3>
            </div>
            <form onSubmit={handleCreateIdea} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Idea Title</label>
                <input type="text" placeholder="e.g. Realtime PDF Generator" value={newIdeaTitle} onChange={(e) => setNewIdeaTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-hub-bg text-sm text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-soft-sand" required autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Description</label>
                <textarea placeholder="Explain the problem it solves..." value={newIdeaDesc} onChange={(e) => setNewIdeaDesc(e.target.value)} rows={4} className="w-full bg-slate-50 dark:bg-hub-bg text-sm text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-soft-sand resize-none" required />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsIdeaModalOpen(false)} className="px-4 py-2 bg-slate-50 dark:bg-hub-bg hover:bg-slate-100 dark:hover:bg-hub-border text-slate-500 dark:text-slate-400 text-xs font-bold rounded-lg border border-slate-200 dark:border-hub-border">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-800 dark:bg-soft-sand hover:bg-slate-900 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-colors shadow-sm">Save Idea</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INTERACTIVE CALENDAR TARGET MATRIX */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-hub-card border border-slate-200 dark:border-hub-border rounded-xl w-full max-w-md p-5 relative shadow-2xl transition-colors">
            <button onClick={() => setIsProjectModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-100"><X className="h-5 w-5" /></button>
            <div className="flex items-center space-x-2 text-slate-800 dark:text-soft-sand mb-3">
              <Layers className="h-5 w-5 text-blue-500 dark:text-amber-400" />
              <h3 className="text-md font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Configure Target Parameters</h3>
            </div>
            
            {selectedIdeaForProj && (
              <div className="bg-slate-50 dark:bg-hub-bg p-3 rounded-lg border border-slate-100 dark:border-hub-border/50 text-xs mb-4">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">{selectedIdeaForProj.title}</h4>
                <p className="text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{selectedIdeaForProj.description}</p>
              </div>
            )}

            <form onSubmit={selectedIdeaForProj ? handleConvertProject : handleSaveDeadlineUpdate} className="space-y-4">
              {!selectedIdeaForProj && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Project Title</label>
                    <input
                      type="text"
                      value={projTitle}
                      onChange={(e) => setProjTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-hub-bg text-sm text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-glow-indigo/60"
                      required
                      placeholder="Project Title"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Project Description</label>
                    <textarea
                      value={projDesc}
                      onChange={(e) => setProjDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-hub-bg text-sm text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-glow-indigo/60 animate-fadeIn"
                      required
                      placeholder="Project Description"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Project Owner</label>
                <select
                  value={projOwner}
                  onChange={(e) => setProjOwner(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-hub-bg text-sm text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-glow-indigo/60"
                  required
                >
                  <option value="">Select Owner</option>
                  {workspaceUsers.map((u: any) => (
                    <option key={u.id} value={u.email}>{u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Target Calendar Deadline</label>
                <input 
                  type="date" 
                  value={projDeadline} 
                  onChange={(e) => setProjDeadline(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-hub-bg text-sm text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-glow-indigo/60 font-mono" 
                  required 
                />
              </div>
              <div className="bg-slate-50 dark:bg-driftwood/10 border border-slate-200 dark:border-driftwood/25 p-3 rounded text-[11px] text-slate-600 dark:text-slate-300">
                <HelpCircle className="h-4 w-4 inline mr-1 text-slate-400 dark:text-soft-sand align-text-bottom" />
                Updating changes the live workspace matrix. Subtask deadline intervals adjust automatically.
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 bg-slate-50 dark:bg-hub-bg hover:bg-slate-100 dark:hover:bg-hub-border text-slate-500 dark:text-slate-400 text-xs font-bold rounded-lg border border-slate-200 dark:border-hub-border">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-800 dark:bg-glow-indigo text-white dark:text-slate-950 text-xs font-bold rounded-lg hover:bg-slate-900 dark:hover:bg-slate-200 transition-colors shadow-sm">Apply Matrix Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TASK CREATION */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-hub-card border border-slate-200 dark:border-hub-border rounded-xl w-full max-w-md p-5 relative shadow-2xl transition-colors">
            <button onClick={() => setIsTaskModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-100"><X className="h-5 w-5" /></button>
            <div className="flex items-center space-x-2 text-slate-800 dark:text-soft-sand mb-4">
              <CheckSquare className="h-5 w-5 text-blue-500" />
              <h3 className="text-md font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Create New Task</h3>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Implement refresh-token rotation"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-hub-bg text-sm text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-glow-indigo/60"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Assignee</label>
                <select
                  value={newTaskAssignedTo}
                  onChange={(e) => setNewTaskAssignedTo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-hub-bg text-sm text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border focus:outline-none focus:border-slate-400 dark:focus:border-glow-indigo/60"
                >
                  <option value="">Unassigned</option>
                  {workspaceUsers.map((u: any) => (
                    <option key={u.id} value={u.email}>{u.email}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 bg-slate-50 dark:bg-hub-bg hover:bg-slate-100 dark:hover:bg-hub-border text-slate-500 dark:text-slate-400 text-xs font-bold rounded-lg border border-slate-200 dark:border-hub-border">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-800 dark:bg-glow-indigo text-white dark:text-slate-950 text-xs font-bold rounded-lg hover:bg-slate-900 dark:hover:bg-slate-200 transition-colors shadow-sm">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
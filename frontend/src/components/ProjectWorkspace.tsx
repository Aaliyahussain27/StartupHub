import { useState } from 'react';
import { 
  Folder, Plus, Sparkles, AlertTriangle, Check, ListChecks, Lock, 
  Clock, CheckCircle, Circle, Ban, X, ChevronDown, ChevronRight, MessageSquare 
} from 'lucide-react';
import { api } from '../services/api';

interface Comment {
  initials: string;
  author: string;
  time: string;
  text: string;
  color?: string;
}

interface SubTask {
  id: string;
  title: string;
  isDone: boolean;
}

interface DetailItem {
  id: string;
  icon: 'blocker' | 'decision' | 'done' | 'inprogress' | 'blocked' | 'todo';
  title: string;
  meta: string;
  body: string;
  status: string;
  statusType: 'warn' | 'info' | 'ok' | 'danger' | 'muted';
  assignedTo?: string;
  rootCause?: string;     
  resolution?: string;    
  subtasks?: SubTask[];   
  comments: Comment[];
}

interface ModalData {
  label: string;
  items: DetailItem[];
}

const PILL: Record<string, string> = {
  warn:   'bg-amber-900/30 text-amber-400',
  info:   'bg-blue-900/30 text-blue-400',
  ok:     'bg-emerald-900/30 text-emerald-400',
  danger: 'bg-rose-900/30 text-rose-400',
  muted:  'bg-slate-800 text-slate-400',
};

function ItemIcon({ icon }: { icon: DetailItem['icon'] }) {
  if (icon === 'blocker')    return <Lock    className="h-4 w-4 text-amber-400 shrink-0" />;
  if (icon === 'decision')   return <Check   className="h-4 w-4 text-blue-400 shrink-0" />;
  if (icon === 'done')       return <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (icon === 'inprogress') return <Clock   className="h-4 w-4 text-blue-400 shrink-0" />;
  if (icon === 'blocked')    return <Ban     className="h-4 w-4 text-rose-400 shrink-0" />;
  return                            <Circle  className="h-4 w-4 text-slate-500 shrink-0" />;
}

interface ProjectWorkspaceProps {
  decisions?: any[];
  blockers?: any[];
  tasks?: any[];
  projects?: any[];
  users?: any[];
  currentUser?: any;
  onAddDeadlineClick?: () => void;
  onAddTaskClick?: () => void;
}

export function ProjectWorkspace({ 
  decisions = [], 
  blockers = [], 
  tasks = [], 
  projects = [],
  currentUser,
  onAddDeadlineClick,
  onAddTaskClick 
}: ProjectWorkspaceProps) {
  const [modal, setModal] = useState<string | null>(null);
  const [localDeadline, setLocalDeadline] = useState<string>('');
  const [deadlineEditing, setDeadlineEditing] = useState(false);
  
  // Workspace UI collapse & comment state management dictionaries
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [activeCommentBox, setActiveCommentBox] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const toggleItemExpansion = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCommentBox = (id: string) => {
    setActiveCommentBox(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getDaysActive = (dateString?: string) => {
    if (!dateString) return 4; 
    const start = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const projectInstance = projects[0] || { id: 'p1', title: 'StartupHub Core', status: 'active', activeSince: '2026-06-10', deadline: '', owner: 'Ovee' };
  
  // Sync deadline from project data on first load
  useState(() => { if (projectInstance.deadline && !localDeadline) setLocalDeadline(projectInstance.deadline); });

  // Dynamically build blockers, decisions, and tasks list mapping to DetailItem schema
  const activeBlockersList: DetailItem[] = blockers.map((b: any, index: number) => {
    const taskObj = tasks.find(t => t.id === b.taskId);
    return {
      id: b.taskId || `block-${index}`,
      icon: 'blocker',
      title: taskObj ? `Task Blocked: ${taskObj.title}` : 'Dependency Blocker',
      meta: taskObj ? `Assigned to ${taskObj.assigned_to} · Flagged ${new Date(taskObj.updated_at || Date.now()).toLocaleDateString()}` : 'System detected blocker',
      body: b.reason || 'Circular dependency or missing requirements preventing progress.',
      status: 'blocked',
      statusType: 'warn',
      assignedTo: taskObj ? taskObj.assigned_to : 'Unassigned',
      rootCause: b.reason,
      resolution: 'Resolve the blocked dependencies or cycle to continue.',
      comments: []
    };
  });

  const activeDecisionsList: DetailItem[] = decisions.map((d: any, index: number) => {
    return {
      id: d.id || `dec-${index}`,
      icon: 'decision',
      title: d.decision_text || 'Decision Logged',
      meta: `Logged on ${new Date(d.created_at || Date.now()).toLocaleDateString()}`,
      body: 'This decision was programmatically extracted from team communications.',
      status: 'decided',
      statusType: 'info',
      comments: []
    };
  });

  const activeTasksList: DetailItem[] = tasks.map((t: any) => {
    let statusType: DetailItem['statusType'] = 'muted';
    let icon: DetailItem['icon'] = 'todo';
    if (t.status === 'done') {
      statusType = 'ok';
      icon = 'done';
    } else if (t.status === 'in_progress') {
      statusType = 'info';
      icon = 'inprogress';
    } else if (t.status === 'blocked') {
      statusType = 'danger';
      icon = 'blocked';
    }
    
    const depsText = (t.dependencies && t.dependencies.length > 0)
      ? 'Blocked by: ' + t.dependencies.map((dId: string) => {
          const depTask = tasks.find(tsk => tsk.id === dId);
          return depTask ? `"${depTask.title}"` : dId;
        }).join(', ')
      : `Assigned to ${t.assigned_to}`;

    return {
      id: t.id,
      icon,
      title: t.title,
      meta: depsText,
      body: `Status: ${t.status}. Last updated: ${new Date(t.updated_at || Date.now()).toLocaleString()}`,
      status: t.status,
      statusType,
      assignedTo: t.assigned_to,
      subtasks: [],
      comments: []
    };
  });

  const dynamicModals: Record<string, ModalData> = {
    blockers: {
      label: 'Blockers',
      items: activeBlockersList
    },
    decisions: {
      label: 'Decisions',
      items: activeDecisionsList
    },
    tasks: {
      label: 'Active tasks',
      items: activeTasksList
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <Folder className="h-4 w-4 text-glow-indigo" />
          {projectInstance.title}
          <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">/ Project Workspace</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onAddTaskClick} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all font-semibold">
            <Plus className="h-3.5 w-3.5 text-glow-indigo" /> Add Task
          </button>
          <button
            onClick={() => setModal('ai')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-glow-indigo/45 rounded-lg text-glow-indigo hover:bg-glow-indigo/10 transition-all font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5 text-neon-violet animate-pulse" /> AI Summary
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3.5">
          
          {/* Status Metric Box */}
          <div className="bg-white/85 dark:bg-hub-card/45 border border-slate-200/80 dark:border-hub-border/60 rounded-2xl p-4 shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-cyber-emerald/40 hover:shadow-lg hover:shadow-cyber-emerald/5 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyber-emerald/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">Status</p>
            <p className="text-sm font-bold text-cyber-emerald capitalize flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyber-emerald shadow-sm shadow-cyber-emerald animate-pulse"></span>
              {projectInstance.status || 'Active'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              since {getDaysActive(projectInstance.activeSince)} day{getDaysActive(projectInstance.activeSince) !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Progress Box */}
          <div className="bg-white/85 dark:bg-hub-card/45 border border-slate-200/80 dark:border-hub-border/60 rounded-2xl p-4 shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-glow-indigo/40 hover:shadow-lg hover:shadow-glow-indigo/5 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-glow-indigo/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">Progress</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {tasks.length > 0 ? `${Math.round((tasks.filter((t: any) => t.status === 'done').length / tasks.length) * 100)}%` : '0%'}
            </p>
            <div className="mt-2.5 h-1.5 bg-slate-100 dark:bg-[#070a13] rounded-full overflow-hidden border border-slate-200/40 dark:border-hub-border/30">
              <div className="h-1.5 bg-gradient-to-r from-glow-indigo to-cyber-cyan rounded-full transition-all" style={{ width: tasks.length > 0 ? `${Math.round((tasks.filter((t: any) => t.status === 'done').length / tasks.length) * 100)}%` : '0%' }} />
            </div>
          </div>

          {/* Deadline Card */}
          <div className="bg-white/85 dark:bg-hub-card/45 border border-slate-200/80 dark:border-hub-border/60 rounded-2xl p-4 shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Deadline</p>
              <button
                onClick={onAddDeadlineClick}
                className="text-[10px] text-glow-indigo hover:text-indigo-400 font-semibold transition-colors"
              >
                {localDeadline ? 'Edit' : 'Set date'}
              </button>
            </div>
            {deadlineEditing ? (
              <input
                type="date"
                autoFocus
                defaultValue={localDeadline}
                onBlur={async (e) => { 
                  setLocalDeadline(e.target.value); 
                  setDeadlineEditing(false);
                  try {
                    await api.updateProjectSettings(projectInstance.id, { deadline: e.target.value }, '00000000-0000-0000-0000-000000000000');
                  } catch (err: any) {
                    alert(err.message || 'Failed to update project settings');
                  }
                }}
                onChange={(e) => setLocalDeadline(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950/80 text-xs text-slate-800 dark:text-slate-200 px-2 py-1 rounded border border-slate-200 dark:border-hub-border focus:outline-none focus:border-glow-indigo/50 mt-1"
              />
            ) : localDeadline ? (
              <>
                <p className="text-sm font-bold text-amber-500 dark:text-amber-400">
                  {new Date(localDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal ml-1">
                    {new Date(localDeadline).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </p>
                <p className="text-[11px] mt-1">
                  {(() => {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const dl = new Date(localDeadline); dl.setHours(0,0,0,0);
                    const diff = Math.ceil((dl.getTime() - today.getTime()) / (1000*60*60*24));
                    if (diff < 0) return <span className="text-rose-500 font-semibold">{Math.abs(diff)} days overdue</span>;
                    if (diff === 0) return <span className="text-amber-500 font-semibold">Due today</span>;
                    return <span className="text-slate-500 dark:text-slate-400">{diff} days left</span>;
                  })()}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No deadline set</p>
            )}
          </div>

          {/* Owner Box */}
          <div className="bg-white/85 dark:bg-hub-card/45 border border-slate-200/80 dark:border-hub-border/60 rounded-2xl p-4 shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-neon-violet/40 hover:shadow-lg hover:shadow-neon-violet/5 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-neon-violet/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">Owner</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{projectInstance.owner || 'Ovee'}</p>
          </div>
        </div>

        {/* Dashboard Widgets Row */}
        <div className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => setModal('blockers')} 
            className="bg-white/80 dark:bg-hub-card/45 backdrop-blur-md border border-slate-200/80 dark:border-hub-border/60 rounded-2xl p-5 cursor-pointer shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5 transition-all duration-300 relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100 dark:border-hub-border/30 relative z-10">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 animate-pulse" /> Blockers
              </div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 group-hover:text-glow-indigo transition-colors">click to expand</span>
            </div>
            <div className="space-y-2 relative z-10">
              {activeBlockersList.slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl border border-slate-100/40 dark:border-hub-border/30 bg-slate-50/50 dark:bg-[#070a13]/30 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-hub-bg/40 transition-all duration-200">
                  <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="flex-1 truncate font-medium">{item.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-950/35 text-amber-600 dark:text-amber-400 font-bold border border-amber-200/40 dark:border-amber-900/30">blocked</span>
                </div>
              ))}
              {activeBlockersList.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center italic">No active blockers flagged.</p>
              )}
            </div>
          </div>

          <div 
            onClick={() => setModal('decisions')} 
            className="bg-white/80 dark:bg-hub-card/45 backdrop-blur-md border border-slate-200/80 dark:border-hub-border/60 rounded-2xl p-5 cursor-pointer shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-glow-indigo/40 hover:shadow-lg hover:shadow-glow-indigo/5 hover:-translate-y-0.5 transition-all duration-300 relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-glow-indigo/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100 dark:border-hub-border/30 relative z-10">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <Check className="h-4 w-4 text-glow-indigo" /> Decisions
              </div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 group-hover:text-glow-indigo transition-colors">click to expand</span>
            </div>
            <div className="space-y-2 relative z-10">
              {activeDecisionsList.slice(0, 3).map((d, i) => (
                <div key={i} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl border border-slate-100/40 dark:border-hub-border/30 bg-slate-50/50 dark:bg-[#070a13]/30 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-hub-bg/40 transition-all duration-200">
                  <Check className="h-3.5 w-3.5 text-glow-indigo shrink-0" />
                  <span className="flex-1 truncate font-medium">{d.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100/80 dark:bg-indigo-950/35 text-glow-indigo dark:text-indigo-400 font-bold border border-indigo-200/40 dark:border-indigo-900/30">decided</span>
                </div>
              ))}
              {activeDecisionsList.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center italic">No decisions logged yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Active Tasks Target Box Row */}
        <div 
          onClick={() => setModal('tasks')} 
          className="bg-white/80 dark:bg-hub-card/45 backdrop-blur-md border border-slate-200/80 dark:border-hub-border/60 rounded-2xl p-5 cursor-pointer shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-cyber-cyan/40 hover:shadow-lg hover:shadow-cyber-cyan/5 hover:-translate-y-0.5 transition-all duration-300 relative group overflow-hidden mt-4"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyber-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100 dark:border-hub-border/30 relative z-10">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <ListChecks className="h-4 w-4 text-cyber-cyan" /> Active Tasks Panel
            </div>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 group-hover:text-glow-indigo transition-colors">click to expand</span>
          </div>
          <div className="space-y-2 relative z-10">
            {activeTasksList.slice(0, 5).map((t, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl border border-slate-100/40 dark:border-hub-border/30 bg-slate-50/50 dark:bg-[#070a13]/30 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-hub-bg/40 transition-all duration-200">
                <ItemIcon icon={t.icon} />
                <span className="flex-1 truncate font-medium">{t.title}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-200/40 dark:border-slate-800/40 ${PILL[t.statusType]}`}>{t.status}</span>
              </div>
            ))}
            {activeTasksList.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center italic">No active tasks in this project.</p>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Modal Interactive Slider Overlay Drawer */}
      {modal && modal !== 'ai' && (
        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md flex items-end justify-center z-50 rounded-2xl p-0 transition-opacity duration-300" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800/80 rounded-t-3xl w-full max-h-[85%] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
            
            {/* Modal Header Controls Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
              <div>
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-widest">{dynamicModals[modal]?.label || modal}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Toggle rows below to audit structural components, assignees, and details</p>
              </div>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Task View Utility Headers */}
            {modal === 'tasks' && (
              <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-950/45 border-b border-slate-100 dark:border-slate-800/45 flex items-center justify-between shrink-0">
                <span className="text-[10px] text-glow-indigo font-bold tracking-wider uppercase">Operational Roadmap Matrix</span>
                <button onClick={() => { setModal(null); onAddTaskClick?.(); }} className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 bg-glow-indigo hover:bg-glow-indigo/90 text-white font-bold rounded-lg transition-all shadow-md shadow-glow-indigo/10 active:scale-95">
                  <Plus className="h-3 w-3" /> Add Task
                </button>
              </div>
            )}

            {/* Render Context List Loop Elements */}
            <div className="overflow-y-auto p-6 flex flex-col gap-4">
              {(dynamicModals[modal]?.items || []).map((item) => {
                const isExpanded = !!expandedItems[item.id];
                const showCommentField = !!activeCommentBox[item.id];

                return (
                  <div key={item.id} className="border border-slate-200 dark:border-slate-800/60 rounded-2xl bg-white/40 dark:bg-slate-950/20 hover:border-slate-300 dark:hover:border-slate-700/60 transition-all duration-200">
                    
                    {/* Primary Clickable Header Interaction Zone */}
                    <div className="p-4 flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleItemExpansion(item.id)}>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                      <ItemIcon icon={item.icon} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.title}</p>
                        {item.assignedTo && <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">Assigned to: <span className="text-slate-600 dark:text-slate-400 font-semibold">{item.assignedTo}</span></p>}
                      </div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-slate-200/40 dark:border-slate-800/40 ${PILL[item.statusType]}`}>{item.status}</span>
                    </div>

                    {/* Interactive Substructure Extension Dropdown View */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800/35 bg-slate-50/40 dark:bg-slate-950/20 text-xs text-slate-600 dark:text-slate-400 space-y-4 rounded-b-2xl">
                        <p className="leading-relaxed text-slate-700 dark:text-slate-400 font-sans mt-2">{item.body}</p>

                        {/* Blocker Causation & Resolution Blocks */}
                        {modal === 'blockers' && (item.rootCause || item.resolution) && (
                          <div className="p-4 bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/40 dark:border-amber-900/30 rounded-xl flex flex-col gap-3 text-[11px]">
                            {item.rootCause && (
                              <p><span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5 uppercase tracking-wide">⚠️ Cause of Block:</span> <span className="text-slate-700 dark:text-slate-300">{item.rootCause}</span></p>
                            )}
                            {item.resolution && (
                              <p className="pt-3 border-t border-amber-200/20 dark:border-amber-900/10"><span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5 uppercase tracking-wide">⚡ Target Resolution Parameters:</span> <span className="text-slate-700 dark:text-slate-300">{item.resolution}</span></p>
                            )}
                          </div>
                        )}

                        {/* Task Status controls */}
                        {modal === 'tasks' && (
                          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/40">
                            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Update Status:</span>
                            <select
                              value={item.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                try {
                                  await api.updateTaskStatus(item.id, newStatus, '00000000-0000-0000-0000-000000000000');
                                } catch (err: any) {
                                  alert(err.message || 'Failed to update task status');
                                }
                              }}
                              className="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] px-2.5 py-1.5 focus:outline-none focus:border-glow-indigo/50 transition-colors"
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="blocked">Blocked</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                        )}

                        {/* Context-Aware Comment Button Toggle Segment Container */}
                        <div className="flex flex-col gap-2 pt-2">
                          {!showCommentField ? (
                            <div className="flex justify-end">
                              <button onClick={() => toggleCommentBox(item.id)} className="flex items-center gap-1.5 text-[10px] text-glow-indigo font-bold hover:text-indigo-400 transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/30">
                                <MessageSquare className="h-3 w-3" /> Add Comment
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 items-center bg-white dark:bg-slate-950/70 p-2 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-inner">
                              <input
                                type="text"
                                placeholder="Write comment content details..."
                                value={commentInputs[item.id] || ''}
                                onChange={(e) => setCommentInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200 px-2.5 py-1.5 outline-none placeholder-slate-400 dark:placeholder-slate-600"
                              />
                              <button onClick={() => toggleCommentBox(item.id)} className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 px-2 font-semibold transition-colors">Cancel</button>
                              <button 
                                onClick={() => {
                                  if ((commentInputs[item.id] || '').trim()) {
                                    item.comments.push({
                                      initials: currentUser ? currentUser.email.slice(0, 2).toUpperCase() : 'OV',
                                      author: currentUser ? currentUser.email : 'Ovee',
                                      time: 'Just Now',
                                      text: commentInputs[item.id]
                                    });
                                    setCommentInputs(prev => ({ ...prev, [item.id]: '' }));
                                    toggleCommentBox(item.id);
                                  }
                                }} 
                                className="text-[10px] bg-glow-indigo hover:bg-glow-indigo/90 text-white px-3.5 py-1.5 rounded-lg font-bold shadow-md shadow-glow-indigo/10 active:scale-95 transition-all"
                              >
                                Send
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Basic Fallback Handler for AI Modal Frame elements */}
      {modal === 'ai' && (
        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md flex items-end justify-center z-50 rounded-2xl p-0" onClick={() => setModal(null)}>
          <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800/80 p-6 rounded-t-3xl w-full text-xs text-slate-600 dark:text-slate-400 space-y-3 shadow-2xl overflow-hidden animate-slideUp">
            <div className="flex justify-between items-center font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-widest pb-2 border-b border-slate-100 dark:border-slate-800/50">
              <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-glow-indigo" /> AI Metrics Monitor Summary</span>
              <X className="h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => setModal(null)} />
            </div>
            <p className="text-slate-700 dark:text-slate-400 leading-relaxed font-sans">• Systems structural analysis arrays reporting active green status targets.</p>
          </div>
        </div>
      )}
    </div>
  );
}
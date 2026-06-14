import { useState } from 'react';
import { 
  Folder, Plus, Sparkles, AlertTriangle, Check, ListChecks, Lock, 
  Clock, CheckCircle, Circle, Ban, X, ChevronDown, ChevronRight, MessageSquare 
} from 'lucide-react';

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

const MODALS: Record<string, ModalData> = {
  blockers: {
    label: 'Blockers',
    items: [
      {
        id: 'b1', icon: 'blocker', title: 'API auth not resolved', meta: 'Assigned to Arjun · Flagged Jun 9',
        body: 'The OAuth2 token exchange with the Slack API is failing intermittently.',
        status: 'blocked', statusType: 'warn', assignedTo: 'Arjun',
        rootCause: 'Missing refresh-token rotation handler inside the local token store; configurations reset on server restart.',
        resolution: 'Persist refresh tokens securely via PostgreSQL database layer and refresh server storage hooks.',
        comments: [
          { initials: 'AR', author: 'Arjun', time: 'Jun 9, 4:12 PM', text: 'Traced it to the token store — refresh tokens aren\'t being persisted between restarts. Will fix in next PR.' }
        ],
      },
      {
        id: 'b2', icon: 'blocker', title: 'Design sign-off pending', meta: 'Assigned to Meera · Flagged Jun 11',
        body: 'The project dashboard UI needs sign-off from the design lead before frontend tasks can proceed.',
        status: 'blocked', statusType: 'warn', assignedTo: 'Meera',
        rootCause: 'Figma mockups are awaiting architectural layout approval from executive leadership teams.',
        resolution: 'Escalate to an async Loom walkthrough sequence directly broadcasted to client communication channels by EOD.',
        comments: [],
      }
    ],
  },
  decisions: {
    label: 'Decisions',
    items: [
      {
        id: 'd1', icon: 'decision', title: 'Use PostgreSQL for graph store', meta: 'Decided by Arjun · Jun 6',
        body: 'Evaluated Neo4j and PostgreSQL with recursive CTEs. PostgreSQL chosen to keep infrastructure simple.',
        status: 'decided', statusType: 'info',
        comments: []
      }
    ],
  },
  tasks: {
    label: 'Active tasks',
    items: [
      {
        id: 't1', icon: 'inprogress', title: 'Build dependency graph engine', meta: 'Assigned to Arjun · Started Jun 10',
        body: 'DFS cycle detection written and tested. Topological sort and blocker cascade propagation in review.',
        status: 'in progress', statusType: 'info', assignedTo: 'Arjun',
        subtasks: [
          { id: 'st1', title: 'Implement core DFS cycle detection matrix logic', isDone: true },
          { id: 'st2', title: 'Write structured unit tests for recursive cascade propagation loops', isDone: false },
          { id: 'st3', title: 'Expose live backend topological sort objects directly to React state handlers', isDone: false }
        ],
        comments: []
      },
      {
        id: 't2', icon: 'blocked', title: 'Integrate Slack webhooks', meta: 'Assigned to Meera · Blocked by: API auth',
        body: 'Blocked on local API authorization layer. Cannot proceed until upstream token exchange engine acts functional.',
        status: 'blocked', statusType: 'danger', assignedTo: 'Meera',
        subtasks: [
          { id: 'st4', title: 'Configure secure payload router endpoint parameters', isDone: true },
          { id: 'st5', title: 'Map payload parsing properties schemas securely', isDone: false }
        ],
        comments: []
      }
    ],
  },
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
  onAddDeadlineClick?: () => void;
  onAddTaskClick?: () => void;
}

export function ProjectWorkspace({ 
  decisions = [], 
  blockers = [], 
  tasks = [], 
  projects = [],
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

  const getDaysRemaining = (deadlineDateStr?: string) => {
    if (!deadlineDateStr || deadlineDateStr.toLowerCase() === 'friday') {
      return { text: 'Friday', subtitle: 'Stays until deadline target dates set' };
    }
    const target = new Date(deadlineDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Overdue', subtitle: `${Math.abs(diffDays)} days past set target` };
    if (diffDays === 0) return { text: 'Due Today', subtitle: 'Stays until deadline sequence expires' };
    return { text: `${diffDays} days left`, subtitle: 'stays until deadline' };
  };

  const projectInstance = projects[0] || { title: 'StartupHub Core', status: 'active', activeSince: '2026-06-10', deadline: '' };
  // Sync deadline from project data on first load
  useState(() => { if (projectInstance.deadline && !localDeadline) setLocalDeadline(projectInstance.deadline); });
  const deadlineMetrics = getDaysRemaining(projectInstance.deadline);

  return (
    <div className="flex flex-col h-full bg-hub-bg relative">

      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-hub-border bg-hub-card">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Folder className="h-4 w-4 text-slate-400" />
          {projectInstance.title}
          <span className="text-slate-600 font-normal text-xs">/ Project workspace</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onAddTaskClick} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-hub-border rounded-lg text-slate-400 hover:bg-white/5">
            <Plus className="h-3.5 w-3.5" /> Add task
          </button>
          <button
            onClick={() => setModal('ai')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-blue-500/40 rounded-lg text-blue-400 hover:bg-blue-900/20"
          >
            <Sparkles className="h-3.5 w-3.5" /> AI summary
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          
          {/* Status Metric Box */}
          <div className="bg-hub-card border border-hub-border rounded-xl p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Status</p>
            <p className="text-sm font-medium text-emerald-400 capitalize">{projectInstance.status || 'Active'}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              since {getDaysActive(projectInstance.activeSince)} day{getDaysActive(projectInstance.activeSince) !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Progress Box */}
          <div className="bg-hub-card border border-hub-border rounded-xl p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Progress</p>
            <p className="text-sm font-medium text-slate-200">
              {tasks.length > 0 ? `${Math.round((tasks.filter((t: any) => t.status === 'done').length / tasks.length) * 100)}%` : '0%'}
            </p>
            <div className="mt-2 h-1 bg-white/10 rounded-full">
              <div className="h-1 bg-emerald-500 rounded-full" style={{ width: tasks.length > 0 ? `${Math.round((tasks.filter((t: any) => t.status === 'done').length / tasks.length) * 100)}%` : '0%' }} />
            </div>
          </div>

          {/* Deadline Card */}
          <div className="bg-hub-card border border-hub-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Deadline</p>
              <button
                onClick={() => setDeadlineEditing(true)}
                className="text-[9px] text-blue-tide hover:text-blue-300 underline"
              >
                {localDeadline ? 'Edit' : 'Set date'}
              </button>
            </div>
            {deadlineEditing ? (
              <input
                type="date"
                autoFocus
                defaultValue={localDeadline}
                onBlur={(e) => { setLocalDeadline(e.target.value); setDeadlineEditing(false); }}
                onChange={(e) => setLocalDeadline(e.target.value)}
                className="w-full bg-hub-bg text-xs text-slate-200 px-2 py-1 rounded border border-hub-border focus:outline-none focus:border-amber-500/50 mt-1"
              />
            ) : localDeadline ? (
              <>
                <p className="text-sm font-medium text-amber-400">
                  {new Date(localDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  <span className="text-[10px] text-slate-500 ml-1">
                    {new Date(localDeadline).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </p>
                <p className="text-[11px] mt-0.5">
                  {(() => {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const dl = new Date(localDeadline); dl.setHours(0,0,0,0);
                    const diff = Math.ceil((dl.getTime() - today.getTime()) / (1000*60*60*24));
                    if (diff < 0) return <span className="text-rose-400">{Math.abs(diff)} days overdue</span>;
                    if (diff === 0) return <span className="text-amber-400">Due today</span>;
                    return <span className="text-slate-400">{diff} days left</span>;
                  })()}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-600 mt-1">No deadline set</p>
            )}
          </div>

          {/* Owner Box */}
          <div className="bg-hub-card border border-hub-border rounded-xl p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Owners</p>
            <p className="text-sm font-medium text-slate-200">{projectInstance.owner || 'Ovee'}</p>
          </div>
        </div>

        {/* Dashboard Widgets Row */}
        <div className="grid grid-cols-2 gap-4">
          <div onClick={() => setModal('blockers')} className="bg-hub-card border border-hub-border rounded-xl p-4 cursor-pointer hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Blockers
              </div>
              <span className="text-[10px] text-slate-600">click to expand</span>
            </div>
            {MODALS.blockers.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-t border-white/5 first:border-0 text-xs text-slate-300">
                <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400">blocked</span>
              </div>
            ))}
          </div>

          <div onClick={() => setModal('decisions')} className="bg-hub-card border border-hub-border rounded-xl p-4 cursor-pointer hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                <Check className="h-3.5 w-3.5 text-blue-400" /> Decisions
              </div>
              <span className="text-[10px] text-slate-600">click to expand</span>
            </div>
            {MODALS.decisions.items.map((d, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-t border-white/5 first:border-0 text-xs text-slate-300">
                <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="flex-1 truncate">{d.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">decided</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Tasks Target Box Row */}
        <div onClick={() => setModal('tasks')} className="bg-hub-card border border-hub-border rounded-xl p-4 cursor-pointer hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wide">
              <ListChecks className="h-3.5 w-3.5" /> Active Tasks Panel
            </div>
            <span className="text-[10px] text-slate-600">click to expand</span>
          </div>
          {MODALS.tasks.items.map((t, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-t border-white/5 first:border-0 text-xs text-slate-300">
              <Ban className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              <span className="flex-1 truncate">{t.title}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">{t.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded Modal Interactive Slider Overlay Drawer */}
      {modal && modal !== 'ai' && (
        <div className="absolute inset-0 bg-black/60 flex items-end z-50 rounded-xl" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-hub-card border-t border-hub-border rounded-t-xl w-full max-h-[85%] flex flex-col">
            
            {/* Modal Header Controls Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-hub-border shrink-0">
              <div>
                <p className="text-sm font-bold text-slate-200 uppercase tracking-wider">{MODALS[modal]?.label || modal}</p>
                <p className="text-[11px] text-slate-500">Toggle rows below to audit structural components, assignees, and details</p>
              </div>
              <button onClick={() => setModal(null)} className="text-slate-500 hover:text-slate-300 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Task View Utility Headers */}
            {modal === 'tasks' && (
              <div className="px-5 py-2 bg-hub-bg/50 border-b border-hub-border/50 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-blue-tide font-medium tracking-wide uppercase">Operational Roadmap Matrix</span>
                <button onClick={() => { setModal(null); onAddTaskClick?.(); }} className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-blue-tide/20 border border-blue-tide/30 text-blue-300 font-bold rounded hover:bg-blue-tide/30 transition-all">
                  <Plus className="h-3 w-3" /> Add Task
                </button>
              </div>
            )}

            {/* Render Context List Loop Elements */}
            <div className="overflow-y-auto p-5 flex flex-col gap-3">
              {MODALS[modal]?.items.map((item) => {
                const isExpanded = !!expandedItems[item.id];
                const showCommentField = !!activeCommentBox[item.id];

                return (
                  <div key={item.id} className="border border-white/10 rounded-xl bg-hub-bg/20 hover:border-white/15 transition-all">
                    
                    {/* Primary Clickable Header Interaction Zone */}
                    <div className="p-4 flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleItemExpansion(item.id)}>
                      {item.subtasks && item.subtasks.length > 0 ? (
                        isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <div className="w-4" />
                      )}
                      <ItemIcon icon={item.icon} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">{item.title}</p>
                        {item.assignedTo && <p className="text-[11px] text-slate-500 mt-0.5">Assigned to: <span className="text-slate-400 font-medium">{item.assignedTo}</span></p>}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PILL[item.statusType]}`}>{item.status}</span>
                    </div>

                    {/* Interactive Substructure Extension Dropdown View */}
                    {(isExpanded || !item.subtasks) && (
                      <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-black/5 text-xs text-slate-400 space-y-3">
                        <p className="leading-relaxed text-slate-300 mt-2">{item.body}</p>

                        {/* Blocker Causation & Resolution Blocks */}
                        {modal === 'blockers' && (item.rootCause || item.resolution) && (
                          <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-lg flex flex-col gap-2 text-[11px]">
                            {item.rootCause && (
                              <p><span className="font-bold text-amber-400 block mb-0.5">⚠️ Cause of Block:</span> <span className="text-slate-300">{item.rootCause}</span></p>
                            )}
                            {item.resolution && (
                              <p className="pt-2 border-t border-amber-900/10"><span className="font-bold text-emerald-400 block mb-0.5">⚡ Target Resolution Parameters:</span> <span className="text-slate-300">{item.resolution}</span></p>
                            )}
                          </div>
                        )}

                        {/* Subtasks Tree Checklist Container Component Block */}
                        {item.subtasks && item.subtasks.length > 0 && (
                          <div className="space-y-1.5 my-2 pt-2 border-t border-white/5">
                            <p className="text-[10px] font-bold uppercase text-blue-tide tracking-wider mb-1">Subtasks Breakdown & Ownership Tree</p>
                            {item.subtasks.map((sub) => (
                              <div key={sub.id} className="flex items-center gap-2 pl-2 py-0.5 text-[11px]">
                                {sub.isDone ? (
                                  <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                                ) : (
                                  <Circle className="h-3 w-3 text-slate-600 shrink-0" />
                                )}
                                <span className={sub.isDone ? 'line-through text-slate-600' : 'text-slate-300'}>
                                  {sub.title} — <span className="text-slate-500">Assigned to: {item.assignedTo || 'Unassigned'}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Comments Log Pipeline */}
                        {item.comments && item.comments.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-white/5">
                            {item.comments.map((c, idx) => (
                              <div key={idx} className="flex gap-2 text-[11px] bg-hub-bg/30 p-2 rounded">
                                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[9px] text-blue-400 font-bold shrink-0">{c.initials}</div>
                                <div className="flex-1">
                                  <p className="font-semibold text-slate-300">{c.author} <span className="text-slate-600 font-normal ml-1">{c.time}</span></p>
                                  <p className="text-slate-400 mt-0.5">{c.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Context-Aware Comment Button Toggle Segment Container */}
                        <div className="flex flex-col gap-2 pt-1">
                          {!showCommentField ? (
                            <div className="flex justify-end">
                              <button onClick={() => toggleCommentBox(item.id)} className="flex items-center gap-1 text-[10px] text-blue-tide font-semibold hover:text-slate-200 transition-colors py-1 px-2 rounded hover:bg-white/5">
                                <MessageSquare className="h-3 w-3" /> Add Comment
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 items-center bg-hub-bg/60 p-1.5 rounded-lg border border-white/5">
                              <input
                                type="text"
                                placeholder="Write comment content details..."
                                value={commentInputs[item.id] || ''}
                                onChange={(e) => setCommentInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="flex-1 bg-transparent text-[11px] text-slate-200 px-2 py-1 outline-none"
                              />
                              <button onClick={() => toggleCommentBox(item.id)} className="text-[10px] text-slate-500 hover:text-slate-300 px-1.5">Cancel</button>
                              <button 
                                onClick={() => {
                                  if ((commentInputs[item.id] || '').trim()) {
                                    item.comments.push({
                                      initials: 'OV',
                                      author: 'Ovee',
                                      time: 'Just Now',
                                      text: commentInputs[item.id]
                                    });
                                    setCommentInputs(prev => ({ ...prev, [item.id]: '' }));
                                    toggleCommentBox(item.id);
                                  }
                                }} 
                                className="text-[10px] bg-blue-tide text-slate-950 px-2.5 py-1 rounded font-bold"
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
        <div className="absolute inset-0 bg-black/50 flex items-end z-50 rounded-xl" onClick={() => setModal(null)}>
          <div className="bg-hub-card border-t border-hub-border p-5 rounded-t-xl w-full text-xs text-slate-400 space-y-1">
            <div className="flex justify-between font-bold text-slate-200 mb-2"><span>✦ AI Metrics Monitor Summary</span><X className="h-4 w-4 cursor-pointer" onClick={() => setModal(null)} /></div>
            <p>• Systems structural analysis arrays reporting active green status targets.</p>
          </div>
        </div>
      )}
    </div>
  );
}
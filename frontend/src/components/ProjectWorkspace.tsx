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
                onClick={onAddDeadlineClick}
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
            {activeBlockersList.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-t border-white/5 first:border-0 text-xs text-slate-300">
                <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400">blocked</span>
              </div>
            ))}
            {activeBlockersList.length === 0 && (
              <p className="text-xs text-slate-500 py-2">No active blockers flagged.</p>
            )}
          </div>

          <div onClick={() => setModal('decisions')} className="bg-hub-card border border-hub-border rounded-xl p-4 cursor-pointer hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                <Check className="h-3.5 w-3.5 text-blue-400" /> Decisions
              </div>
              <span className="text-[10px] text-slate-600">click to expand</span>
            </div>
            {activeDecisionsList.slice(0, 3).map((d, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-t border-white/5 first:border-0 text-xs text-slate-300">
                <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="flex-1 truncate">{d.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">decided</span>
              </div>
            ))}
            {activeDecisionsList.length === 0 && (
              <p className="text-xs text-slate-500 py-2">No decisions logged yet.</p>
            )}
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
          {activeTasksList.slice(0, 5).map((t, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-t border-white/5 first:border-0 text-xs text-slate-300">
              <ItemIcon icon={t.icon} />
              <span className="flex-1 truncate">{t.title}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">{t.status}</span>
            </div>
          ))}
          {activeTasksList.length === 0 && (
            <p className="text-xs text-slate-500 py-2">No active tasks in this project.</p>
          )}
        </div>
      </div>

      {/* Expanded Modal Interactive Slider Overlay Drawer */}
      {modal && modal !== 'ai' && (
        <div className="absolute inset-0 bg-black/60 flex items-end z-50 rounded-xl" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-hub-card border-t border-hub-border rounded-t-xl w-full max-h-[85%] flex flex-col">
            
            {/* Modal Header Controls Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-hub-border shrink-0">
              <div>
                <p className="text-sm font-bold text-slate-200 uppercase tracking-wider">{dynamicModals[modal]?.label || modal}</p>
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
              {(dynamicModals[modal]?.items || []).map((item) => {
                const isExpanded = !!expandedItems[item.id];
                const showCommentField = !!activeCommentBox[item.id];

                return (
                  <div key={item.id} className="border border-white/10 rounded-xl bg-hub-bg/20 hover:border-white/15 transition-all">
                    
                    {/* Primary Clickable Header Interaction Zone */}
                    <div className="p-4 flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleItemExpansion(item.id)}>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                      <ItemIcon icon={item.icon} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">{item.title}</p>
                        {item.assignedTo && <p className="text-[11px] text-slate-500 mt-0.5">Assigned to: <span className="text-slate-400 font-medium">{item.assignedTo}</span></p>}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PILL[item.statusType]}`}>{item.status}</span>
                    </div>

                    {/* Interactive Substructure Extension Dropdown View */}
                    {isExpanded && (
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

                        {/* Task Status controls */}
                        {modal === 'tasks' && (
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Update Status:</span>
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
                              className="bg-hub-bg text-slate-200 border border-hub-border rounded text-[11px] px-2 py-1 focus:outline-none"
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="blocked">Blocked</option>
                              <option value="done">Done</option>
                            </select>
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
                                      initials: currentUser ? currentUser.email.slice(0, 2).toUpperCase() : 'OV',
                                      author: currentUser ? currentUser.email : 'Ovee',
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
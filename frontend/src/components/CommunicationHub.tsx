import { useState } from 'react';
import {
  MessageSquare, CheckSquare, GitPullRequest, Zap,
  Hash, User, Clock, Check, AlertCircle,
  ChevronDown, ChevronRight, Filter
} from 'lucide-react';
import { api } from '../services/api';

type Tab = 'messages' | 'decisions' | 'actions' | 'prs';

const SOURCE_BADGE: Record<string, string> = {
  slack:    'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40',
  whatsapp: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40',
  github:   'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/40',
};

const STATUS_PILL: Record<string, string> = {
  pending:   'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40',
  completed: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40',
};

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  messages: any[];
  decisions: any[];
  actionItems: any[];
  githubPrs: any[];
  currentUser?: any;
  onStatusChange?: () => void;
}

export function CommunicationHub({
  messages = [],
  decisions = [],
  actionItems = [],
  githubPrs = [],
  currentUser: _currentUser,
  onStatusChange,
}: Props) {
  const [tab, setTab] = useState<Tab>('messages');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'slack' | 'whatsapp'>('all');
  const [expandedDecision, setExpandedDecision] = useState<string | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  const filteredMessages = messages.filter(m =>
    sourceFilter === 'all' || m.source === sourceFilter
  );

  const handleActionToggle = async (item: any) => {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    setUpdatingItem(item.id);
    try {
      await api.updateActionItemStatus(item.id, newStatus);
      onStatusChange?.();
    } catch {
      // silently ignore; WebSocket will correct state
    } finally {
      setUpdatingItem(null);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'messages',  label: 'Messages',  icon: <MessageSquare className="h-3.5 w-3.5" />, count: messages.length },
    { key: 'decisions', label: 'Decisions', icon: <Check className="h-3.5 w-3.5" />,          count: decisions.length },
    { key: 'actions',   label: 'Actions',   icon: <CheckSquare className="h-3.5 w-3.5" />,    count: actionItems.filter(a => a.status !== 'completed').length },
    { key: 'prs',       label: 'GitHub PRs',icon: <GitPullRequest className="h-3.5 w-3.5" />, count: githubPrs.length },
  ];

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <Zap className="h-4 w-4 text-glow-indigo" />
          Communication Hub
          <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">/ All channels</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
          Live feed of messages, extracted decisions, and action items
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-slate-200/60 dark:border-slate-800/40 bg-white/50 dark:bg-slate-950/20 shrink-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              tab === t.key
                ? 'border-glow-indigo text-glow-indigo bg-glow-indigo/5 dark:bg-glow-indigo/10'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === t.key
                  ? 'bg-glow-indigo text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">

        {/* MESSAGES TAB */}
        {tab === 'messages' && (
          <>
            {/* Source filter */}
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-3 w-3 text-slate-400" />
              {(['all', 'slack', 'whatsapp'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-full font-semibold capitalize border transition-all ${
                    sourceFilter === s
                      ? 'bg-glow-indigo border-glow-indigo shadow-sm shadow-glow-indigo/20'
                      : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-glow-indigo/40'
                  }`}
                >
                  {s}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">{filteredMessages.length} messages</span>
            </div>

            {filteredMessages.length === 0 ? (
              <EmptyState icon={<MessageSquare className="h-8 w-8" />} title="No messages yet" body="Send a message via the Webhook Simulator to see it appear here in real time." />
            ) : (
              filteredMessages.map((msg, i) => (
                <div key={msg.id || i} className="group flex gap-3 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/50 bg-white/60 dark:bg-slate-950/20 hover:border-slate-300 dark:hover:border-slate-700/60 hover:bg-white/80 dark:hover:bg-slate-950/30 transition-all duration-200">
                  <div className="shrink-0 mt-0.5">
                    <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{msg.sender || 'Unknown'}</span>
                      {msg.source && (
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${SOURCE_BADGE[msg.source] || SOURCE_BADGE.slack}`}>
                          {msg.source}
                        </span>
                      )}
                      {msg.channel && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          <Hash className="h-2.5 w-2.5" />{msg.channel.replace('#', '')}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                        <Clock className="h-2.5 w-2.5" />{timeAgo(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* DECISIONS TAB */}
        {tab === 'decisions' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">AI-extracted from team communications</p>
              <span className="text-[10px] text-slate-400">{decisions.length} total</span>
            </div>
            {decisions.length === 0 ? (
              <EmptyState icon={<Check className="h-8 w-8" />} title="No decisions logged" body="Send messages via the Simulator — Claude will extract decisions automatically." />
            ) : (
              decisions.map((d, i) => {
                const isOpen = expandedDecision === (d.id || String(i));
                return (
                  <div
                    key={d.id || i}
                    className="border border-slate-200/70 dark:border-slate-800/50 rounded-xl bg-white/60 dark:bg-slate-950/20 overflow-hidden transition-all duration-200 hover:border-glow-indigo/30"
                  >
                    <button
                      className="w-full flex items-center gap-3 p-3.5 text-left"
                      onClick={() => setExpandedDecision(isOpen ? null : (d.id || String(i)))}
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                      <div className="h-5 w-5 rounded-full bg-glow-indigo/15 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-glow-indigo" />
                      </div>
                      <p className="flex-1 text-xs font-semibold text-slate-800 dark:text-slate-200 text-left leading-snug">{d.decision_text}</p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{timeAgo(d.created_at)}</span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/40 bg-slate-50/40 dark:bg-slate-950/20">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Extracted from team communication on{' '}
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {d.created_at ? new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown date'}
                          </span>
                          {' '}via AI decision extraction pipeline.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ACTION ITEMS TAB */}
        {tab === 'actions' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Commitments extracted by AI</p>
              <span className="text-[10px] text-slate-400">
                {actionItems.filter(a => a.status === 'pending').length} pending · {actionItems.filter(a => a.status === 'completed').length} done
              </span>
            </div>
            {actionItems.length === 0 ? (
              <EmptyState icon={<CheckSquare className="h-8 w-8" />} title="No action items" body="AI extracts commitments like 'Alice will finish the design by Friday' from messages." />
            ) : (
              actionItems.map((item, i) => (
                <div
                  key={item.id || i}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
                    item.status === 'completed'
                      ? 'border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/10 opacity-60'
                      : 'border-slate-200/70 dark:border-slate-800/50 bg-white/60 dark:bg-slate-950/20 hover:border-amber-300/60 dark:hover:border-amber-800/40'
                  }`}
                >
                  <button
                    onClick={() => handleActionToggle(item)}
                    disabled={updatingItem === item.id}
                    className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      item.status === 'completed'
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                    }`}
                  >
                    {item.status === 'completed' && <Check className="h-3 w-3 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold leading-snug ${item.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {item.task}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <User className="h-2.5 w-2.5" />{item.owner || 'Unassigned'}
                      </span>
                      {item.deadline && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                          <Clock className="h-2.5 w-2.5" />by {item.deadline}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${STATUS_PILL[item.status] || STATUS_PILL.pending}`}>
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </>
        )}

        {/* GITHUB PRs TAB */}
        {tab === 'prs' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Linked pull requests</p>
              <span className="text-[10px] text-slate-400">{githubPrs.length} PRs</span>
            </div>
            {githubPrs.length === 0 ? (
              <EmptyState icon={<GitPullRequest className="h-8 w-8" />} title="No PRs logged" body="Simulate a GitHub PR via the Webhook Simulator — it will auto-link to the nearest project." />
            ) : (
              githubPrs.map((pr, i) => (
                <div key={pr.id || i} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/50 bg-white/60 dark:bg-slate-950/20 hover:border-glow-indigo/30 transition-all duration-200 group">
                  <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    <GitPullRequest className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">PR #{pr.pr_number}</span>
                      {pr.linked_project_id && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-glow-indigo/10 text-glow-indigo font-bold border border-glow-indigo/20">linked</span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400">{timeAgo(pr.created_at)}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 leading-snug">{pr.title}</p>
                    {pr.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{pr.description}</p>
                    )}
                  </div>
                  <AlertCircle className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-slate-300 dark:text-slate-700 mb-3">{icon}</div>
      <p className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">{title}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">{body}</p>
    </div>
  );
}

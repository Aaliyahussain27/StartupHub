import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Clock, HelpCircle, AlertCircle, Plus, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

interface AIAssistantPanelProps {
  idea: {
    id: string;
    title: string;
    description: string;
    status: string;
  };
  onConvertToProject: () => void;
  onAddTask: (taskTitle: string) => void;
}

export function AIAssistantPanel({ idea, onConvertToProject, onAddTask }: AIAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'brainstorm' | 'reminders' | 'nextsteps'>('suggestions');

  const { data: guidance, isLoading, error, refetch } = useQuery({
    queryKey: ['assistantGuidance', idea.id],
    queryFn: () => api.getAssistantGuidance(idea.id),
    enabled: !!idea.id
  });

  useEffect(() => {
    refetch();
  }, [idea.id]);

  if (isLoading) {
    return (
      <div className="bg-slate-50 dark:bg-hub-card/30 rounded-xl border border-slate-200 dark:border-hub-border p-4 animate-pulse flex flex-col gap-3">
        <div className="h-4 bg-slate-200 dark:bg-hub-border/60 rounded w-1/3"></div>
        <div className="h-12 bg-slate-200 dark:bg-hub-border/60 rounded"></div>
        <div className="h-10 bg-slate-200 dark:bg-hub-border/60 rounded"></div>
      </div>
    );
  }

  if (error || !guidance) {
    return (
      <div className="bg-slate-50 dark:bg-hub-card/30 rounded-xl border border-slate-200 dark:border-hub-border p-4 text-xs text-slate-500 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-rose-500" />
        <span>Could not load Assistant Guidance.</span>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-hub-card/40 backdrop-blur-md border border-slate-200 dark:border-hub-border/80 rounded-xl p-4.5 flex flex-col gap-4 shadow-sm transition-all duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-hub-border/40">
        <Sparkles className="h-4 w-4 text-glow-indigo animate-pulse" />
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">AI Assistant Desk</h3>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 dark:bg-hub-bg/80 rounded-lg border border-slate-200 dark:border-hub-border/40">
        {(['suggestions', 'brainstorm', 'reminders', 'nextsteps'] as const).map((tab) => {
          const labels = {
            suggestions: 'Context',
            brainstorm: 'Brainstorm',
            reminders: 'Reminders',
            nextsteps: 'Next Step'
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[10px] font-bold py-1.5 rounded-md transition-all uppercase tracking-tight ${
                activeTab === tab
                  ? 'bg-white dark:bg-hub-card text-glow-indigo shadow-sm border border-slate-200/50 dark:border-hub-border/40'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="min-h-[100px] flex flex-col justify-between">
        
        {/* TAB 1: SUGGESTIONS */}
        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-hub-bg/30 p-3 rounded-lg border border-slate-200/60 dark:border-hub-border/40 leading-relaxed font-medium">
              {guidance.suggestions}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>We check all workspace ideas for architectural and logical boundaries.</span>
            </div>
          </div>
        )}

        {/* TAB 2: BRAINSTORMING */}
        {activeTab === 'brainstorm' && (
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-slate-400 dark:text-blue-tide uppercase tracking-wider">Suggested Sub-tasks</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {guidance.brainstormTasks.map((t: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#070a13]/30 px-3 py-2 rounded-lg border border-slate-100 dark:border-hub-border/30 hover:border-glow-indigo/30 transition-all group">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{t.title}</p>
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-tight">{t.category}</span>
                  </div>
                  <button
                    onClick={() => {
                      onAddTask(t.title);
                    }}
                    className="shrink-0 p-1 bg-slate-200/50 dark:bg-hub-border text-slate-700 dark:text-slate-300 rounded hover:bg-glow-indigo hover:text-white dark:hover:bg-glow-indigo dark:hover:text-slate-950 transition-colors"
                    title="Add to active project tasks"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: REMINDERS */}
        {activeTab === 'reminders' && (
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-slate-400 dark:text-blue-tide uppercase tracking-wider">Discussion Context Stream</p>
            <div className="space-y-2">
              {guidance.reminders.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-600">No matching conversations found.</p>
              ) : (
                guidance.reminders.map((r: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 bg-slate-50/30 dark:bg-[#070a13]/10 p-2.5 rounded-lg border border-slate-200/40 dark:border-hub-border/20">
                    <Clock className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 dark:text-slate-400 leading-snug">{r.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: NEXT STEPS */}
        {activeTab === 'nextsteps' && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-slate-400 dark:text-blue-tide uppercase tracking-wider">Next Step Checklist</p>
            <div className="space-y-2">
              {guidance.nextSteps.map((step: any) => (
                <div key={step.step} className="flex items-center gap-2">
                  <CheckCircle2 className={`h-4 w-4 shrink-0 ${step.completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                  <span className={`text-xs ${step.completed ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
            
            {idea.status !== 'project' && (
              <div className="pt-2">
                <button
                  onClick={onConvertToProject}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white dark:text-slate-950 bg-slate-800 dark:bg-soft-sand hover:bg-slate-900 dark:hover:bg-slate-200 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <span>Build Now (Convert Project)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

import { useState } from 'react';
import { Sunrise, RefreshCw, Zap, AlertTriangle, CheckSquare, Lightbulb } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

interface BriefingData {
  greeting: string;
  summary: string;
  highlights: Array<{ icon: 'decision' | 'blocker' | 'action' | 'idea'; text: string }>;
  generatedAt: string;
  aiActive?: boolean;
  aiProvider?: 'claude' | 'gemini' | 'fallback';
}

const ICON_MAP = {
  decision: <Zap className="h-3.5 w-3.5 text-glow-indigo shrink-0 mt-0.5" />,
  blocker: <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5 animate-pulse" />,
  action: <CheckSquare className="h-3.5 w-3.5 text-cyber-cyan shrink-0 mt-0.5" />,
  idea: <Lightbulb className="h-3.5 w-3.5 text-neon-violet shrink-0 mt-0.5" />,
};

interface DailyBriefingProps {
  workspaceId: string;
}

export function DailyBriefing({ workspaceId }: DailyBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [typewriterDone, setTypewriterDone] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setBriefing(null);
    setTyped('');
    setTypewriterDone(false);

    try {
      const res = await fetch(`${BACKEND_URL}/api/briefing?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error('Failed to generate briefing');
      const data: BriefingData = await res.json();
      setBriefing(data);

      // Typewriter effect on summary
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setTyped(data.summary.slice(0, i));
        if (i >= data.summary.length) {
          clearInterval(interval);
          setTypewriterDone(true);
        }
      }, 18);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="bg-white/85 dark:bg-hub-card/45 backdrop-blur-md border border-slate-200/60 dark:border-hub-border/60 rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm shadow-slate-200/20 dark:shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-hub-border/40">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sunrise className="h-4.5 w-4.5 text-glow-indigo animate-pulse" />
            <span>AI Daily Briefing</span>
          </h2>
          {briefing && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider transition-all select-none ${
              briefing.aiProvider === 'gemini'
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                : briefing.aiProvider === 'claude'
                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' 
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}>
              {briefing.aiProvider === 'gemini' ? (
                <>
                  <Zap className="h-2.5 w-2.5 text-sky-500" />
                  <span>Gemini</span>
                </>
              ) : briefing.aiProvider === 'claude' ? (
                <>
                  <Zap className="h-2.5 w-2.5 text-violet-500" />
                  <span>Claude</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                  <span>Fallback</span>
                </>
              )}
            </div>
          )}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 bg-slate-100/60 dark:bg-[#070a13]/40 border border-slate-200 dark:border-hub-border/60 hover:bg-slate-200/60 dark:hover:bg-[#070a13]/70 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-sm shadow-slate-100/30 dark:shadow-none"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-glow-indigo' : ''}`} />
          {loading ? 'Generating...' : briefing ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {/* Empty state */}
      {!briefing && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2.5">
          <Sunrise className="h-10 w-10 text-glow-indigo/35 opacity-40 animate-pulse" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{greeting}! Hit Generate for your AI briefing.</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[240px]">AI will analyze workspace activity to construct priorities, decisions & blockers.</p>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div className="space-y-2.5 animate-pulse py-2">
          <div className="h-3 bg-slate-200/60 dark:bg-hub-border/40 rounded-full w-3/4"></div>
          <div className="h-3 bg-slate-200/60 dark:bg-hub-border/40 rounded-full w-full"></div>
          <div className="h-3 bg-slate-200/60 dark:bg-hub-border/40 rounded-full w-5/6"></div>
          <div className="h-3 bg-slate-200/60 dark:bg-hub-border/40 rounded-full w-2/3 mt-4"></div>
          <div className="h-3 bg-slate-200/60 dark:bg-hub-border/40 rounded-full w-full"></div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/30 rounded-xl p-4 shadow-sm">
          {error}
        </div>
      )}

      {/* Briefing content */}
      {briefing && !loading && (
        <div className="space-y-3.5">
          {/* Greeting */}
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{briefing.greeting}</p>

          {/* Summary with typewriter */}
          <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-400 bg-slate-50/60 dark:bg-[#070a13]/30 rounded-xl border border-slate-200/60 dark:border-hub-border/40 p-4 min-h-[70px] shadow-inner font-sans">
            {typed.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} className="mb-1">{line}</p>
            ))}
            {!typewriterDone && (
              <span className="inline-block w-0.5 h-3.5 bg-glow-indigo ml-0.5 animate-pulse align-middle" />
            )}
          </div>

          {/* Highlights */}
          {briefing.highlights.length > 0 && typewriterDone && (
            <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-hub-border/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-glow-indigo">Key Points</p>
              <div className="space-y-2">
                {briefing.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-[#070a13]/10 p-2.5 rounded-xl border border-slate-200/40 dark:border-hub-border/20 hover:-translate-x-0.5 transition-all duration-150">
                    {ICON_MAP[h.icon]}
                    <span className="leading-snug">{h.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[9px] text-slate-400 dark:text-slate-600 text-right mt-1.5">
            Generated at {new Date(briefing.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

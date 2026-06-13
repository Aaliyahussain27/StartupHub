import { useState } from 'react';
import { Sunrise, RefreshCw, Zap, AlertTriangle, CheckSquare, Lightbulb } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface BriefingData {
  greeting: string;
  summary: string;
  highlights: Array<{ icon: 'decision' | 'blocker' | 'action' | 'idea'; text: string }>;
  generatedAt: string;
}

const ICON_MAP = {
  decision: <Zap className="h-3.5 w-3.5 text-[#DCCCB4] shrink-0 mt-0.5" />,
  blocker: <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />,
  action: <CheckSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />,
  idea: <Lightbulb className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />,
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
    <div className="bg-hub-card rounded-xl border border-hub-border p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-hub-border/60">
        <h2 className="text-sm font-bold text-blue-tide uppercase tracking-wider flex items-center gap-2">
          <Sunrise className="h-4 w-4" />
          <span>AI Daily Briefing</span>
        </h2>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-soft-sand bg-driftwood/20 border border-driftwood/30 hover:bg-driftwood/30 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Generating...' : briefing ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {/* Empty state */}
      {!briefing && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-center gap-2">
          <Sunrise className="h-8 w-8 opacity-30" />
          <p className="text-xs">{greeting}! Hit Generate for your AI briefing.</p>
          <p className="text-[10px] text-slate-600">Claude will summarize decisions, blockers & priorities.</p>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div className="space-y-2 animate-pulse py-2">
          <div className="h-3 bg-hub-border rounded w-3/4"></div>
          <div className="h-3 bg-hub-border rounded w-full"></div>
          <div className="h-3 bg-hub-border rounded w-5/6"></div>
          <div className="h-3 bg-hub-border rounded w-2/3 mt-3"></div>
          <div className="h-3 bg-hub-border rounded w-full"></div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900 rounded p-3">
          {error}
        </div>
      )}

      {/* Briefing content */}
      {briefing && !loading && (
        <div className="space-y-3">
          {/* Greeting */}
          <p className="text-xs font-semibold text-soft-sand">{briefing.greeting}</p>

          {/* Summary with typewriter */}
          <div className="text-sm text-slate-300 leading-relaxed bg-hub-bg/50 rounded-lg border border-hub-border/40 p-3 min-h-[60px]">
          {typed.split('\n').filter(Boolean).map((line, i) => (
          <p key={i} className="mb-1">{line}</p>
          ))}
          {!typewriterDone && (
           <span className="inline-block w-0.5 h-4 bg-soft-sand ml-0.5 animate-pulse align-middle" />
           )}
          </div>

          {/* Highlights */}
          {briefing.highlights.length > 0 && typewriterDone && (
            <div className="space-y-2 pt-1 border-t border-hub-border/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-tide">Key Points</p>
              {briefing.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  {ICON_MAP[h.icon]}
                  <span className="leading-snug">{h.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[9px] text-slate-600 text-right">
            Generated at {new Date(briefing.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Mic, Square, FileText, CheckCircle, Brain, RefreshCw, Clock, Sparkles } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface Meeting {
  id: string;
  title: string;
  raw_transcript: string;
  duration_seconds: number;
  processed: boolean;
  created_at: string;
}

interface RelatedIdea {
  id: string;
  title: string;
  description: string;
  status: string;
  score: number;
}

export function MeetingTranscription() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [relatedIdeas, setRelatedIdeas] = useState<RelatedIdea[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  // Recorder states
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [duration, setDuration] = useState(0);
  
  // Speech Recognition ref
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Load meetings list
  const fetchMeetings = async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.error('Failed to load meetings list:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Load related ideas when meeting selected
  useEffect(() => {
    if (!selectedMeeting) {
      setRelatedIdeas([]);
      return;
    }
    
    const fetchRelated = async () => {
      setLoadingRelated(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/meetings/${selectedMeeting.id}/related-ideas`);
        if (res.ok) {
          const data = await res.json();
          setRelatedIdeas(data);
        }
      } catch (err) {
        console.error('Failed to fetch related ideas:', err);
      } finally {
        setLoadingRelated(false);
      }
    };
    fetchRelated();
  }, [selectedMeeting]);

  // Setup Web Speech API
  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please try Google Chrome.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscriptText(prev => prev + finalTranscript);
      }
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    rec.onend = () => {
      if (isRecording) {
        // Automatically restart if it was stopped by browser timeout
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn('Speech rec auto-restart failed:', e);
        }
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
    setDuration(0);
    setTranscriptText('');
    setMeetingTitle(`Meeting - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  // Submit transcript to webhook
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcriptText.trim()) return;

    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const res = await fetch(`${BACKEND_URL}/api/webhooks/meeting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sh-auth-token') || ''}`
        },
        body: JSON.stringify({
          title: meetingTitle || 'Untitled Meeting',
          raw_transcript: transcriptText,
          duration_seconds: duration
        })
      });

      if (res.ok) {
        setSubmitSuccess(true);
        setTranscriptText('');
        setMeetingTitle('');
        setDuration(0);
        await fetchMeetings(); // reload history
        setTimeout(() => setSubmitSuccess(false), 3000);
      } else {
        const errorData = await res.json();
        alert(`Failed to ingest meeting notes: ${errorData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Submit failed:', err);
      alert('Network error. Failed to connect to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[600px] items-stretch animate-fadeIn">
      {/* Left panel: recorder & history list (5 cols) */}
      <div className="xl:col-span-5 flex flex-col gap-6">
        {/* Recorder interface */}
        <div className="bg-white/85 dark:bg-hub-card/45 backdrop-blur-md border border-slate-200/60 dark:border-hub-border/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-hub-border/40 mb-4">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Mic className="h-4 w-4 text-glow-indigo" />
              <span>Real-Time Transcription</span>
            </h2>
            {isRecording && (
              <span className="flex items-center gap-1 text-[10px] text-rose-500 font-bold uppercase animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                Recording {formatDuration(duration)}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-200 dark:border-hub-border/40 rounded-xl bg-slate-50/40 dark:bg-slate-950/20 mb-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 group"
              >
                <Mic className="h-7 w-7 group-hover:animate-pulse" />
              </button>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {/* Visual mic animation bars */}
                <div className="flex items-end gap-1 h-8 px-4 justify-center">
                  <div className="w-1 bg-indigo-500 rounded-full animate-[barGrow_0.6s_ease-in-out_infinite]" style={{ height: '60%' }}></div>
                  <div className="w-1 bg-blue-500 rounded-full animate-[barGrow_0.4s_ease-in-out_infinite]" style={{ height: '90%' }}></div>
                  <div className="w-1 bg-purple-500 rounded-full animate-[barGrow_0.8s_ease-in-out_infinite]" style={{ height: '40%' }}></div>
                  <div className="w-1 bg-indigo-500 rounded-full animate-[barGrow_0.5s_ease-in-out_infinite]" style={{ height: '80%' }}></div>
                  <div className="w-1 bg-blue-500 rounded-full animate-[barGrow_0.7s_ease-in-out_infinite]" style={{ height: '50%' }}></div>
                </div>
                
                <button
                  onClick={stopRecording}
                  className="h-14 w-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-105 active:scale-95 animate-pulse"
                >
                  <Square className="h-5 w-5" />
                </button>
              </div>
            )}
            
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-4 uppercase tracking-wider">
              {!isRecording ? 'Click to start transcribing' : 'Speaking... Click red button to pause'}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[220px] text-center mt-1">
              Uses Chrome Web Speech API to stream text in real-time.
            </p>
          </div>

          {/* Form to submit final transcript */}
          {transcriptText && (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-100 dark:border-hub-border/20">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Meeting Name</label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg border border-slate-200 dark:border-hub-border/50 focus:outline-none focus:border-glow-indigo/80"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Transcript Draft</label>
                <textarea
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-800 dark:text-slate-200 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-hub-border/50 focus:outline-none focus:border-glow-indigo/80 h-32 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-glow-indigo hover:bg-glow-indigo/90 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md shadow-glow-indigo/20 flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Ingesting & Extracting with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Process & Analyze Meeting
                  </>
                )}
              </button>
            </form>
          )}

          {submitSuccess && (
            <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs p-3 rounded-lg flex items-center gap-2 animate-fadeIn">
              <CheckCircle className="h-4 w-4" />
              <span>Meeting processed! Decisions and actions extracted.</span>
            </div>
          )}
        </div>

        {/* History list */}
        <div className="bg-white/85 dark:bg-hub-card/45 backdrop-blur-md border border-slate-200/60 dark:border-hub-border/60 rounded-2xl p-5 flex-1 shadow-sm flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-hub-border/40 mb-3.5">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Meeting History
            </h2>
            <button onClick={fetchMeetings} className="text-slate-400 hover:text-slate-200 transition-colors">
              <RefreshCw className={`h-3 w-3 ${loadingList ? 'animate-spin text-glow-indigo' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[350px]">
            {meetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <FileText className="h-8 w-8 text-slate-300 dark:text-slate-700 opacity-55" />
                <p className="text-xs text-slate-400">No meeting history yet.</p>
              </div>
            ) : (
              meetings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMeeting(m)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedMeeting?.id === m.id
                      ? 'bg-slate-100 dark:bg-hub-bg border-glow-indigo'
                      : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-hub-border/60 hover:bg-slate-100/60 dark:hover:bg-slate-950/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex-1">{m.title}</h3>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(m.duration_seconds)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(m.created_at).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right panel: Details & Semantic Idea Linking (7 cols) */}
      <div className="xl:col-span-7 flex flex-col items-stretch">
        {selectedMeeting ? (
          <div className="bg-white/85 dark:bg-hub-card/45 backdrop-blur-md border border-slate-200/60 dark:border-hub-border/60 rounded-2xl p-6 shadow-sm flex flex-col gap-5 flex-1 animate-fadeIn">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/35 px-2 py-0.5 rounded-full font-bold uppercase">Transcribed</span>
                <span className="text-[10px] text-slate-500">{new Date(selectedMeeting.created_at).toLocaleString()}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">{selectedMeeting.title}</h2>
            </div>

            {/* Transcript text */}
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Transcript Summary</h3>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-400 bg-slate-50/55 dark:bg-slate-950/20 border border-slate-200/50 dark:border-hub-border/40 p-4 rounded-xl font-sans max-h-40 overflow-y-auto">
                {selectedMeeting.raw_transcript}
              </p>
            </div>

            {/* Semantic Idea Linking Interface */}
            <div className="border-t border-slate-100 dark:border-hub-border/30 pt-4">
              <h3 className="text-[10px] font-bold text-glow-indigo uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Brain className="h-4 w-4" />
                <span>Linked Ideas (AI Cosine Similarity)</span>
              </h3>

              {loadingRelated ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="h-5 w-5 text-indigo-500 animate-spin" />
                </div>
              ) : relatedIdeas.length === 0 ? (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/30 dark:bg-slate-950/10 p-3 rounded-lg border border-dashed border-slate-200 dark:border-hub-border/30">
                  No similar workspace ideas found above similarity thresholds.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {relatedIdeas.map((idea) => (
                    <div
                      key={idea.id}
                      className="p-3.5 bg-slate-50/40 dark:bg-[#070a13]/30 border border-slate-200/50 dark:border-hub-border/50 rounded-xl hover:-translate-y-0.5 transition-all duration-200 flex items-start gap-3 justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{idea.title}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${
                            idea.status === 'inbox' 
                              ? 'bg-amber-500/10 border-amber-500/25 text-amber-500' 
                              : 'bg-indigo-500/10 border-indigo-500/25 text-indigo-500'
                          }`}>
                            {idea.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal line-clamp-2">{idea.description}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-2 py-1 rounded-lg">
                          Match: {Math.round(idea.score * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white/85 dark:bg-hub-card/45 backdrop-blur-md border border-slate-200/60 dark:border-hub-border/60 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center gap-3 flex-1">
            <Mic className="h-10 w-10 text-slate-300 dark:text-slate-700 opacity-45" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Meeting Selected</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[280px]">Select a meeting transcript from history or record a new one to run AI extraction and semantic linking.</p>
          </div>
        )}
      </div>
    </div>
  );
}

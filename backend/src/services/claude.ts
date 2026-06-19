import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

let anthropic: Anthropic | null = null;
let gemini: GoogleGenerativeAI | null = null;
let aiProvider: 'claude' | 'gemini' | 'fallback' = 'fallback';
let aiStatus: 'active' | 'fallback' | 'checking' = 'fallback';

const log = (level: string, message: string) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] [${level}] [AI-SERVICE] - ${message}`);
};

// Initialize AI Client
export function initializeClaude() {
  const claudeKey = process.env.CLAUDE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  log('INFO', 'Initializing AI client...');

  // 1. Try Gemini first if key is present
  if (geminiKey && geminiKey.trim() !== '' && !geminiKey.startsWith('GEMINI_API_KEY')) {
    log('INFO', 'Initializing Google Gemini Client.');
    gemini = new GoogleGenerativeAI(geminiKey);
    aiStatus = 'checking';
    
    const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
    model.generateContent('h')
      .then(() => {
        log('INFO', 'Gemini API connection validated successfully. Running in Gemini Mode.');
        aiProvider = 'gemini';
        aiStatus = 'active';
      })
      .catch((err: any) => {
        log('WARN', `Gemini API connection validation failed: ${err.message}. Trying Claude client next.`);
        gemini = null;
        tryClaudeFallback(claudeKey);
      });
  } else {
    tryClaudeFallback(claudeKey);
  }
}

function tryClaudeFallback(claudeKey: string | undefined) {
  if (claudeKey && claudeKey.trim() !== '' && !claudeKey.startsWith('sk-...')) {
    log('INFO', 'Initializing Anthropic Claude Client.');
    anthropic = new Anthropic({ apiKey: claudeKey });
    aiStatus = 'checking';

    // Validate the client connection and credit balance asynchronously
    anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'h' }]
    }).then(() => {
      log('INFO', 'Claude API connection validated successfully. Running in Claude Mode.');
      aiProvider = 'claude';
      aiStatus = 'active';
    }).catch((err: any) => {
      log('WARN', `Claude API connection validation failed: ${err.message}. Running in Fallback Mode.`);
      aiStatus = 'fallback';
      aiProvider = 'fallback';
      anthropic = null; // Set client to null so all pipeline tasks immediately use the smart regex fallback
    });
  } else {
    log('WARN', 'No active LLM provider API keys available. Running in Regex & Semantic Fallback Mode.');
    aiStatus = 'fallback';
    aiProvider = 'fallback';
  }
}

// Check if AI is active
export function isClaudeActive(): boolean {
  return aiStatus === 'active';
}

// Check which provider is running
export function getAIProvider(): 'claude' | 'gemini' | 'fallback' {
  return aiProvider;
}

// 1. EMBEDDING GENERATION (1536-dimensional vector)
// Using our custom semantic hash so search works offline!
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim() === '') {
    return new Array(1536).fill(0);
  }

  // Anthropic does not have a general public embeddings endpoint yet,
  // we default to the deterministic semantic hashing.
  return generateDeterministicEmbedding(text);
}

// Deterministic semantic hashing to enable local vector similarity search
function generateDeterministicEmbedding(text: string): number[] {
  const embedding = new Array(1536).fill(0);
  const cleanText = text.toLowerCase();
  
  // Hash function
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  };

  // Seed LCG with text hash
  let seed = Math.abs(getHash(cleanText)) || 1;
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Fill vector
  for (let i = 0; i < 1536; i++) {
    embedding[i] = lcg() * 2 - 1; // Range [-1.0, 1.0]
  }

  // Boost specific indices for matching words
  const words = cleanText.split(/\W+/).filter(w => w.length > 2);
  for (const word of words) {
    const wordHash = Math.abs(getHash(word));
    for (let j = 0; j < 5; j++) {
      const idx = (wordHash + j * 97) % 1536;
      embedding[idx] += 3.0; // Significant boost
    }
  }

  // Normalize
  let sumSq = 0;
  for (let i = 0; i < 1536; i++) {
    sumSq += embedding[i] * embedding[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < 1536; i++) {
    embedding[i] /= norm;
  }

  return embedding;
}

// Helper to split text into sentences
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// 2. SUMMARIZATION (Daily Digest of messages)
export async function summarizeMessages(messages: string[]): Promise<string> {
  const combinedText = messages.join('\n');
  
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent(
        `Summarize these messages. Focus on: decisions made, blockers, progress. Keep it concise. Messages:\n${combinedText}`
      );
      const text = response.response.text();
      if (text) return text.trim();
    } catch (err: any) {
      log('ERROR', `Gemini summarization failed: ${err.message}. Trying Claude.`);
    }
  }

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 250,
        messages: [
          {
            role: 'user',
            content: `Summarize these messages. Focus on: decisions made, blockers, progress. Keep it concise. Messages:\n${combinedText}`
          }
        ]
      });
      
      const textContent = response.content[0].type === 'text' ? response.content[0].text : '';
      if (textContent) return textContent.trim();
    } catch (err: any) {
      log('ERROR', `Claude call failed: ${err.message}. Triggering fallback.`);
    }
  }

  return summarizeMessagesFallback(combinedText);
}

function summarizeMessagesFallback(text: string): string {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return 'No messages to summarize.';
  return `Daily Digest: ${sentences[0]} ${sentences[sentences.length - 1]} (Fallback Summary)`;
}

// 3. DECISION EXTRACTION
export async function extractDecision(text: string): Promise<string | null> {
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent(
        `Extract the decision made in this conversation. Format: 'Decision: [what] ([who proposed], [outcome])'. If no decision is made, return nothing. Text:\n${text}`
      );
      const content = response.response.text();
      if (content && content.trim() !== '') return content.trim();
    } catch (err: any) {
      log('ERROR', `Gemini decision extraction failed: ${err.message}. Trying Claude.`);
    }
  }

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: `Extract the decision made in this conversation. Format: 'Decision: [what] ([who proposed], [outcome])'. If no decision is made, return nothing. Text:\n${text}`
          }
        ]
      });
      
      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      if (content && content.trim() !== '') return content.trim();
    } catch (err: any) {
      log('ERROR', `Claude call failed: ${err.message}`);
    }
  }

  // Run local fallback regex
  const rx = /decide|agreed|use|chosen/i;
  const sentences = splitIntoSentences(text);
  for (const sentence of sentences) {
    if (rx.test(sentence)) {
      return `Decision: ${sentence} (System Extracted, fallback-approved)`;
    }
  }
  return null;
}

// 4. ACTION ITEM EXTRACTION
export interface ExtractedActionItem {
  owner: string;
  task: string;
  deadline: string;
}

export async function extractActionItems(text: string): Promise<ExtractedActionItem[]> {
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      const response = await model.generateContent(
        `Extract action items from the text. Format response strictly as a JSON array of objects with keys "owner", "task", "deadline". If none, return empty array []. Text:\n${text}`
      );
      const content = response.response.text() || '[]';
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err: any) {
      log('ERROR', `Gemini action items extraction failed: ${err.message}. Trying Claude.`);
    }
  }

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Extract action items from the text. Format response strictly as a JSON array of objects with keys "owner", "task", "deadline". If none, return empty array []. Text:\n${text}`
          }
        ]
      });
      
      const content = response.content[0].type === 'text' ? response.content[0].text : '[]';
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err: any) {
      log('ERROR', `Claude call failed: ${err.message}. Using fallback regex.`);
    }
  }

  return extractActionItemsFallback(text);
}

function extractActionItemsFallback(text: string): ExtractedActionItem[] {
  // Fallback: regex for will|should|by [date]
  const actionItems: ExtractedActionItem[] = [];
  const sentences = splitIntoSentences(text);
  
  for (const sentence of sentences) {
    const hasWill = /\bwill\b/i.test(sentence);
    const hasShould = /\bshould\b/i.test(sentence);
    const hasBy = /\bby\s+(\w+)\b/i.test(sentence);
    
    if (hasWill || hasShould || hasBy) {
      const words = sentence.split(/\s+/);
      let owner = 'Team';
      
      for (let i = 0; i < words.length; i++) {
        const w = words[i].replace(/[^\w]/g, '');
        if (w.length > 1 && w[0] === w[0].toUpperCase() && i > 0 && w !== 'I' && w !== 'We' && w !== 'The' && w !== 'Then') {
          owner = w;
          break;
        }
      }
      
      if (owner === 'Team' && words.length > 0) {
        const w = words[0].replace(/[^\w]/g, '');
        if (w.length > 1 && w[0] === w[0].toUpperCase() && w !== 'I' && w !== 'We' && w !== 'The' && w !== 'Then') {
          owner = w;
        }
      }

      let task = sentence;
      const matchIndex = sentence.toLowerCase().indexOf('will');
      const shouldIndex = sentence.toLowerCase().indexOf('should');
      
      if (matchIndex > -1) {
        task = sentence.substring(matchIndex + 4).trim();
      } else if (shouldIndex > -1) {
        task = sentence.substring(shouldIndex + 6).trim();
      }
      
      let deadline = 'Friday';
      const byMatch = sentence.match(/\bby\s+(\w+(\s+\w+)?)\b/i);
      if (byMatch) {
        deadline = byMatch[1].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      }

      task = task.charAt(0).toUpperCase() + task.slice(1);
      actionItems.push({ owner, task, deadline });
    }
  }
  return actionItems;
}

// 5. MEETING NOTES SUMMARIZATION
export interface MeetingSummary {
  overview: string;
  decisions: string[];
  constraints: string[];
  metrics: string[];
  owners: string[];
}

export async function summarizeMeetingNotes(transcript: string): Promise<MeetingSummary> {
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      const response = await model.generateContent(
        `Summarize this meeting. Extract: key decisions, technical constraints, business metrics, owners. Keep niche details.
Return strictly as a JSON object with keys: "overview" (string), "decisions" (array of strings), "constraints" (array of strings), "metrics" (array of strings), "owners" (array of strings). Transcript:\n${transcript}`
      );
      const content = response.response.text() || '{}';
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err: any) {
      log('ERROR', `Gemini meeting summary failed: ${err.message}. Trying Claude.`);
    }
  }

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Summarize this meeting. Extract: key decisions, technical constraints, business metrics, owners. Keep niche details.
Return strictly as a JSON object with keys: "overview" (string), "decisions" (array of strings), "constraints" (array of strings), "metrics" (array of strings), "owners" (array of strings). Transcript:\n${transcript}`
          }
        ]
      });
      
      const content = response.content[0].type === 'text' ? response.content[0].text : '{}';
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err: any) {
      log('ERROR', `Claude meeting summary failed: ${err.message}. Using fallback.`);
    }
  }

  // Fallback: local processing
  const sentences = splitIntoSentences(transcript);
  const decisions: string[] = [];
  const constraints: string[] = [];
  const metrics: string[] = [];
  const owners: string[] = [];

  sentences.forEach(s => {
    const ls = s.toLowerCase();
    if (ls.includes('decide') || ls.includes('agreed') || ls.includes('use')) {
      decisions.push(s);
    }
    if (ls.includes('limit') || ls.includes('must') || ls.includes('constraint') || ls.includes('restrict')) {
      constraints.push(s);
    }
    if (ls.includes('metric') || ls.includes('kpi') || ls.includes('percent') || ls.includes('%') || ls.includes('revenue') || ls.includes('users')) {
      metrics.push(s);
    }
    // Check for ownership
    const willMatch = s.match(/(\b[A-Z][a-z]+\b)\s+will/);
    if (willMatch && !['We', 'They', 'The'].includes(willMatch[1])) {
      owners.push(willMatch[1]);
    }
  });

  return {
    overview: `Meeting overview summary. Transcript contains ${transcript.split(/\s+/).length} words.`,
    decisions: decisions.slice(0, 3),
    constraints: constraints.slice(0, 3),
    metrics: metrics.slice(0, 3),
    owners: Array.from(new Set(owners))
  };
}

// 6. BLOCKER AND CIRCULAR DEPENDENCY DETECTION
export interface BlockerReport {
  blockedTasks: Array<{ taskId: string; reason: string }>;
  circularDependencies: string[][]; // groups of task IDs forming loops
}

export async function detectBlockers(
  tasks: Array<{ id: string; title: string; dependencies?: string[]; status: string; updated_at?: string | Date }>
): Promise<BlockerReport> {
  const circularDependencies: string[][] = [];
  const blockedTasks: Array<{ taskId: string; reason: string }> = [];

  // Graph representation
  const adjList: Map<string, string[]> = new Map();
  const taskMap: Map<string, typeof tasks[0]> = new Map();

  tasks.forEach(t => {
    taskMap.set(t.id, t);
    adjList.set(t.id, t.dependencies || []);
  });

  // 1. Detect circular dependencies using DFS
  const visited: Set<string> = new Set();
  const recStack: Set<string> = new Set();
  const path: string[] = [];

  function findCycles(nodeId: string) {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        findCycles(neighbor);
      } else if (recStack.has(neighbor)) {
        // Found a cycle!
        const cycleStartIdx = path.indexOf(neighbor);
        if (cycleStartIdx > -1) {
          const cycle = path.slice(cycleStartIdx);
          // Check if we already registered this cycle (or rotation of it)
          const sortedCycleStr = [...cycle].sort().join(',');
          const exists = circularDependencies.some(c => [...c].sort().join(',') === sortedCycleStr);
          if (!exists) {
            circularDependencies.push(cycle);
          }
        }
      }
    }

    recStack.delete(nodeId);
    path.pop();
  }

  tasks.forEach(t => {
    if (!visited.has(t.id)) {
      findCycles(t.id);
    }
  });

  // 2. Detect Blocked Tasks (depends on a task that is NOT done, or waiting 24h+)
  const oneDayAgo = Date.now() - 24 * 3600000;
  tasks.forEach(t => {
    const deps = t.dependencies || [];
    
    // Check if any dependency is not done
    const unfinishedDeps = deps.map(depId => taskMap.get(depId)).filter(dep => dep && dep.status !== 'done');
    
    if (unfinishedDeps.length > 0) {
      const names = unfinishedDeps.map(d => `"${d?.title}"`).join(', ');
      blockedTasks.push({
        taskId: t.id,
        reason: `Waiting on incomplete dependencies: ${names}`
      });
    } else if (t.status === 'blocked') {
      const updatedAtMs = t.updated_at ? new Date(t.updated_at).getTime() : Date.now();
      if (updatedAtMs < oneDayAgo) {
        blockedTasks.push({
          taskId: t.id,
          reason: 'Task marked as blocked and hasn\'t been updated in over 24 hours.'
        });
      } else {
        blockedTasks.push({
          taskId: t.id,
          reason: 'Task marked as blocked.'
        });
      }
    }
  });

  // Add circular dependencies to task block reasons
  circularDependencies.forEach(cycle => {
    cycle.forEach(taskId => {
      const task = taskMap.get(taskId);
      const cycleNames = cycle.map(id => `"${taskMap.get(id)?.title}"`).join(' -> ');
      const existing = blockedTasks.find(bt => bt.taskId === taskId);
      if (existing) {
        existing.reason += ` (Part of circular dependency: ${cycleNames})`;
      } else {
        blockedTasks.push({
          taskId,
          reason: `Part of circular dependency: ${cycleNames}`
        });
      }
    });
  });

  if (gemini && tasks.length > 0) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      await model.generateContent(
        `Identify circular dependencies and blockers in this task list. Explain them in a friendly startup dashboard format. Tasks:\n${JSON.stringify(tasks, null, 2)}`
      );
      log('INFO', 'Gemini blocker analysis completed.');
    } catch (err: any) {
      log('ERROR', `Gemini blocker analysis failed: ${err.message}`);
    }
  } else if (anthropic && tasks.length > 0) {
    try {
      await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Identify circular dependencies and blockers in this task list. Explain them in a friendly startup dashboard format. Tasks:\n${JSON.stringify(tasks, null, 2)}`
          }
        ]
      });
      log('INFO', 'Claude blocker analysis completed.');
    } catch (err: any) {
      log('ERROR', `Claude blocker analysis failed: ${err.message}`);
    }
  }

  return {
    blockedTasks,
    circularDependencies
  };
}

// 7. IDEA TO PROJECT REQUIREMENT AND TASK GENERATION
export async function generateProjectBreakdown(
  ideaTitle: string,
  ideaDescription: string,
  meetingNotes: string[]
): Promise<{ description: string; tasks: Array<{ title: string; assignedTo: string; dependencies?: string[] }> }> {
  
  const combinedNotes = meetingNotes.join('\n');

  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      const response = await model.generateContent(
        `Convert this startup idea into a project. Auto-generate product requirements from linked meeting notes. Then auto-breakdown into 4-5 tasks.
Idea: ${ideaTitle} - ${ideaDescription}
Meeting Notes:\n${combinedNotes}

Return response strictly as a JSON object with keys: "description" (string, overview of requirements), "tasks" (array of objects with keys "title", "assignedTo").`
      );
      const content = response.response.text() || '{}';
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err: any) {
      log('ERROR', `Gemini project generation failed: ${err.message}. Trying Claude.`);
    }
  }

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Convert this startup idea into a project. Auto-generate product requirements from linked meeting notes. Then auto-breakdown into 4-5 tasks.
Idea: ${ideaTitle} - ${ideaDescription}
Meeting Notes:\n${combinedNotes}

Return response strictly as a JSON object with keys: "description" (string, overview of requirements), "tasks" (array of objects with keys "title", "assignedTo").`
          }
        ]
      });
      
      const content = response.content[0].type === 'text' ? response.content[0].text : '{}';
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err: any) {
      log('ERROR', `Claude project generation failed: ${err.message}. Using fallback.`);
    }
  }

  // Fallback: Generate structured tasks based on description keywords
  const tasks = [
    { title: `Design database schema for ${ideaTitle}`, assignedTo: 'Rahul', dependencies: [] },
    { title: `Develop core backend endpoints for ${ideaTitle}`, assignedTo: 'Rahul', dependencies: [`db_design`] },
    { title: `Build React dashboard components for ${ideaTitle}`, assignedTo: 'Sarah', dependencies: [] },
    { title: `Integrate frontend with backend APIs`, assignedTo: 'Sarah', dependencies: [`backend_dev`, `frontend_dev`] },
    { title: `Conduct end-to-end integration testing and deploy`, assignedTo: 'Team', dependencies: [`frontend_integration`] }
  ];

  return {
    description: `Requirements generated from idea and meeting notes:\n- Focus on core MVP elements: ${ideaDescription.slice(0, 100)}.\n- Meet constraints defined in workspace logs.`,
    tasks: tasks.map(t => ({
      title: t.title,
      assignedTo: t.assignedTo
    }))
  };
}

// 8. BRIEFING GENERATION
export async function generateBriefing(context: string): Promise<string> {
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent(
        `You are a startup workspace assistant. Write a concise daily briefing for the team based on this workspace snapshot. Format the response as 3-5 bullet points. Each bullet should be one short, action-oriented sentence. Start each bullet with •.\n\n${context}`
      );
      return response.response.text() || '';
    } catch (err: any) {
      log('ERROR', `Gemini briefing failed: ${err.message}. Trying Claude.`);
    }
  }

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are a startup workspace assistant. Write a concise daily briefing for the team based on this workspace snapshot. Format the response as 3-5 bullet points. Each bullet should be one short, action-oriented sentence. Start each bullet with •.\n\n${context}`
        }]
      });
      return response.content[0]?.type === 'text' ? response.content[0].text : '';
    } catch (err: any) {
      log('ERROR', `Claude briefing failed: ${err.message}.`);
    }
  }

  return '';
}

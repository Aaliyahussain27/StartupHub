import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import {
  db,
  DEFAULT_WORKSPACE_ID,
  Message,
  Decision,
  ActionItem,
  Idea,
  Project,
  Task,
  GitHubPR
} from '../db';
import {
  generateEmbedding,
  extractDecision,
  extractActionItems,
  generateProjectBreakdown,
  summarizeMeetingNotes
} from '../services/claude';
import { broadcastDashboardUpdate, getDashboardState } from '../services/socket';

const router = Router();

const log = (level: string, message: string) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] [${level}] [API-ROUTES] - ${message}`);
};

// 1. GET /api/dashboard
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || DEFAULT_WORKSPACE_ID;
    const state = await getDashboardState(workspaceId);
    res.json(state);
  } catch (err) {
    next(err);
  }
});

// 2. GET /api/search
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string;
    const workspaceId = (req.query.workspaceId as string) || DEFAULT_WORKSPACE_ID;

    if (!query || query.trim() === '') {
      res.status(400).json({ error: 'Search query parameter "q" is required.' });
      return;
    }

    log('INFO', `Performing semantic search for query: "${query}"`);
    const queryEmbedding = await generateEmbedding(query);
    const searchResults = await db.vectorSearch(queryEmbedding, workspaceId);
    
    res.json({ query, results: searchResults });
  } catch (err) {
    next(err);
  }
});

// 3. POST /api/ideas
router.post('/ideas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, source } = req.body;
    const workspaceId = req.body.workspaceId || DEFAULT_WORKSPACE_ID;

    if (!title || !description) {
      res.status(400).json({ error: 'Title and description are required.' });
      return;
    }

    log('INFO', `Creating new idea: "${title}"`);
    const textToEmbed = `${title}: ${description}`;
    const embedding = await generateEmbedding(textToEmbed);

    const idea = await db.insertIdea({
      workspace_id: workspaceId,
      title,
      description,
      source: source || 'slack',
      status: 'inbox',
      embedding
    });

    // Notify dashboard
    await broadcastDashboardUpdate(workspaceId);

    res.status(201).json(idea);
  } catch (err) {
    next(err);
  }
});

// 4. POST /webhooks/whatsapp
router.post('/webhooks/whatsapp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Twilio sends body as urlencoded form data, Slack/custom testing may send JSON
    const body = req.body;
    const text = body.Body || body.text;
    const sender = body.From || body.sender || 'WhatsApp User';
    const workspaceId = body.workspaceId || DEFAULT_WORKSPACE_ID;
    const channel = body.channel || 'Twilio Sandbox';

    if (!text) {
      res.status(400).json({ error: 'Webhook payload missing message text.' });
      return;
    }

    log('INFO', `Received WhatsApp webhook from ${sender}: "${text.slice(0, 50)}..."`);

    // 1. Create message ID and save immediately with dummy embedding
    const messageId = uuidv4();
    const timestamp = new Date();
    
    await db.insertMessage({
      id: messageId,
      workspace_id: workspaceId,
      source: 'whatsapp',
      channel,
      sender,
      text,
      embedding: new Array(1536).fill(0),
      timestamp
    });

    // 2. Return 200 OK immediately
    res.status(200).send('OK');

    // 3. Run async background processing
    processMessageAsync(messageId, text, sender, workspaceId, 'whatsapp', channel);
  } catch (err) {
    next(err);
  }
});

// 5. POST /webhooks/slack
router.post('/webhooks/slack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, sender, channel, workspaceId } = req.body;
    const activeWorkspaceId = workspaceId || DEFAULT_WORKSPACE_ID;

    if (!text) {
      res.status(400).json({ error: 'Slack message text is required.' });
      return;
    }

    log('INFO', `Received Slack webhook from ${sender || 'User'}: "${text.slice(0, 50)}..."`);

    const messageId = uuidv4();
    await db.insertMessage({
      id: messageId,
      workspace_id: activeWorkspaceId,
      source: 'slack',
      channel: channel || '#general',
      sender: sender || 'Slack User',
      text,
      embedding: new Array(1536).fill(0),
      timestamp: new Date()
    });

    res.status(200).send('OK');

    processMessageAsync(messageId, text, sender || 'Slack User', activeWorkspaceId, 'slack', channel || '#general');
  } catch (err) {
    next(err);
  }
});

// 6. POST /webhooks/github
router.post('/webhooks/github', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pr_number, title, description, workspaceId } = req.body;
    const activeWorkspaceId = workspaceId || DEFAULT_WORKSPACE_ID;

    if (!pr_number || !title) {
      res.status(400).json({ error: 'PR number and title are required.' });
      return;
    }

    log('INFO', `Received GitHub PR #${pr_number} webhook: "${title}"`);

    // Respond immediately
    res.status(200).send('OK');

    // Process PR async
    setTimeout(async () => {
      try {
        const textToEmbed = `PR #${pr_number} ${title}: ${description || ''}`;
        const embedding = await generateEmbedding(textToEmbed);

        // Find matches to link to active projects if possible
        const projects = await db.getProjects(activeWorkspaceId);
        let linkedProjectId: string | null = null;
        let highestSim = 0;

        for (const p of projects) {
          const pText = `${p.title} ${p.description}`;
          const pEmbed = await generateEmbedding(pText);
          
          // Cosine similarity helper from DB
          const score = cosineSimilarityScore(embedding, pEmbed);
          if (score > highestSim) {
            highestSim = score;
            linkedProjectId = p.id;
          }
        }

        // Link project if similarity is strong (>0.35)
        if (highestSim < 0.35) {
          linkedProjectId = null;
        }

        await db.insertGithubPR({
          workspace_id: activeWorkspaceId,
          pr_number: Number(pr_number),
          title,
          description: description || '',
          linked_project_id: linkedProjectId,
          embedding
        });

        log('INFO', `GitHub PR #${pr_number} saved. Linked to project ID: ${linkedProjectId || 'None'} (Similarity: ${highestSim.toFixed(2)})`);
        await broadcastDashboardUpdate(activeWorkspaceId);
      } catch (err: any) {
        log('ERROR', `Async GitHub PR process failed: ${err.message}`);
      }
    }, 0);
  } catch (err) {
    next(err);
  }
});

// Helper cosine similarity scorer for route comparisons
function cosineSimilarityScore(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < 1536; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return (normA === 0 || normB === 0) ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Async Message Processor Pipeline
async function processMessageAsync(
  messageId: string,
  text: string,
  sender: string,
  workspaceId: string,
  source: 'whatsapp' | 'slack',
  channel: string
) {
  setTimeout(async () => {
    try {
      log('INFO', `Processing message pipeline for message ID: ${messageId}`);
      
      // 1. Generate real embedding
      const embedding = await generateEmbedding(text);
      
      // Update message embedding
      if (db.isFallback()) {
        const messages = await db.getMessages(workspaceId);
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
          msg.embedding = embedding;
        }
      } else {
        await db.query('UPDATE messages SET embedding = $1 WHERE id = $2', [`[${embedding.join(',')}]`, messageId]);
      }

      // 2. Extract decisions
      const decisionText = await extractDecision(text);
      if (decisionText) {
        log('INFO', `Extracted Decision: "${decisionText}"`);
        await db.insertDecision({
          workspace_id: workspaceId,
          decision_text: decisionText,
          source_message_id: messageId,
          embedding
        });
      }

      // 3. Extract action items
      const actionItems = await extractActionItems(text);
      for (const item of actionItems) {
        log('INFO', `Extracted Action Item: ${item.owner} - ${item.task} (by ${item.deadline})`);
        await db.insertActionItem({
          workspace_id: workspaceId,
          owner: item.owner,
          task: item.task,
          deadline: item.deadline,
          status: 'pending'
        });
      }

      // 4. Update Daily Digests if it's the first message of the hour
      // (Simplified MVP: build a digest summary of last 10 messages if requested)
      const allMsgs = await db.getMessages(workspaceId);
      if (allMsgs.length % 5 === 0) {
        log('INFO', 'Generating daily digest summary for last 5 messages.');
        const textLogs = allMsgs.slice(0, 5).map(m => `${m.sender}: ${m.text}`);
        const digestSummary = await summarizeMeetingNotes(textLogs.join('\n'));
        await db.insertDailyDigest({
          workspace_id: workspaceId,
          date: new Date().toISOString().substring(0, 10),
          summary_text: digestSummary.overview
        });
      }

      // 5. Broadcast to Dashboard
      await broadcastDashboardUpdate(workspaceId);
    } catch (err: any) {
      log('ERROR', `Error processing message asynchronously: ${err.message}`);
    }
  }, 0);
}

// 7. POST /api/projects/from-idea/:ideaId
router.post('/projects/from-idea/:ideaId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ideaId } = req.params;
    const { owner, deadline } = req.body;
    const workspaceId = req.body.workspaceId || DEFAULT_WORKSPACE_ID;

    log('INFO', `Converting idea ID ${ideaId} to active project.`);

    // Fetch ideas
    const ideas = await db.getIdeas(workspaceId);
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) {
      res.status(404).json({ error: 'Idea not found.' });
      return;
    }

    // 1. Update idea status to project
    await db.updateIdeaStatus(ideaId, 'project');

    // 2. Fetch related context using embedding similarity search
    const results = await db.vectorSearch(idea.embedding, workspaceId);
    const contextTexts = results
      .filter(r => r.type === 'message' || r.type === 'decision')
      .map(r => r.text);

    // 3. Generate requirements and tasks via Claude (or fallback)
    const breakdown = await generateProjectBreakdown(idea.title, idea.description, contextTexts);

    // 4. Insert project
    const project = await db.insertProject({
      workspace_id: workspaceId,
      idea_id: ideaId,
      title: idea.title,
      description: breakdown.description || idea.description,
      owner: owner || 'Unassigned',
      deadline: deadline || 'Friday',
      status: 'active'
    });

    // 5. Insert tasks
    const createdTasks: Task[] = [];
    for (const t of breakdown.tasks) {
      const task = await db.insertTask({
        workspace_id: workspaceId,
        project_id: project.id,
        title: t.title,
        assigned_to: t.assignedTo || owner || 'Unassigned',
        status: 'todo',
        dependencies: []
      });
      createdTasks.push(task);
    }

    // Trigger blocker check by updating WebSocket
    await broadcastDashboardUpdate(workspaceId);

    res.status(201).json({ project, tasks: createdTasks });
  } catch (err) {
    next(err);
  }
});

// 8. POST /api/pdf/generate
router.post('/pdf/generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
    const { newHireName } = req.body;
    const workspaceId = req.body.workspaceId || DEFAULT_WORKSPACE_ID;

    if (!newHireName) {
      res.status(400).json({ error: 'newHireName parameter is required.' });
      return;
    }

    log('INFO', `Generating onboarding PDF for: ${newHireName}`);

    // Collect dashboard context
    const decisions = await db.getDecisions(workspaceId);
    const actionItems = await db.getActionItems(workspaceId);
    const projects = await db.getProjects(workspaceId);
    const tasks = await db.getTasks(workspaceId);
    const dailyDigests = await db.getDailyDigests(workspaceId);

    // Create jsPDF Document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Palette Colors (User specs)
    // Blue Tide: #97A3AE (RGB: 151, 163, 174)
    // Soft Sand: #DCCCB4 (RGB: 220, 204, 180)
    // Driftwood: #8A5033 (RGB: 138, 80, 51)
    
    // Page 1: COVER PAGE
    doc.setFillColor(151, 163, 174); // Blue Tide background
    doc.rect(0, 0, 210, 297, 'F');
    
    // Accent block
    doc.setFillColor(220, 204, 180); // Soft Sand block
    doc.rect(20, 100, 170, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.text('STARTUP HUB', 20, 90);

    doc.setTextColor(138, 80, 51); // Driftwood for subhead
    doc.setFontSize(18);
    doc.text('AI-Generated Onboarding Brief', 22, 107);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`Prepared for: ${newHireName}`, 20, 140);
    doc.text(`Workspace ID: Default Startup Hub`, 20, 150);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 160);

    doc.setFontSize(10);
    doc.text('Generated by Claude & StartupHub Vector Engine.', 20, 270);

    // Page 2: OVERVIEW
    doc.addPage();
    doc.setFillColor(245, 245, 245); // Off-white page body
    doc.rect(0, 0, 210, 297, 'F');

    // Header bar
    doc.setFillColor(151, 163, 174); // Blue Tide
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Project Overview & Context', 15, 17);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    let y = 40;

    doc.setFont('Helvetica', 'bold');
    doc.text('1. Workspace Activity Digest', 15, y);
    y += 8;
    doc.setFont('Helvetica', 'normal');

    if (dailyDigests.length > 0) {
      dailyDigests.slice(0, 3).forEach((d) => {
        doc.setFont('Helvetica', 'bold');
        doc.text(`Date: ${d.date}`, 15, y);
        y += 6;
        doc.setFont('Helvetica', 'normal');
        
        // Simple wrap text
        const splitText = doc.splitTextToSize(d.summary_text, 180);
        doc.text(splitText, 15, y);
        y += splitText.length * 6 + 4;
      });
    } else {
      doc.text('No digests available yet.', 15, y);
      y += 10;
    }

    y += 5;
    doc.setFont('Helvetica', 'bold');
    doc.text('2. Architectural Constraints & System Boundaries', 15, y);
    y += 8;
    doc.setFont('Helvetica', 'normal');
    
    const constraintsText = [
      '- Frontend deployment managed via Vercel pipeline builds.',
      '- Backend database connectivity utilizes Supabase PostgreSQL + pgvector modules.',
      '- Local fallbacks support offline SQLite/JSON states without requiring active AWS or Supabase setups.'
    ];
    constraintsText.forEach(c => {
      doc.text(c, 15, y);
      y += 6;
    });

    // Page 3: DECISIONS
    doc.addPage();
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setFillColor(151, 163, 174); // Blue Tide
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Key Technical Decisions', 15, 17);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    y = 40;

    doc.setFont('Helvetica', 'bold');
    doc.text('Extracted Decisions Stream', 15, y);
    y += 8;
    doc.setFont('Helvetica', 'normal');

    if (decisions.length > 0) {
      decisions.slice(0, 10).forEach((d, idx) => {
        const dText = `${idx + 1}. ${d.decision_text}`;
        const splitText = doc.splitTextToSize(dText, 180);
        doc.text(splitText, 15, y);
        y += splitText.length * 5 + 4;
      });
    } else {
      doc.text('No formal decisions recorded yet in this workspace.', 15, y);
      y += 10;
    }

    // Page 4: PROJECTS AND ACTION ITEMS
    doc.addPage();
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setFillColor(151, 163, 174); // Blue Tide
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Active Projects & Task Breakdown', 15, 17);

    doc.setTextColor(50, 50, 50);
    y = 40;

    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text('Active Projects', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');

    if (projects.length > 0) {
      projects.forEach(p => {
        doc.setFont('Helvetica', 'bold');
        doc.text(`${p.title} (Owner: ${p.owner}, Deadline: ${p.deadline})`, 15, y);
        y += 5;
        doc.setFont('Helvetica', 'normal');
        
        const descText = doc.splitTextToSize(p.description, 180);
        doc.text(descText, 15, y);
        y += descText.length * 5 + 3;

        // Render project tasks
        const projTasks = tasks.filter(t => t.project_id === p.id);
        if (projTasks.length > 0) {
          doc.setFont('Helvetica', 'italic');
          projTasks.forEach(t => {
            doc.text(`  - [${t.status.toUpperCase()}] ${t.title} (Assigned: ${t.assigned_to})`, 15, y);
            y += 5;
          });
          doc.setFont('Helvetica', 'normal');
        }
        y += 4;
      });
    } else {
      doc.text('No active projects initialized.', 15, y);
      y += 10;
    }

    y += 5;
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text('Outstanding Action Items', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');

    if (actionItems.length > 0) {
      actionItems.slice(0, 8).forEach(item => {
        doc.text(`- [${item.status.toUpperCase()}] ${item.task} (Owner: ${item.owner}, Deadline: ${item.deadline})`, 15, y);
        y += 5;
      });
    } else {
      doc.text('No outstanding action items.', 15, y);
    }

    // Output and return
    const pdfOutput = doc.output('arraybuffer');
    const buffer = Buffer.from(pdfOutput);

    // Save metadata
    await db.insertOnboardingPDF({
      workspace_id: workspaceId,
      new_hire_name: newHireName,
      pdf_url: `/api/pdf/download/${encodeURIComponent(newHireName)}`
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="onboarding_${newHireName.replace(/\s+/g, '_')}.pdf"`);
    res.send(buffer);

  } catch (err) {
    next(err);
  }
});

// Update task status (Helper endpoint for frontend interaction)
router.post('/tasks/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, dependencies } = req.body;
    const workspaceId = req.body.workspaceId || DEFAULT_WORKSPACE_ID;

    log('INFO', `Updating task ${id} status to: ${status}`);
    const updated = await db.updateTask(id, { status, dependencies });

    if (updated) {
      // Re-broadcast dashboard details
      await broadcastDashboardUpdate(workspaceId);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Task not found.' });
    }
  } catch (err) {
    next(err);
  }
});

// GET /briefing
router.get('/briefing', async (req: Request, res: Response, next: NextFunction) => {
  const workspaceId = (req.query.workspaceId as string) || DEFAULT_WORKSPACE_ID;

  try {
    const [decisions, actionItems, tasks, ideas, projects] = await Promise.all([
      db.getDecisions(workspaceId),
      db.getActionItems(workspaceId),
      db.getTasks(workspaceId),
      db.getIdeas(workspaceId),
      db.getProjects(workspaceId),
    ]);

    const { detectBlockers, isClaudeActive } = await import('../services/claude');
    const blockerReport = await detectBlockers(tasks);

    const pendingActions = actionItems.filter((a: any) => a.status !== 'completed');
    const inboxIdeas = ideas.filter((i: any) => i.status === 'inbox');
    const stalledProjects = projects.filter((p: any) => {
      const projTasks = tasks.filter((t: any) => t.project_id === p.id);
      return projTasks.length > 0 && projTasks.filter((t: any) => t.status === 'done').length === 0;
    });

    const context = `
Workspace Snapshot:
- Decisions logged: ${decisions.length}
- Pending action items: ${pendingActions.length} (owners: ${[...new Set(pendingActions.map((a: any) => a.owner))].join(', ') || 'none'})
- Active projects: ${projects.length}
- Stalled projects (no done tasks): ${stalledProjects.map((p: any) => p.title).join(', ') || 'none'}
- Ideas in inbox: ${inboxIdeas.length}
- Blocked tasks: ${blockerReport.blockedTasks.length}
- Recent decisions: ${decisions.slice(0, 3).map((d: any) => d.decision_text).join(' | ')}
- Upcoming deadlines: ${pendingActions.slice(0, 3).map((a: any) => `${a.owner}: "${a.task}" by ${a.deadline}`).join(' | ')}
    `.trim();

    let summary = '';

    if (isClaudeActive()) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
        const response = await client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `You are a startup workspace assistant. Write a concise daily briefing for the team based on this workspace snapshot. Be direct, specific, and action-oriented. 2-3 sentences max.\n\n${context}`
          }]
        });
        summary = response.content[0]?.type === 'text' ? response.content[0].text : '';
      } catch (err: any) {
        log('WARN', `Claude briefing failed: ${err.message}`);
      }
    }

    if (!summary) {
      const parts: string[] = [];
      if (decisions.length > 0) parts.push(`${decisions.length} decision${decisions.length > 1 ? 's' : ''} logged`);
      if (pendingActions.length > 0) parts.push(`${pendingActions.length} pending action item${pendingActions.length > 1 ? 's' : ''}`);
      if (blockerReport.blockedTasks.length > 0) parts.push(`${blockerReport.blockedTasks.length} blocker${blockerReport.blockedTasks.length > 1 ? 's' : ''} need attention`);
      if (inboxIdeas.length > 0) parts.push(`${inboxIdeas.length} idea${inboxIdeas.length > 1 ? 's' : ''} waiting in inbox`);
      summary = parts.length > 0
        ? `Here's what's happening: ${parts.join(', ')}.`
        : 'Your workspace is up to date. No outstanding items.';
    }

    const highlights: Array<{ icon: string; text: string }> = [];
    decisions.slice(0, 2).forEach((d: any) => highlights.push({ icon: 'decision', text: d.decision_text?.slice(0, 80) || 'Decision logged' }));
    blockerReport.blockedTasks.slice(0, 2).forEach((b: any) => highlights.push({ icon: 'blocker', text: b.reason?.slice(0, 80) || 'Task blocked' }));
    pendingActions.slice(0, 2).forEach((a: any) => highlights.push({ icon: 'action', text: `${a.owner}: ${a.task?.slice(0, 60)}` }));
    inboxIdeas.slice(0, 1).forEach((i: any) => highlights.push({ icon: 'idea', text: `Inbox: "${i.title}"` }));

    const hour = new Date().getHours();
    const greetingWord = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    res.json({
      greeting: `${greetingWord}, team! Here's your StartupHub briefing.`,
      summary,
      highlights: highlights.slice(0, 6),
      generatedAt: new Date().toISOString(),
    });

  } catch (err: any) {
    log('ERROR', `Briefing failed: ${err.message}`);
    next(err);
  }
});

// POST /action-items/:id/status
router.post('/action-items/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, workspaceId } = req.body;
    const activeWorkspaceId = workspaceId || DEFAULT_WORKSPACE_ID;

    const updated = await db.updateActionItemStatus(id, status as 'pending' | 'completed');
    if (updated) {
      await broadcastDashboardUpdate(activeWorkspaceId);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Action item not found.' });
    }
  } catch (err) {
    next(err);
  }
});

export default router;

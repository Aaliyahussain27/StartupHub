// ============================================================
// ADD THIS ROUTE to your backend/src/routes/api.ts
// It goes alongside your other GET /api/... routes
// ============================================================

// GET /api/briefing
// Generates an AI daily briefing from current workspace state
router.get('/api/briefing', async (req: Request, res: Response) => {
  const workspaceId = (req.query.workspaceId as string) || DEFAULT_WORKSPACE_ID;
  const log = (level: string, msg: string) => console.log(`[BRIEFING] [${level}] ${msg}`);

  try {
    // Gather current workspace state
    const [decisions, actionItems, tasks, ideas, projects] = await Promise.all([
      db.getDecisions(workspaceId),
      db.getActionItems(workspaceId),
      db.getTasks(workspaceId),
      db.getIdeas(workspaceId),
      db.getProjects(workspaceId),
    ]);

    const blockerReport = await detectBlockers(tasks);

    // Build context string for Claude
    const pendingActions = actionItems.filter((a: any) => a.status !== 'completed');
    const inboxIdeas = ideas.filter((i: any) => i.status === 'inbox');
    const stalledProjects = projects.filter((p: any) => {
      const projTasks = tasks.filter((t: any) => t.project_id === p.id);
      const doneTasks = projTasks.filter((t: any) => t.status === 'done').length;
      return projTasks.length > 0 && doneTasks === 0;
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
    const highlights: Array<{ icon: string; text: string }> = [];

    if (isClaudeActive()) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        // We already have the client initialized in claude.ts — reuse summarizeMessages
        const { summarizeMessages } = require('./claude');

        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.CLAUDE_API_KEY || '',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 400,
            messages: [{
              role: 'user',
              content: `You are a startup workspace assistant. Write a concise daily briefing for the team based on this workspace snapshot. Be direct, specific, and action-oriented. 2-3 sentences max for the summary.\n\n${context}`
            }]
          })
        });

        const data = await claudeResponse.json() as any;
        summary = data.content?.[0]?.text || '';
      } catch (err: any) {
        log('WARN', `Claude briefing failed: ${err.message}. Using fallback.`);
      }
    }

    // Fallback summary if Claude not available or failed
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

    // Build highlights
    decisions.slice(0, 2).forEach((d: any) => {
      highlights.push({ icon: 'decision', text: d.decision_text?.slice(0, 80) || 'Decision logged' });
    });
    blockerReport.blockedTasks.slice(0, 2).forEach((b: any) => {
      highlights.push({ icon: 'blocker', text: b.reason?.slice(0, 80) || 'Task blocked' });
    });
    pendingActions.slice(0, 2).forEach((a: any) => {
      highlights.push({ icon: 'action', text: `${a.owner}: ${a.task?.slice(0, 60)}` });
    });
    inboxIdeas.slice(0, 1).forEach((i: any) => {
      highlights.push({ icon: 'idea', text: `Inbox: "${i.title}"` });
    });

    const hour = new Date().getHours();
    const greetingWord = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    res.json({
      greeting: `${greetingWord}, team! Here's your StartupHub briefing.`,
      summary,
      highlights: highlights.slice(0, 6),
      generatedAt: new Date().toISOString(),
    });

  } catch (err: any) {
    log('ERROR', `Briefing generation failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate briefing', message: err.message });
  }
});

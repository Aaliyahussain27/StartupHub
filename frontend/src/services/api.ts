const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface SearchResult {
  type: 'message' | 'decision' | 'github_pr' | 'idea';
  id: string;
  text: string;
  score: number;
  details: any;
}

export const api = {
  // 1. Get Dashboard (in case we need to pull manually)
  getDashboard: async (workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/dashboard?workspaceId=${workspaceId}`);
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    return res.json();
  },

  // 2. Search query
  search: async (query: string, workspaceId: string = '00000000-0000-0000-0000-000000000000'): Promise<SearchResult[]> => {
    const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}&workspaceId=${workspaceId}`);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return data.results || [];
  },

  // 3. Create Idea
  createIdea: async (title: string, description: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, workspaceId, source: 'slack' })
    });
    if (!res.ok) throw new Error('Failed to create idea');
    return res.json();
  },

  // 4. Convert Idea to Project
  convertIdeaToProject: async (ideaId: string, owner: string, deadline: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/projects/from-idea/${ideaId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, deadline, workspaceId })
    });
    if (!res.ok) throw new Error('Failed to convert idea to project');
    return res.json();
  },

  // 5. Update Task Status
  updateTaskStatus: async (taskId: string, status: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, workspaceId })
    });
    if (!res.ok) throw new Error('Failed to update task status');
    return res.json();
  },

  // 6. Generate PDF and trigger browser file download
  generatePDF: async (newHireName: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/pdf/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newHireName, workspaceId })
    });
    if (!res.ok) throw new Error('Failed to generate onboarding PDF');
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `onboarding_${newHireName.replace(/\s+/g, '_')}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // WEBHOOK SIMULATION (For testing webhooks locally!)
  simulateWhatsApp: async (text: string, sender: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Body: text, From: sender, workspaceId })
    });
    if (!res.ok) throw new Error('Simulating WhatsApp webhook failed');
    return res.text();
  },

  simulateSlack: async (text: string, sender: string, channel: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/webhooks/slack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sender, channel, workspaceId })
    });
    if (!res.ok) throw new Error('Simulating Slack webhook failed');
    return res.text();
  },

  simulateGitHub: async (prNumber: number, title: string, description: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/webhooks/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pr_number: prNumber, title, description, workspaceId })
    });
    if (!res.ok) throw new Error('Simulating GitHub webhook failed');
    return res.text();
  }
};

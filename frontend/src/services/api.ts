const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

export interface SearchResult {
  type: 'message' | 'decision' | 'github_pr' | 'idea';
  id: string;
  text: string;
  score: number;
  details: any;
}

export interface SimilarIdea {
  id: string;
  title: string;
  description: string;
  status: string;
  score: number;
  created_at: string;
}

export interface CreateIdeaResponse {
  idea: {
    id: string;
    title: string;
    description: string;
    status: string;
    source: string;
    created_at: string;
  };
  similar: SimilarIdea[];
}

const getHeaders = (extraHeaders: Record<string, string> = {}) => {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = localStorage.getItem('sh-auth-token');

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

export const api = {
  // Auth API Methods
  register: async (email: string, password: string) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },

  login: async (email: string, password: string) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  getCurrentUser: async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Unauthenticated');
    return res.json();
  },

  getUsers: async (workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/users?workspaceId=${workspaceId}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch workspace users');
    return res.json();
  },

  // 1. Get Dashboard (in case we need to pull manually)
  getDashboard: async (workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/dashboard?workspaceId=${workspaceId}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    return res.json();
  },

  // 2. Search query
  search: async (query: string, workspaceId: string = '00000000-0000-0000-0000-000000000000'): Promise<SearchResult[]> => {
    const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}&workspaceId=${workspaceId}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return data.results || [];
  },

  // 3. Create Idea
  createIdea: async (title: string, description: string, workspaceId: string = '00000000-0000-0000-0000-000000000000'): Promise<CreateIdeaResponse> => {
    const res = await fetch(`${BACKEND_URL}/api/ideas`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title, description, workspaceId, source: 'slack' })
    });
    if (!res.ok) throw new Error('Failed to create idea');
    return res.json();
  },

  // 3b. Find similar ideas
  getSimilarIdeas: async (ideaId: string, workspaceId: string = '00000000-0000-0000-0000-000000000000'): Promise<SimilarIdea[]> => {
    const res = await fetch(`${BACKEND_URL}/api/ideas/${ideaId}/similar?workspaceId=${workspaceId}`);
    if (!res.ok) throw new Error('Failed to fetch similar ideas');
    const data = await res.json();
    return data.similar || [];
  },

  // 3c. Merge duplicate into existing idea (keeps ideaId, archives mergeId)
  mergeIdeas: async (keepId: string, mergeId: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/ideas/${keepId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mergeId, workspaceId })
    });
    if (!res.ok) throw new Error('Failed to merge ideas');
    return res.json();
  },

  // 3d. Related messages for an idea (semantic similarity)
  getRelatedMessages: async (ideaId: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/ideas/${ideaId}/related-messages?workspaceId=${workspaceId}`);
    if (!res.ok) throw new Error('Failed to fetch related messages');
    const data = await res.json();
    return (data.related || []) as Array<{
      id: string; text: string; sender: string; source: string;
      channel: string; timestamp: string; score: number;
    }>;
  },

  // 3e. Related meetings for an idea (semantic similarity)
  getRelatedMeetings: async (ideaId: string, workspaceId: string = '00000000-0000-0000-0000-000000000000'): Promise<Array<{
    id: string; title: string; duration_seconds: number; processed: boolean; score: number; created_at: string;
  }>> => {
    const res = await fetch(`${BACKEND_URL}/api/ideas/${ideaId}/related-meetings?workspaceId=${workspaceId}`);
    if (!res.ok) throw new Error('Failed to fetch related meetings');
    return res.json();
  },

  // 4. Convert Idea to Project
  convertIdeaToProject: async (ideaId: string, owner: string, deadline: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/projects/from-idea/${ideaId}`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ owner, deadline, workspaceId })
    });
    if (!res.ok) throw new Error('Failed to convert idea to project');
    return res.json();
  },

  // 5. Update Task Status
  updateTaskStatus: async (taskId: string, status: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}/status`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, workspaceId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update task status');
    }
    return res.json();
  },

  // 6. Generate PDF and trigger browser file download
  generatePDF: async (newHireName: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/pdf/generate`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ Body: text, From: sender, workspaceId })
    });
    if (!res.ok) throw new Error('Simulating WhatsApp webhook failed');
    return res.text();
  },

  simulateSlack: async (text: string, sender: string, channel: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/webhooks/slack`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text, sender, channel, workspaceId })
    });
    if (!res.ok) throw new Error('Simulating Slack webhook failed');
    return res.text();
  },

  simulateGitHub: async (prNumber: number, title: string, description: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/webhooks/github`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ pr_number: prNumber, title, description, workspaceId })
    });
    if (!res.ok) throw new Error('Simulating GitHub webhook failed');
    return res.text();
  },

  updateActionItemStatus: async (itemId: string, status: 'pending' | 'completed', workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/action-items/${itemId}/status`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, workspaceId })
    });
    if (!res.ok) throw new Error('Failed to update action item status');
    return res.json();
  },

  // Add Task API Method
  createTask: async (projectId: string, title: string, assignedTo: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/tasks`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ projectId, title, assignedTo, workspaceId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create task');
    }
    return res.json();
  },

  // Project Settings Update API Method
  updateProjectSettings: async (projectId: string, settings: { owner?: string; deadline?: string; title?: string; description?: string; status?: string }, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/projects/${projectId}/settings`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...settings, workspaceId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update project settings');
    }
    return res.json();
  },

  getAssistantGuidance: async (ideaId: string, workspaceId: string = '00000000-0000-0000-0000-000000000000') => {
    const res = await fetch(`${BACKEND_URL}/api/ideas/${ideaId}/assistant-guidance?workspaceId=${workspaceId}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch assistant guidance');
    return res.json();
  }
};

import { create } from 'zustand';

interface AppState {
  theme: string;
  currentUser: any | null;
  activeProject: any | null;
  activeTool: 'briefing' | 'onboarding' | 'simulator' | 'comms' | 'meetings' | null;
  activeIdea: any | null;
  
  // Actions
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
  setCurrentUser: (user: any | null) => void;
  setActiveProject: (project: any | null) => void;
  setActiveTool: (tool: 'briefing' | 'onboarding' | 'simulator' | 'comms' | 'meetings' | null) => void;
  setActiveIdea: (idea: any | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: localStorage.getItem('sh-theme') || 'dark',
  currentUser: null,
  activeProject: null,
  activeTool: null,
  activeIdea: null,

  setTheme: (theme: string) => {
    localStorage.setItem('sh-theme', theme);
    set({ theme });
  },
  
  toggleTheme: () => set((state: AppState) => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('sh-theme', nextTheme);
    const root = window.document.documentElement;
    if (nextTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    return { theme: nextTheme };
  }),

  setCurrentUser: (user: any | null) => set({ currentUser: user }),
  
  setActiveProject: (project: any | null) => set({
    activeProject: project,
    activeTool: null,
    activeIdea: null
  }),
  
  setActiveTool: (tool: 'briefing' | 'onboarding' | 'simulator' | 'comms' | 'meetings' | null) => set({
    activeTool: tool,
    activeProject: null,
    activeIdea: null
  }),
  
  setActiveIdea: (idea: any | null) => set({
    activeIdea: idea,
    activeTool: null,
    activeProject: null
  })
}));

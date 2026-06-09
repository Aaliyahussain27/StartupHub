import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Use backend port 3001, or custom environment url
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function useWebSocket(workspaceId: string = '00000000-0000-0000-0000-000000000000') {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log(`[SOCKET] Connecting to backend at: ${BACKEND_URL}`);
    const newSocket = io(BACKEND_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('[SOCKET] Connected successfully. Joining workspace:', workspaceId);
      newSocket.emit('join_workspace', workspaceId);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[SOCKET] Disconnected from server.');
    });

    newSocket.on('dashboard_update', (data: any) => {
      console.log('[SOCKET] Received real-time dashboard update:', data);
      setDashboardData(data);
    });

    return () => {
      newSocket.close();
    };
  }, [workspaceId]);

  return { isConnected, dashboardData, socket };
}

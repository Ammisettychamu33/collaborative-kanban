import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { token, activeTenant } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setOnlineUsers([]);
      return;
    }

    // Initialize Socket
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected with id:', socket.id);

      // Join tenant room if tenant is already active
      if (activeTenant?.id) {
        socket.emit('join:tenant', { tenantId: activeTenant.id }, (res) => {
          if (!res?.success) {
            console.warn('[Socket] Failed to join tenant room:', res?.error);
          }
        });
      }
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      console.warn('[Socket] Connection error:', err.message);
    });

    socket.on('presence:update', (data) => {
      if (data.tenantId === activeTenant?.id) {
        setOnlineUsers(data.onlineUsers || []);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // When activeTenant switches, join the new tenant room
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && isConnected && activeTenant?.id) {
      setOnlineUsers([]); // Clear previous tenant presence
      socket.emit('join:tenant', { tenantId: activeTenant.id }, (res) => {
        if (!res?.success) {
          console.warn('[Socket] Tenant switch room join failed:', res?.error);
        }
      });
    }
  }, [activeTenant?.id, isConnected]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        onlineUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

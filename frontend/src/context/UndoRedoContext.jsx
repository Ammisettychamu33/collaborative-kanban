import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

const UndoRedoContext = createContext(null);

export function UndoRedoProvider({ children }) {
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const pushAction = useCallback((action) => {
    // action: { type: 'MOVE' | 'EDIT', taskId, payload, inversePayload, version }
    setPast((prev) => [...prev.slice(-20), action]); // keep last 20 actions
    setFuture([]); // clear redo stack on new action
  }, []);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  const undo = useCallback(
    async (currentTaskGetter, onTaskUpdated) => {
      if (past.length === 0 || isProcessing) return;

      const action = past[past.length - 1];
      const newPast = past.slice(0, -1);
      setIsProcessing(true);

      try {
        const currentTask = currentTaskGetter ? currentTaskGetter(action.taskId) : null;
        const currentVersion = currentTask?.version || action.version;

        const res = await api.post(`/tasks/${action.taskId}/undo`, {
          ...action.inversePayload,
          version: currentVersion,
        });

        if (onTaskUpdated) {
          onTaskUpdated(res.data);
        }

        setPast(newPast);
        setFuture((prev) => [action, ...prev]);
      } catch (err) {
        console.error('[Undo] Undo failed:', err.response?.data?.error || err.message);
        alert(err.response?.data?.error || 'Undo failed due to a concurrent conflict.');
      } finally {
        setIsProcessing(false);
      }
    },
    [past, isProcessing]
  );

  const redo = useCallback(
    async (currentTaskGetter, onTaskUpdated) => {
      if (future.length === 0 || isProcessing) return;

      const action = future[0];
      const newFuture = future.slice(1);
      setIsProcessing(true);

      try {
        const currentTask = currentTaskGetter ? currentTaskGetter(action.taskId) : null;
        const currentVersion = currentTask?.version || action.version;

        const res = await api.post(`/tasks/${action.taskId}/undo`, {
          ...action.payload,
          version: currentVersion,
        });

        if (onTaskUpdated) {
          onTaskUpdated(res.data);
        }

        setPast((prev) => [...prev, action]);
        setFuture(newFuture);
      } catch (err) {
        console.error('[Redo] Redo failed:', err.response?.data?.error || err.message);
        alert(err.response?.data?.error || 'Redo failed due to a concurrent conflict.');
      } finally {
        setIsProcessing(false);
      }
    },
    [future, isProcessing]
  );

  return (
    <UndoRedoContext.Provider
      value={{
        canUndo: past.length > 0 && !isProcessing,
        canRedo: future.length > 0 && !isProcessing,
        pushAction,
        undo,
        redo,
        clearHistory,
      }}
    >
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedo must be used within an UndoRedoProvider');
  }
  return context;
}

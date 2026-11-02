import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider, useSocket } from './context/SocketContext.jsx';
import { UndoRedoProvider, useUndoRedo } from './context/UndoRedoContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { BoardHeader } from './components/BoardHeader.jsx';
import { KanbanBoard } from './components/KanbanBoard.jsx';
import { LoginPage } from './components/LoginPage.jsx';
import { CreateBoardModal } from './components/CreateBoardModal.jsx';
import { ActivityLogDrawer } from './components/ActivityLogDrawer.jsx';
import { MembersModal } from './components/MembersModal.jsx';
import api from './services/api.js';
import { Loader2, Plus, FolderKanban, CheckCircle, AlertTriangle } from 'lucide-react';

function KanbanApp() {
  const { user, activeOrg, activeTenant, activeRole, isLoading } = useAuth();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  const [boards, setBoards] = useState([]);
  const [activeBoard, setActiveBoard] = useState(null);
  const [loadingBoards, setLoadingBoards] = useState(false);

  // Modals & Drawers
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Fetch boards when tenant changes
  const fetchBoards = useCallback(async () => {
    if (!activeTenant?.id) {
      setBoards([]);
      setActiveBoard(null);
      return;
    }

    try {
      setLoadingBoards(true);
      const res = await api.get('/boards');
      const fetchedBoards = res.data.data || [];
      setBoards(fetchedBoards);

      // Select first board or retain currently active if it exists in new list
      if (fetchedBoards.length > 0) {
        setActiveBoard((prev) => {
          if (prev && fetchedBoards.some((b) => b.id === prev.id)) {
            return prev;
          }
          return fetchedBoards[0];
        });
      } else {
        setActiveBoard(null);
      }
    } catch (err) {
      console.error('[App] Failed to fetch boards for tenant:', err.message);
      setBoards([]);
      setActiveBoard(null);
    } finally {
      setLoadingBoards(false);
    }
  }, [activeTenant?.id]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  // Global Keyboard Shortcuts (Ctrl+Z for Undo, Ctrl+Y for Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          if (canRedo) redo();
        } else {
          e.preventDefault();
          if (canUndo) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-sky-400 mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-300">
          Initializing Multi-Tenant Session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleBoardCreated = (newBoard) => {
    setBoards((prev) => [...prev, newBoard]);
    setActiveBoard(newBoard);
    showToast(`Board "${newBoard.name}" created!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        onOpenActivity={() => setIsActivityOpen(true)}
        onOpenMembers={() => setIsMembersOpen(true)}
        onUndo={() => undo()}
        onRedo={() => redo()}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {loadingBoards ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-3" />
            <span className="text-xs">Loading branch boards...</span>
          </div>
        ) : boards.length === 0 ? (
          /* Empty Boards State */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="glass-panel p-8 max-w-md w-full rounded-2xl border border-slate-800 text-center space-y-4 shadow-2xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <FolderKanban className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">No Boards in {activeTenant?.name}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Start tracking progress by creating the first collaborative board for this tenant branch.
                </p>
              </div>

              {(activeRole === 'ORG_ADMIN' || activeRole === 'TENANT_ADMIN') && (
                <button
                  onClick={() => setIsCreateBoardOpen(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-lg shadow-sky-500/20 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Board</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Active Board Workspace */
          <>
            <BoardHeader
              boards={boards}
              activeBoard={activeBoard}
              onSelectBoard={(boardId) => {
                const b = boards.find((item) => item.id === boardId);
                if (b) setActiveBoard(b);
              }}
              onOpenCreateBoard={() => setIsCreateBoardOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              priorityFilter={priorityFilter}
              onPriorityChange={setPriorityFilter}
            />

            {activeBoard && (
              <KanbanBoard
                key={activeBoard.id}
                activeBoard={activeBoard}
                searchQuery={searchQuery}
                priorityFilter={priorityFilter}
                onNotification={(notif) => showToast(notif.message, notif.type)}
              />
            )}
          </>
        )}
      </main>

      {/* Create Board Modal */}
      <CreateBoardModal
        isOpen={isCreateBoardOpen}
        onClose={() => setIsCreateBoardOpen(false)}
        onCreated={handleBoardCreated}
      />

      {/* Activity Log Drawer */}
      <ActivityLogDrawer
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
      />

      {/* Branch Members RBAC Modal */}
      <MembersModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-xs font-medium animate-slide-up">
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-slate-200">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <UndoRedoProvider>
          <KanbanApp />
        </UndoRedoProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

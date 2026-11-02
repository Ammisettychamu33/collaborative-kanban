import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginPage } from '../components/LoginPage.jsx';
import { TaskCard } from '../components/TaskCard.jsx';
import { ConflictModal } from '../components/ConflictModal.jsx';
import { Column } from '../components/Column.jsx';

// Mock AuthContext
const mockLogin = vi.fn();
const mockRegister = vi.fn();
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    loading: false,
    user: null,
  }),
}));

describe('Frontend UI & Kanban Components', () => {
  it('renders LoginPage with title and demo evaluator personas', () => {
    render(<LoginPage />);

    expect(screen.getByText(/Real-Time Collaborative Kanban/i)).toBeInTheDocument();
    expect(screen.getByText(/One-Click Evaluator Personas/i)).toBeInTheDocument();
    expect(screen.getByText(/Acme Org Admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Hyderabad Branch Admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Bangalore Branch Admin/i)).toBeInTheDocument();
  });

  it('clicking demo button in LoginPage calls login with demo credentials', () => {
    render(<LoginPage />);

    const hyderabadBtn = screen.getByText(/Hyderabad Branch Admin/i);
    fireEvent.click(hyderabadBtn);

    expect(mockLogin).toHaveBeenCalledWith('admin.hyd@example.com', 'Password123!');
  });

  it('TaskCard displays title, priority, and OCC version badge', () => {
    const mockTask = {
      id: 'task-101',
      title: 'Implement Multi-Tenant Architecture',
      description: 'Ensure strict tenant isolation across all endpoints',
      priority: 'URGENT',
      version: 3,
      dueDate: '2026-12-31T00:00:00.000Z',
      assignee: { name: 'Ammi Setty' },
    };

    render(<TaskCard task={mockTask} onClick={() => {}} />);

    expect(screen.getByText('Implement Multi-Tenant Architecture')).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('Ammi')).toBeInTheDocument();
  });

  it('ConflictModal displays HTTP 409 OCC warning and authoritative state', () => {
    const conflict = {
      attemptedVersion: 2,
      currentTask: {
        title: 'Authoritative Server Task',
        version: 3,
        priority: 'HIGH',
      },
    };

    const handleRefresh = vi.fn();
    const handleClose = vi.fn();

    render(
      <ConflictModal conflict={conflict} onClose={handleClose} onRefresh={handleRefresh} />
    );

    expect(screen.getByText(/Concurrency Conflict Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 409 Optimistic Concurrency Control/i)).toBeInTheDocument();
    expect(screen.getByText('Authoritative Server Task')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();

    const reloadBtn = screen.getByText(/Reload Latest State/i);
    fireEvent.click(reloadBtn);
    expect(handleRefresh).toHaveBeenCalled();
  });

  it('Column renders column name and task counter badge', () => {
    const mockColumn = {
      id: 'col-1',
      name: 'In Progress',
    };
    const mockTasks = [
      { id: 't1', title: 'Task 1', priority: 'LOW', version: 1 },
      { id: 't2', title: 'Task 2', priority: 'HIGH', version: 2 },
    ];

    render(
      <Column
        column={mockColumn}
        tasks={mockTasks}
        onTaskClick={() => {}}
        onAddTask={() => {}}
      />
    );

    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Count badge
  });
});

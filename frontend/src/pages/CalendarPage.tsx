import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Task, TaskCreate, TaskUpdate, TaskPriority, CalendarMilestone } from '../types';
import { PRIORITY_LABELS } from '../types';
import { api } from '../api';
import TaskForm from '../components/TaskForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── helpers ────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function sameDay(a: string, b: string) { return a.slice(0, 10) === b.slice(0, 10); }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#3b82f6',
  low: '#6b7280',
};

type ViewMode = 'month' | 'week';

// ── CalendarPage ───────────────────────────────────────────────────
export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState<ViewMode>('month');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<CalendarMilestone[]>([]);
  const [editTask, setEditTask] = useState<Task | null>(null);

  // Quick-add state
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);

  // ── date range for API ──
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === 'week') {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      return { rangeStart: fmtDate(weekStart), rangeEnd: fmtDate(end) };
    }
    // Month view — include surrounding days visible on the grid
    const first = new Date(year, month, 1);
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - first.getDay());
    const last = new Date(year, month + 1, 0);
    const gridEnd = new Date(last);
    gridEnd.setDate(gridEnd.getDate() + (6 - last.getDay()));
    return { rangeStart: fmtDate(gridStart), rangeEnd: fmtDate(gridEnd) };
  }, [year, month, view, weekStart]);

  const fetchTasks = useCallback(async () => {
    const [t, m] = await Promise.all([
      api.listCalendarTasks(rangeStart, rangeEnd),
      api.listCalendarMilestones(rangeStart, rangeEnd),
    ]);
    setTasks(t);
    setMilestones(m);
  }, [rangeStart, rangeEnd]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── navigation ──
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    setWeekStart(d);
  };

  // ── effective date for a task ──
  const effectiveDate = (t: Task) => (t.scheduled_date || t.due_date || '')?.slice(0, 10);

  // ── task map by date ──
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      const d = effectiveDate(t);
      if (d) { (map[d] ||= []).push(t); }
    }
    return map;
  }, [tasks]);

  // ── milestone map by date ──
  const milestonesByDate = useMemo(() => {
    const map: Record<string, CalendarMilestone[]> = {};
    for (const m of milestones) {
      const d = (m.due_date || '')?.slice(0, 10);
      if (d) { (map[d] ||= []).push(m); }
    }
    return map;
  }, [milestones]);

  // ── drag handlers ──
  const handleDragStart = (taskId: string) => setDragId(taskId);
  const handleDrop = async (date: string) => {
    if (!dragId) return;
    await api.updateTask(dragId, { scheduled_date: date });
    setDragId(null);
    fetchTasks();
  };

  // ── quick-add ──
  const handleQuickAdd = async () => {
    if (!quickAddTitle.trim() || !quickAddDate) return;
    await api.createTask({ title: quickAddTitle.trim(), scheduled_date: quickAddDate });
    setQuickAddTitle('');
    setQuickAddDate(null);
    fetchTasks();
  };

  // ── edit save ──
  const handleEditSave = async (id: string, data: TaskUpdate) => {
    await api.updateTask(id, data);
    setEditTask(null);
    fetchTasks();
  };

  // ── build grid cells ──
  const cells: { date: Date; dateStr: string; isToday: boolean; isCurrentMonth: boolean }[] = useMemo(() => {
    if (view === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return { date: d, dateStr: fmtDate(d), isToday: fmtDate(d) === fmtDate(today), isCurrentMonth: true };
      });
    }
    const first = new Date(year, month, 1);
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - first.getDay());
    const result: typeof cells = [];
    const d = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      result.push({
        date: new Date(d),
        dateStr: fmtDate(d),
        isToday: fmtDate(d) === fmtDate(today),
        isCurrentMonth: d.getMonth() === month,
      });
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [year, month, view, weekStart]);

  // ── render ──
  return (
    <div className="page">
      <div className="page-header">
        <h2>Calendar</h2>
        <div className="cal-controls">
          <Button variant="ghost" size="sm" onClick={goToday}>Today</Button>
          <Button variant="ghost" size="sm" onClick={view === 'month' ? prevMonth : prevWeek}>◀</Button>
          <span className="cal-title">
            {view === 'month'
              ? `${MONTH_NAMES[month]} ${year}`
              : `Week of ${fmtDate(weekStart)}`}
          </span>
          <Button variant="ghost" size="sm" onClick={view === 'month' ? nextMonth : nextWeek}>▶</Button>
          <Select value={view} onValueChange={v => setView(v as ViewMode)}>
            <SelectTrigger className="w-auto" title="View mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`cal-grid ${view === 'week' ? 'cal-grid-week' : ''}`}>
        {/* Weekday headers */}
        {WEEKDAYS.map(w => <div key={w} className="cal-header">{w}</div>)}

        {/* Day cells */}
        {cells.map(cell => (
          <div
            key={cell.dateStr}
            className={`cal-cell${cell.isToday ? ' cal-today' : ''}${!cell.isCurrentMonth ? ' cal-outside' : ''}`}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(cell.dateStr)}
            onClick={() => { setQuickAddDate(cell.dateStr); setQuickAddTitle(''); }}
          >
            <div className="cal-date-num">{cell.date.getDate()}</div>
            <div className="cal-tasks">
              {/* Milestone deadlines */}
              {(milestonesByDate[cell.dateStr] || []).map(m => (
                <div
                  key={`ms-${m.id}`}
                  className={`cal-milestone-chip${m.is_major ? ' cal-ms-major' : ''}`}
                  onClick={e => e.stopPropagation()}
                  title={`Milestone: ${m.title}\nProject: ${m.project_name}\n${m.is_major ? 'Major' : 'Minor'} · ${m.status}`}
                >
                  <span className="cal-ms-icon">{m.is_major ? '◆' : '◇'}</span>
                  <span className="cal-task-label">{m.title}</span>
                </div>
              ))}
              {/* Task chips */}
              {(tasksByDate[cell.dateStr] || []).map(t => (
                <div
                  key={t.id}
                  className="cal-task-chip"
                  draggable
                  onDragStart={() => handleDragStart(t.id)}
                  onClick={e => { e.stopPropagation(); setEditTask(t); }}
                  title={`${t.title}\n${PRIORITY_LABELS[t.priority]}${t.project ? `\nProject: ${t.project}` : ''}`}
                >
                  <span className="cal-task-dot" style={{ background: PRIORITY_COLORS[t.priority] }} />
                  <span className="cal-task-label">{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick-add overlay */}
      {quickAddDate && (
        <div className="cal-quick-add-overlay" onClick={() => setQuickAddDate(null)}>
          <div className="cal-quick-add" onClick={e => e.stopPropagation()}>
            <div className="cal-quick-add-header">
              <span>Add task for <strong>{quickAddDate}</strong></span>
              <Button variant="ghost" size="sm" onClick={() => setQuickAddDate(null)}>✕</Button>
            </div>
            <form className="cal-quick-add-form" onSubmit={e => { e.preventDefault(); handleQuickAdd(); }}>
              <Input
                type="text"
                placeholder="Task title…"
                value={quickAddTitle}
                onChange={e => setQuickAddTitle(e.target.value)}
                autoFocus
              />
              <Button variant="default" size="sm" type="submit" disabled={!quickAddTitle.trim()}>Add</Button>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTask && (
        <TaskForm task={editTask} onSave={handleEditSave} onClose={() => setEditTask(null)} />
      )}
    </div>
  );
}

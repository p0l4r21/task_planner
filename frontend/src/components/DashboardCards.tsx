import type { DashboardSummary } from '../types';

interface Props {
  summary: DashboardSummary | null;
}

export default function DashboardCards({ summary }: Props) {
  if (!summary) return <div className="dashboard-cards">Loading...</div>;

  const cards = [
    { label: 'Today', value: summary.today_count, cls: 'card-today' },
    { label: 'In Progress', value: summary.in_progress_count, cls: 'card-progress' },
    { label: 'Blocked', value: summary.blocked_count, cls: 'card-blocked' },
    { label: 'This Week', value: summary.this_week_count, cls: 'card-week' },
    { label: 'Incoming', value: summary.incoming_count, cls: 'card-incoming' },
    { label: 'Backlog', value: summary.backlog_count, cls: 'card-backlog' },
    { label: 'Active Total', value: summary.active_count, cls: 'card-active' },
    { label: 'Done This Week', value: summary.completed_this_week, cls: 'card-done' },
  ];

  return (
    <div className="dashboard-cards">
      {cards.map(c => (
        <div key={c.label} className={`summary-card ${c.cls}`}>
          <div className="card-value">{c.value}</div>
          <div className="card-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

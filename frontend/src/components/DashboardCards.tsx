import type { DashboardSummary } from '../types';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  summary: DashboardSummary | null;
}

export default function DashboardCards({ summary }: Props) {
  if (!summary) return <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5 mb-4">Loading...</div>;

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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5 mb-4">
      {cards.map(c => (
        <Card key={c.label} size="sm" className={`text-center ${c.cls}`}>
          <CardContent>
            <div className="card-value text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

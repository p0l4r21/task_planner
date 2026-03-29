import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="page">
      <h2>Settings</h2>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Task Planner v1.0 — Local-first task management for operational work.</p>
          <p>Data is stored in CSV files under <code className="rounded bg-muted px-1.5 py-0.5 text-xs">backend/data/</code>.</p>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Data Files</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-6 space-y-1">
            <li><code className="rounded bg-muted px-1.5 py-0.5 text-xs">tasks_active.csv</code> — Active tasks</li>
            <li><code className="rounded bg-muted px-1.5 py-0.5 text-xs">tasks_completed.csv</code> — Completed tasks</li>
          </ul>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Planned Enhancements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-6 space-y-1">
            <li>SQLite migration</li>
            <li>Recurring tasks</li>
            <li>Weekly report generation</li>
            <li>Planner / Graph API sync</li>
            <li>Task dependencies</li>
            <li>Email/task ingestion</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

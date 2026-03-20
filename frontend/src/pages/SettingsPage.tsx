export default function SettingsPage() {
  return (
    <div className="page">
      <h2>Settings</h2>
      <div className="settings-card">
        <h3>About</h3>
        <p>Task Planner v1.0 — Local-first task management for operational work.</p>
        <p>Data is stored in CSV files under <code>backend/data/</code>.</p>
      </div>
      <div className="settings-card">
        <h3>Data Files</h3>
        <ul>
          <li><code>tasks_active.csv</code> — Active tasks</li>
          <li><code>tasks_completed.csv</code> — Completed tasks</li>
        </ul>
      </div>
      <div className="settings-card">
        <h3>Planned Enhancements</h3>
        <ul>
          <li>SQLite migration</li>
          <li>Recurring tasks</li>
          <li>Weekly report generation</li>
          <li>Planner / Graph API sync</li>
          <li>Task dependencies</li>
          <li>Email/task ingestion</li>
        </ul>
      </div>
    </div>
  );
}

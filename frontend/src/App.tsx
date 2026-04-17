import { Routes, Route, NavLink } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ActiveTasksPage from './pages/ActiveTasksPage';
import CompletedTasksPage from './pages/CompletedTasksPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import CalendarPage from './pages/CalendarPage';
import IdeasPage from './pages/IdeasPage';
import IdeaDetailPage from './pages/IdeaDetailPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar-brand-wrap">
          <span className="top-bar-kicker">Weekly workspace</span>
          <div className="top-bar-brand-row">
            <div className="top-bar-brand">Task Planner</div>
            <span className="top-bar-badge">Responsive planner</span>
          </div>
        </div>
        <nav className="top-bar-nav">
          <NavLink to="/" end>Planner</NavLink>
          <NavLink to="/ideas">Ideas</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          <NavLink to="/completed">Completed</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className="main-area">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<ActiveTasksPage />} />
          <Route path="/ideas" element={<IdeasPage />} />
          <Route path="/ideas/:ideaId" element={<IdeaDetailPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/completed" element={<CompletedTasksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

import { Routes, Route, NavLink } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ActiveTasksPage from './pages/ActiveTasksPage';
import CompletedTasksPage from './pages/CompletedTasksPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import CalendarPage from './pages/CalendarPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar-brand">Task Planner</div>
        <nav className="top-bar-nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/tasks">Active</NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          <NavLink to="/completed">Completed</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className="main-area">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<ActiveTasksPage />} />
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

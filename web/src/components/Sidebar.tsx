import { BookOpen, ClipboardCheck, History, LayoutDashboard, PenLine, ScanSearch } from 'lucide-react';

export type Page = 'dashboard' | 'review' | 'fill' | 'history' | 'rules';

const NAV: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'review', label: 'Review', icon: ScanSearch },
  { id: 'fill', label: 'Fill Online', icon: PenLine },
  { id: 'history', label: 'History', icon: History },
  { id: 'rules', label: 'Form Rules', icon: BookOpen },
];

export function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <ClipboardCheck size={22} />
        </div>
        <div className="brand-name">RegenMed</div>
        <div className="brand-sub">Reviewer</div>
      </div>

      <nav className="nav">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
            aria-current={page === id ? 'page' : undefined}
          >
            <span className="nav-icon">
              <Icon size={20} />
            </span>
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="avatar">QA</div>
        <div className="sidebar-user">
          QA Reviewer
        </div>
      </div>
    </aside>
  );
}

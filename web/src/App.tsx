import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Sidebar, type Page } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Review } from './pages/Review';
import { FillOnline } from './pages/FillOnline';
import { HistoryPage } from './pages/HistoryPage';
import { RulesPage } from './pages/RulesPage';
import type { ReviewResult } from './lib/types';
import { wakeServer } from './lib/api';

export default function App() {
  const [page, setPage] = useState<Page>('review');
  const [history, setHistory] = useState<ReviewResult[]>([]);
  const [current, setCurrent] = useState<ReviewResult | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => wakeServer(), []);

  const clearCurrent = () => {
    setCurrent(null);
  };

  const clearHistory = () => {
    setHistory([]);
    clearCurrent();
  };

  const navigate = (p: Page) => {
    // Opening Review from the nav starts a fresh upload
    if (p === 'review' && page !== 'review') clearCurrent();
    setPage(p);
  };

  const openPast = (r: ReviewResult) => {
    setCurrent(r);
    setPage('review');
  };

  return (
    <div className="app">
      <div className="frame">
        <Sidebar page={page} onNavigate={navigate} />
        <main className="main">
          {page === 'dashboard' && <Dashboard history={history} onNavigate={navigate} onOpen={openPast} />}
          {page === 'review' && (
            <Review
              result={current}
              onResult={(r) => {
                setCurrent(r);
                setHistory((h) => [r, ...h]);
              }}
              onReset={clearCurrent}
            />
          )}
          {page === 'fill' && <FillOnline onSubmitted={(r) => setHistory((h) => [r, ...h])} onNavigate={navigate} />}
          {page === 'history' && <HistoryPage history={history} onOpen={openPast} onClear={clearHistory} />}
          {page === 'rules' && <RulesPage />}
        </main>
      </div>

      {helpOpen && (
        <div className="help-panel fade-in">
          <h4>
            How it works
            <button className="icon-btn" onClick={() => setHelpOpen(false)} aria-label="Close help">
              <X size={16} />
            </button>
          </h4>
          <ol>
            <li>Upload one completed form as a PDF (max 20 MB).</li>
            <li>The form type is detected automatically.</li>
            <li>Form-specific rules are applied (about 20–30 seconds).</li>
            <li>Each problem is listed with its page, section and field.</li>
          </ol>
        </div>
      )}
      <button className="fab" onClick={() => setHelpOpen((o) => !o)} aria-label="Help">
        <MessageCircle size={26} />
        Help
      </button>
    </div>
  );
}

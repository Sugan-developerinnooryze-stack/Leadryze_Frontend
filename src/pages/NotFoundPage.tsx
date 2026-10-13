import { useNavigate } from 'react-router-dom';
import { HomeIcon, ArrowLeftIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-ryze-50 dark:bg-ryze-950/40 border border-ryze-200 dark:border-ryze-800/50 flex items-center justify-center mx-auto mb-4 text-ryze-600 dark:text-ryze-400">
          <QuestionMarkCircleIcon className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">Page Not Found</h1>
        <p className="text-sm text-text-muted mb-6">
          The page you are looking for doesn't exist, has been moved, or the link is incorrect.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-4 py-2 border border-border text-text-primary rounded-lg text-sm font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Go Back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-4 py-2 bg-ryze-600 hover:bg-ryze-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <HomeIcon className="h-4 w-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

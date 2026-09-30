import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';

interface PipelineStep {
  step:  string;
  label: string;
  state: 'complete' | 'in_progress' | 'pending';
  docId: string | null;
}

interface PortalData {
  docType:       string;
  docId:         string;
  title:         string;
  status:        string;
  workflowState: string;
  scheduledDate: string | null;
  companyName:   string;
  companyLogo:   string;
  pipeline:      PipelineStep[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:       'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted',
    sent:        'bg-blue-100 text-blue-700',
    approved:    'bg-green-100 text-green-700',
    active:      'bg-green-100 text-green-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed:   'bg-green-100 text-green-700',
    paid:        'bg-green-100 text-green-700',
    rejected:    'bg-red-100 text-red-700',
    cancelled:   'bg-red-100 text-red-700',
    scheduled:   'bg-purple-100 text-purple-700',
  };
  const cls = map[status] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted';
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function StepNode({ step, isLast }: { step: PipelineStep; isLast: boolean }) {
  const isComplete   = step.state === 'complete';
  const isInProgress = step.state === 'in_progress';

  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        {/* Circle */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
            isComplete
              ? 'bg-green-500 border-green-500'
              : isInProgress
              ? 'bg-surface border-ryze-500 ring-4 ring-ryze-100'
              : 'bg-surface border-border'
          }`}
        >
          {isComplete ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : isInProgress ? (
            <div className="w-3 h-3 rounded-full bg-ryze-500 animate-pulse" />
          ) : (
            <div className="w-3 h-3 rounded-full bg-black/[0.08] dark:bg-white/[0.1]" />
          )}
        </div>
        {/* Label */}
        <p
          className={`mt-2 text-xs font-medium text-center max-w-[70px] leading-snug ${
            isInProgress
              ? 'text-ryze-600 dark:text-ryze-400 font-bold'
              : isComplete
              ? 'text-green-600'
              : 'text-text-muted'
          }`}
        >
          {step.label}
        </p>
        {step.docId && (
          <p className="text-xs text-text-muted mt-0.5">{step.docId}</p>
        )}
      </div>
      {/* Connector line */}
      {!isLast && (
        <div
          className={`h-0.5 w-16 mx-1 mb-6 ${
            isComplete ? 'bg-green-400' : 'bg-black/[0.06] dark:bg-white/[0.08]'
          }`}
        />
      )}
    </div>
  );
}

export default function CustomerPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData]       = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.get(`/api/v1/portal/${token}`)
      .then((res) => setData(res.data?.data ?? null))
      .catch(() => setError('This portal link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-bold text-text-primary mb-2">Link not found</h1>
          <p className="text-text-muted text-sm">{error ?? 'This portal link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          {data.companyLogo && (
            <img src={data.companyLogo} alt={data.companyName} className="h-10 w-auto object-contain" />
          )}
          <div>
            <p className="font-bold text-text-primary">{data.companyName || 'Field Services'}</p>
            <p className="text-xs text-text-muted">Customer Portal</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Document card */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">{data.docId}</p>
              <h1 className="text-xl font-bold text-text-primary">{data.title}</h1>
            </div>
            <StatusBadge status={data.status} />
          </div>
          {data.scheduledDate && (
            <p className="text-sm text-text-muted">
              <span className="font-medium">Scheduled:</span> {fmtDate(data.scheduledDate)}
            </p>
          )}
        </div>

        {/* Pipeline stepper */}
        {data.pipeline.length > 0 && (
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-6">Your Pipeline Progress</h2>
            <div className="flex items-start justify-center overflow-x-auto pb-2">
              {data.pipeline.map((step, idx) => (
                <StepNode
                  key={step.step}
                  step={step}
                  isLast={idx === data.pipeline.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-center text-text-muted">
          Powered by LeadRyze AI — for questions, please contact {data.companyName || 'our team'}.
        </p>
      </div>
    </div>
  );
}

import { useTemplatesForChannelQuery } from '../../modules/campaigns/queries/campaigns.queries';

interface TemplateItem {
  _id: string;
  name: string;
  category: string;
  subject?: string;
  body: string;
}

interface Props {
  channel: string;
  selectedId?: string;
  onSelect: (template: TemplateItem) => void;
}

export default function TemplatePickerList({ channel, selectedId, onSelect }: Props) {
  const { data: templates = [], isLoading } = useTemplatesForChannelQuery(channel);

  if (isLoading) {
    return <div className="animate-pulse space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-black/[0.04] dark:bg-white/[0.06]" />)}</div>;
  }

  if (!templates.length) {
    return <p className="text-sm text-text-muted">No {channel} templates yet. Create one in Templates first.</p>;
  }

  return (
    <div className="space-y-2">
      {templates.map((t: TemplateItem) => (
        <button
          key={t._id}
          type="button"
          onClick={() => onSelect(t)}
          className={`w-full text-left p-3 rounded-lg border transition-colors ${
            selectedId === t._id ? 'border-ryze-600 bg-ryze-600/[0.06]' : 'border-border hover:border-ryze-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-text-primary">{t.name}</span>
            <span className="badge badge-gray capitalize text-xs">{t.category}</span>
          </div>
          {t.subject && <p className="text-xs text-text-muted mt-1 truncate">{t.subject}</p>}
          <p className="text-xs text-text-muted mt-1 line-clamp-2">{t.body}</p>
        </button>
      ))}
    </div>
  );
}

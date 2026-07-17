/** Shared rendering for generic "Custom Fields" values across view pages. */

export function isImageUrl(v: unknown): v is string {
  return typeof v === 'string' && /\.(jpe?g|png|gif|webp|bmp|svg|jfif)(\?.*)?$/i.test(v);
}

export function isUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https?:\/\//i.test(v);
}

/** Renders a custom-field value: image thumbnail(s), a link, or plain text. */
export function renderFieldValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined || v === '') return '—';

  if (Array.isArray(v)) {
    const urls = v.filter((x): x is string => typeof x === 'string');
    const images = urls.filter(isImageUrl);
    if (images.length > 0) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          {images.slice(0, 4).map((u, i) => (
            <img key={i} src={u} alt="" className="h-10 w-10 object-cover rounded-lg border border-gray-200" />
          ))}
          {urls.length > 4 && <span className="text-xs text-gray-400">+{urls.length - 4}</span>}
        </div>
      );
    }
    if (urls.length > 0) {
      return (
        <div className="flex flex-col gap-0.5">
          {urls.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline truncate max-w-xs">
              {u.split('/').pop() || u}
            </a>
          ))}
        </div>
      );
    }
    return v.join(', ');
  }

  if (isImageUrl(v)) {
    return <img src={v} alt="" className="h-14 w-14 object-cover rounded-lg border border-gray-200" />;
  }
  if (isUrl(v)) {
    return <a href={v} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline break-all">{v}</a>;
  }
  return String(v);
}

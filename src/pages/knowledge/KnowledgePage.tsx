import { useState, useRef, FormEvent } from 'react';
import { CloudArrowUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';

interface SearchResult {
  content: string;
  score: number;
  source: string;
}

export default function KnowledgePage() {
  const user = useAuthStore((s) => s.user);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !user?.tenantId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenantId', user.tenantId);

    setIsUploading(true);
    try {
      await api.post('/api/v1/ai/knowledge/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Uploaded and ingested: ${file.name}`);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !user?.tenantId) return;
    setIsSearching(true);
    try {
      const res = await api.post('/api/v1/ai/knowledge/search', {
        tenantId: user.tenantId,
        query: searchQuery,
        limit: 5,
      });
      setResults(res.data.data.results);
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Knowledge Base</h1>
        <p className="text-sm text-text-muted">Upload documents to power your AI agent's responses</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Upload Document</h2>
          <form onSubmit={uploadFile} className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-ryze-400 transition-colors">
              <CloudArrowUpIcon className="mx-auto h-10 w-10 text-text-muted" />
              <p className="mt-2 text-sm text-text-muted">PDF, TXT, or Markdown</p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="mt-3 btn-secondary cursor-pointer inline-flex">
                Choose File
              </label>
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isUploading}
            >
              {isUploading ? 'Uploading…' : 'Upload & Ingest'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Search Knowledge Base</h2>
          <form onSubmit={search} className="flex gap-3 mb-4">
            <input
              type="text"
              className="input flex-1"
              placeholder="Ask a question…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn-primary px-4" disabled={isSearching}>
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
          </form>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="bg-background rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-text-muted font-medium">{r.source}</span>
                  <span className="text-xs text-ryze-600 dark:text-ryze-400 font-medium">
                    {Math.round(r.score * 100)}% match
                  </span>
                </div>
                <p className="text-sm text-text-primary line-clamp-4">{r.content}</p>
              </div>
            ))}
            {results.length === 0 && searchQuery && !isSearching && (
              <p className="text-sm text-text-muted text-center py-6">No results found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

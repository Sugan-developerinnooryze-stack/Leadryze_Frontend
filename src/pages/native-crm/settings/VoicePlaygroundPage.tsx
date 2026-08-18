import { useRef, useState } from 'react';
import { MicrophoneIcon, StopIcon, LockClosedIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth.store';
import api from '../../../services/api';

interface VoiceTurnResult {
  transcript: string;
  response: string;
  escalate: boolean;
  capturedData: Record<string, string>;
  audio: string | null;
  audioFormat: string | null;
}

type PlaygroundState = 'idle' | 'recording' | 'uploading' | 'thinking' | 'speaking' | 'error';

/** Admin-only — the same combined transcribe/respond/synthesize voice turn
 * the public widget uses, called through an authenticated route instead of
 * a widgetKey, so it can be tested without a live embedded widget on a real
 * website. Reuses zero code from leadryze-widget (a separate, framework-
 * free bundle) — this is a small, self-contained React equivalent. */
export default function VoicePlaygroundPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user?.role ?? '');

  const [state, setState] = useState<PlaygroundState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceTurnResult | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const sessionIdRef = useRef(`playground-${Date.now()}`);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="text-center">
          <LockClosedIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Only admins can use the Voice Playground.</p>
        </div>
      </div>
    );
  }

  const startRecording = async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setState('recording');
    } catch {
      setError('Microphone permission was denied, or no microphone is available.');
      setState('error');
    }
  };

  const stopAndSend = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    setState('uploading');

    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        resolve(new Blob(chunksRef.current, { type: mimeType }));
        recorder.stream.getTracks().forEach((t) => t.stop());
      };
      recorder.stop();
    });
    const seconds = (Date.now() - startedAtRef.current) / 1000;
    setDurationSeconds(seconds);

    if (!blob.size) { setState('idle'); return; }

    setState('thinking');
    try {
      const form = new FormData();
      form.append('audio', blob, 'recording.webm');
      form.append('sessionId', sessionIdRef.current);
      form.append('durationSeconds', String(Math.round(seconds)));
      const res = await api.post('/api/v1/ai/voice/chat', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 100000,
      });
      const data = res.data.data as VoiceTurnResult;
      setResult(data);
      if (data.audio && data.audioFormat && audioRef.current) {
        setState('speaking');
        audioRef.current.src = `data:audio/${data.audioFormat};base64,${data.audio}`;
        void audioRef.current.play().catch(() => {});
      }
      setState('idle');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Voice turn failed.');
      setState('error');
    }
  };

  const handleMicClick = () => {
    if (state === 'idle' || state === 'error') void startRecording();
    else if (state === 'recording') void stopAndSend();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/native-crm/settings/widget')} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div className="h-9 w-9 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
          <MicrophoneIcon className="h-[18px] w-[18px] text-cyan-600" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Voice Playground</h1>
          <p className="text-xs text-gray-500">Test speech-to-text and text-to-speech for your tenant — no embedded widget needed.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={handleMicClick}
              disabled={state === 'uploading' || state === 'thinking' || state === 'speaking'}
              className={`h-20 w-20 rounded-full flex items-center justify-center transition-colors disabled:opacity-60 ${
                state === 'recording' ? 'bg-red-500 text-white animate-pulse' : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {state === 'recording' ? <StopIcon className="h-8 w-8" /> : <MicrophoneIcon className="h-8 w-8" />}
            </button>
            <p className="mt-4 text-sm text-gray-500">
              {state === 'idle' && 'Tap to start recording'}
              {state === 'recording' && 'Recording… tap to stop and send'}
              {state === 'uploading' && 'Uploading…'}
              {state === 'thinking' && 'Thinking…'}
              {state === 'speaking' && 'Speaking…'}
              {state === 'error' && 'Tap to try again'}
            </p>

            {error && (
              <div className="mt-4 w-full text-sm px-4 py-2.5 rounded-lg border bg-red-50 border-red-100 text-red-600">
                {error}
              </div>
            )}

            <audio ref={audioRef} className="hidden" />

            {result && (
              <div className="mt-6 w-full text-left space-y-3">
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">You said</p>
                  <p className="text-sm text-gray-700">{result.transcript || '(nothing recognized)'}</p>
                </div>
                <div className="bg-brand-50/40 border border-brand-100 rounded-lg px-4 py-3">
                  <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wide mb-1">Assistant replied</p>
                  <p className="text-sm text-gray-800">{result.response}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
                  <span>Recording: {durationSeconds.toFixed(1)}s</span>
                  {result.escalate && <span className="text-amber-600 font-medium">Escalated to human</span>}
                  {Object.keys(result.capturedData ?? {}).length > 0 && (
                    <span>Captured: {Object.entries(result.capturedData).map(([k, v]) => `${k}=${v}`).join(', ')}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

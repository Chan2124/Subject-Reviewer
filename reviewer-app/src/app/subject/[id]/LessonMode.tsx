'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { SubjectData } from '@/lib/data';

type LessonItem = {
  id: string;
  title: string;
  text: string;
  category: string;
};

const VOICE_PRIORITY = [
  'Microsoft Jenny Online',
  'Microsoft Aria Online',
  'Microsoft Guy Online',
  'Microsoft Christopher Online',
  'Microsoft Ryan Online',
  'Microsoft Emma Online',
  'Microsoft Davis Online',
  'Google US English',
  'Google UK English Male',
  'Microsoft Mark Online',
  'Microsoft Mark',
];

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const preferred of VOICE_PRIORITY) {
    const found = voices.find(v => v.name === preferred);
    if (found) return found;
  }
  const online = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('online'));
  if (online) return online;
  const english = voices.find(v => v.lang.startsWith('en'));
  return english || voices[0] || null;
}

export default function LessonMode({ subject, activeCategory }: { subject: SubjectData, activeCategory: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechRate, setSpeechRate] = useState(0.88);

  // Refs — used inside callbacks / media session handlers to always see fresh state
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const currentIndexRef = useRef(0);
  const isPausedRef     = useRef(false);
  const isPlayingRef    = useRef(false);
  const lessonItemsRef  = useRef<LessonItem[]>([]);
  const voiceRef        = useRef<SpeechSynthesisVoice | null>(null);
  const speechRateRef   = useRef(0.88);

  // Keep refs in sync with state
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { voiceRef.current = voice; }, [voice]);
  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);

  // ─── Lesson items ──────────────────────────────────────────────
  const lessonItems = useMemo<LessonItem[]>(() => {
    let src = subject.lessons || [];
    if (activeCategory !== 'All') src = src.filter(l => l.category === activeCategory);
    return src.map((l, i) => ({ id: `lesson-${i}`, title: l.title, text: l.text, category: l.category }));
  }, [subject, activeCategory]);

  useEffect(() => { lessonItemsRef.current = lessonItems; }, [lessonItems]);

  // ─── Load TTS voices ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        setVoice(prev => prev || pickBestVoice(voices));
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  // ─── Silent audio — keeps browser audio session alive on lock screen ──
  const startSilentAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      audioCtxRef.current?.close();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass() as AudioContext;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001;   // effectively silent — no one hears it
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      audioCtxRef.current = ctx;
    } catch (_) { /* not critical */ }
  }, []);

  const stopSilentAudio = useCallback(() => {
    try { audioCtxRef.current?.close(); audioCtxRef.current = null; } catch (_) {}
  }, []);

  // ─── Wake Lock API — Keep screen awake while playing ───────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(console.error);
      wakeLockRef.current = null;
    }
  }, []);

  // Re-request wake lock if tab becomes visible again while playing
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlayingRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [requestWakeLock]);

  // ─── Update Media Session metadata & playback state ────────────
  const setMediaPlaying = useCallback((item: LessonItem) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.title,
        artist: `${subject.title} · ${item.category}`,
        album: 'Study Console',
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch (_) {}
  }, [subject.title]);

  // ─── Core play engine (uses refs to avoid stale closures) ──────
  const playAtIndex = useCallback((index: number, rate?: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const items = lessonItemsRef.current;
    if (index < 0 || index >= items.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentIndex(0);
      currentIndexRef.current = 0;
      stopSilentAudio();
      releaseWakeLock();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      return;
    }

    const item   = items[index];
    const usedRate = rate ?? speechRateRef.current;

    const chunks = item.text
      .match(/[^.!?\n]+[.!?\n]*/g)
      ?.map(s => s.trim()).filter(Boolean) ?? [item.text];

    let chunkIdx = 0;

    const speakNext = () => {
      if (chunkIdx >= chunks.length) {
        // Auto-advance
        const nextIdx = index + 1;
        if (nextIdx < lessonItemsRef.current.length) {
          setCurrentIndex(nextIdx);
          currentIndexRef.current = nextIdx;
          playAtIndex(nextIdx, usedRate);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentIndex(0);
          currentIndexRef.current = 0;
          stopSilentAudio();
          releaseWakeLock();
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
        }
        return;
      }

      const utt = new SpeechSynthesisUtterance(chunks[chunkIdx]);
      if (voiceRef.current) utt.voice = voiceRef.current;
      utt.rate   = usedRate;
      utt.pitch  = 1.0;
      utt.volume = 1.0;

      utt.onend  = () => { chunkIdx++; speakNext(); };
      utt.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          setIsPlaying(false);
          setIsPaused(false);
          stopSilentAudio();
          releaseWakeLock();
        }
      };

      utteranceRef.current = utt;
      window.speechSynthesis.speak(utt);
    };

    speakNext();
    setCurrentIndex(index);
    currentIndexRef.current = index;
    setIsPlaying(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setMediaPlaying(item);
    requestWakeLock();
  }, [stopSilentAudio, setMediaPlaying, requestWakeLock, releaseWakeLock]);

  // ─── Register Media Session action handlers (lock screen controls) ─
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const resume = () => {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      isPausedRef.current = false;
      requestWakeLock();
      navigator.mediaSession.playbackState = 'playing';
    };

    navigator.mediaSession.setActionHandler('play', () => {
      if (isPausedRef.current) {
        resume();
      } else {
        startSilentAudio();
        playAtIndex(currentIndexRef.current);
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
      isPausedRef.current = true;
      releaseWakeLock();
      navigator.mediaSession.playbackState = 'paused';
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playAtIndex(Math.max(currentIndexRef.current - 1, 0));
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const items = lessonItemsRef.current;
      playAtIndex(Math.min(currentIndexRef.current + 1, items.length - 1));
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentIndex(0);
      currentIndexRef.current = 0;
      stopSilentAudio();
      releaseWakeLock();
      navigator.mediaSession.playbackState = 'none';
    });

    return () => {
      try {
        (['play', 'pause', 'previoustrack', 'nexttrack', 'stop'] as MediaSessionAction[])
          .forEach(a => navigator.mediaSession.setActionHandler(a, null));
      } catch (_) {}
    };
  }, [playAtIndex, startSilentAudio, stopSilentAudio, requestWakeLock, releaseWakeLock]);

  // Stop when category changes
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    stopSilentAudio();
    releaseWakeLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // Cleanup on unmount
  useEffect(() => () => {
    window.speechSynthesis.cancel();
    stopSilentAudio();
    releaseWakeLock();
  }, [stopSilentAudio, releaseWakeLock]);

  // ─── UI handlers ───────────────────────────────────────────────
  const handlePlay = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      requestWakeLock();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    } else {
      startSilentAudio();
      playAtIndex(currentIndex);
    }
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
    releaseWakeLock();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    stopSilentAudio();
    releaseWakeLock();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  };

  const handleNext = () => {
    const next = Math.min(currentIndex + 1, lessonItems.length - 1);
    if (isPlaying || isPaused) playAtIndex(next);
    else setCurrentIndex(next);
  };

  const handlePrev = () => {
    const prev = Math.max(currentIndex - 1, 0);
    if (isPlaying || isPaused) playAtIndex(prev);
    else setCurrentIndex(prev);
  };

  const handleRateChange = (newRate: number) => {
    setSpeechRate(newRate);
    speechRateRef.current = newRate;
    if (isPlaying) playAtIndex(currentIndex, newRate);
  };

  // ─── Render ────────────────────────────────────────────────────
  if (lessonItems.length === 0) {
    return (
      <div className="card text-center py-16">
        <p className="text-[var(--warn)] text-lg mb-2">No lesson content available for this module yet.</p>
        <p className="text-[var(--mut)] text-sm">Lesson content is currently available for the NetCom subject.</p>
      </div>
    );
  }

  const currentItem = lessonItems[currentIndex];
  const progress = lessonItems.length > 1 ? (currentIndex / (lessonItems.length - 1)) * 100 : 100;

  return (
    <div className="fade-in flex flex-col gap-5">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--acc)] mb-1">Audio Lesson</h2>
        <p className="text-[var(--mut)] text-sm">
          {activeCategory === 'All' ? 'All modules' : activeCategory} · {lessonItems.length} lessons ·{' '}
          <span className="font-medium">{voice ? voice.name : 'Loading voice...'}</span>
        </p>
        {isPlaying && (
          <p className="text-xs text-[var(--ok)] mt-1">
            🎧 Playing - screen will stay awake automatically
          </p>
        )}
      </div>

      {/* Main Player Card */}
      <div className="bg-[var(--panel2)] border border-[var(--line)] rounded-2xl overflow-hidden">

        {/* Lesson meta */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--line)]">
          <span className="tag text-[var(--acc)] border-[var(--acc-d)] bg-[var(--panel)] text-xs">
            {currentIndex + 1} / {lessonItems.length}
          </span>
          <span className="tag text-[#7cc4ff] border-[#2b4d73] text-xs">{currentItem.category}</span>
          <h3 className="text-base font-bold text-[var(--tx)] flex-1 truncate">{currentItem.title}</h3>
        </div>

        {/* Lesson text */}
        <div className="px-6 py-5 max-h-72 overflow-y-auto">
          <p className="text-[#c9d3e6] text-sm leading-relaxed">{currentItem.text}</p>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-2">
          <div className="w-full h-1.5 bg-[var(--inset)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--acc)] transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Controls — responsive via CSS */}
        <div className="lesson-player-controls">

          {/* Speed group */}
          <div className="lesson-speed-group">
            <span className="text-xs text-[var(--mut)] font-mono">Speed</span>
            {[0.75, 0.88, 1.0, 1.15].map(r => (
              <button
                key={r}
                onClick={() => handleRateChange(r)}
                style={{
                  fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                  padding: '0.2rem 0.5rem', borderRadius: '6px',
                  border: `1px solid ${speechRate === r ? 'var(--acc)' : 'var(--line)'}`,
                  background: speechRate === r ? 'var(--acc)' : 'var(--inset)',
                  color: speechRate === r ? '#04111f' : 'var(--mut)',
                  cursor: 'pointer', transition: 'all 0.15s', minHeight: '32px',
                }}
              >
                {r === 0.75 ? '0.75×' : r === 0.88 ? '0.9×' : r === 1.0 ? '1×' : '1.15×'}
              </button>
            ))}
          </div>

          {/* Play group */}
          <div className="lesson-play-group">
            <button onClick={handlePrev} disabled={currentIndex === 0} title="Previous"
              style={{ padding: '0.6rem', borderRadius: '50%', background: 'var(--inset)', border: '1px solid var(--line)', color: 'var(--mut)', cursor: 'pointer', transition: 'all 0.15s', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentIndex === 0 ? 0.3 : 1 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
              </svg>
            </button>

            {(!isPlaying || isPaused) ? (
              <button onClick={handlePlay} title={isPaused ? 'Resume' : 'Play'}
                style={{ padding: '1rem', borderRadius: '50%', background: 'var(--acc)', color: '#04111f', border: 'none', cursor: 'pointer', transition: 'all 0.15s', minWidth: '60px', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(90,169,255,0.3)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
            ) : (
              <button onClick={handlePause} title="Pause"
                style={{ padding: '1rem', borderRadius: '50%', background: 'var(--warn)', color: '#2e2412', border: 'none', cursor: 'pointer', transition: 'all 0.15s', minWidth: '60px', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(245,166,35,0.3)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              </button>
            )}

            <button onClick={handleNext} disabled={currentIndex === lessonItems.length - 1} title="Next"
              style={{ padding: '0.6rem', borderRadius: '50%', background: 'var(--inset)', border: '1px solid var(--line)', color: 'var(--mut)', cursor: 'pointer', transition: 'all 0.15s', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentIndex === lessonItems.length - 1 ? 0.3 : 1 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
              </svg>
            </button>
          </div>

          {/* Stop */}
          <button onClick={handleStop}
            disabled={!isPlaying && !isPaused && currentIndex === 0}
            style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--bad)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: (!isPlaying && !isPaused && currentIndex === 0) ? 0.3 : 1, transition: 'opacity 0.15s', minHeight: '36px' }}
          >
            Stop & Reset
          </button>
        </div>
      </div>

      {/* Lesson List */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[var(--mut)] uppercase tracking-widest mb-3">All Lessons</h3>
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {lessonItems.map((item, i) => (
            <button key={item.id}
              onClick={() => { if (isPlaying || isPaused) playAtIndex(i); else setCurrentIndex(i); }}
              className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                i === currentIndex
                  ? 'bg-[var(--panel2)] text-white border border-[var(--line)]'
                  : 'text-[var(--mut)] hover:bg-[var(--panel)] hover:text-[var(--tx)] border border-transparent'
              }`}
            >
              <span className="font-mono text-xs text-[var(--mut)] mr-2">{String(i + 1).padStart(2, '0')}</span>
              {item.title}
              {i === currentIndex && isPlaying && (
                <span className="ml-2 text-[var(--ok)] text-xs">▶ playing</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Voice selector */}
      {availableVoices.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--mut)] uppercase tracking-widest mb-3">Voice</h3>
          <select
            className="w-full bg-[var(--inset)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--tx)] cursor-pointer"
            value={voice?.name || ''}
            onChange={e => {
              const selected = availableVoices.find(v => v.name === e.target.value) || null;
              setVoice(selected);
              if (isPlaying) playAtIndex(currentIndex);
            }}
          >
            {availableVoices.filter(v => v.lang.startsWith('en')).map(v => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
          <p className="text-xs text-[var(--mut)] mt-2">
            Tip: &quot;Online&quot; voices sound the most natural. Microsoft Jenny Online is recommended.
          </p>
        </div>
      )}

    </div>
  );
}

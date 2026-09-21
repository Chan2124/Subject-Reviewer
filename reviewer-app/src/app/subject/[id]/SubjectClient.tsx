'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SubjectData } from '@/lib/data';
import ReviewMode from './ReviewMode';
import QuizMode from './QuizMode';
import LessonMode from './LessonMode';

export default function SubjectClient({ subject }: { subject: SubjectData }) {
  const [mode, setMode] = useState<'lesson' | 'review' | 'quiz'>('review');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Header ── */}
      <header className="subject-header">
        {/* Title row */}
        <div className="flex items-center gap-2 font-mono font-bold text-[var(--acc)] min-w-0">
          <Link href="/" className="hover:text-white transition-colors shrink-0 text-sm">
            ← Back
          </Link>
          <svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
            <g fill="currentColor">
              <rect x="3" y="2"  width="20" height="2.4" rx="1.2" opacity="1"/>
              <rect x="3" y="5.8" width="20" height="2.4" rx="1.2" opacity=".92"/>
              <rect x="3" y="9.6" width="20" height="2.4" rx="1.2" opacity=".84"/>
              <rect x="3" y="13.4" width="20" height="2.4" rx="1.2" opacity=".72"/>
              <rect x="3" y="17.2" width="20" height="2.4" rx="1.2" opacity=".6"/>
              <rect x="3" y="21"  width="20" height="2.4" rx="1.2" opacity=".48"/>
            </g>
          </svg>
          <span className="text-base truncate">{subject.title}</span>
          <small className="hidden md:inline font-sans font-normal text-sm text-[var(--mut)] ml-1 truncate">
            {subject.description}
          </small>
        </div>

        {/* Mode tabs — full-width on mobile */}
        <div className="subject-tabs" role="tablist">
          {(['lesson', 'review', 'quiz'] as const).map(m => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              style={{
                color: mode === m ? '#04111f' : 'var(--mut)',
                backgroundColor: mode === m ? 'var(--acc)' : 'transparent',
              }}
            >
              {m === 'lesson' ? '🎧 Lesson' : m === 'review' ? '📖 Review' : '✏️ Quiz'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 flex-col md:flex-row max-w-[1200px] w-full mx-auto">

        {/* Module Sidebar — vertical on desktop, horizontal scroll strip on mobile */}
        <aside className="module-aside">
          <p className="module-aside-heading">Modules</p>
          <nav className="module-nav" aria-label="Module navigation">
            {['All', ...subject.categories].map(c => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`module-nav-btn ${activeCategory === c ? 'active' : ''}`}
              >
                {c === 'All' ? 'All Modules' : c}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto min-w-0">
          {mode === 'lesson'  && <LessonMode  subject={subject} activeCategory={activeCategory} />}
          {mode === 'review'  && <ReviewMode  subject={subject} activeCategory={activeCategory} />}
          {mode === 'quiz'    && <QuizMode    subject={subject} activeCategory={activeCategory} />}
        </main>
      </div>
    </div>
  );
}

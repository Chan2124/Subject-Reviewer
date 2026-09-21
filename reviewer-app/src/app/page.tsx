import { getAllSubjects } from '@/lib/data';
import Link from 'next/link';

export default function Dashboard() {
  const subjects = getAllSubjects();

  return (
    <main style={{ maxWidth: '980px', margin: '0 auto', padding: '1.25rem 1rem 3rem' }}>
      <header className="mb-8 border-b border-[var(--line)] pb-4">
        <div className="flex items-center gap-3 font-mono font-bold text-lg text-[var(--acc)]">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <g fill="currentColor">
              <rect x="3" y="2" width="20" height="2.4" rx="1.2" opacity="1"/>
              <rect x="3" y="5.8" width="20" height="2.4" rx="1.2" opacity=".92"/>
              <rect x="3" y="9.6" width="20" height="2.4" rx="1.2" opacity=".84"/>
              <rect x="3" y="13.4" width="20" height="2.4" rx="1.2" opacity=".72"/>
              <rect x="3" y="17.2" width="20" height="2.4" rx="1.2" opacity=".6"/>
              <rect x="3" y="21" width="20" height="2.4" rx="1.2" opacity=".48"/>
            </g>
          </svg>
          Study Console
        </div>
        <p className="text-[var(--mut)] text-sm mt-2">Centralized dashboard for all your study reviewers.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((subject) => (
          <Link href={`/subject/${subject.id}`} key={subject.id}>
            <div className="card h-full transition-transform hover:-translate-y-1 hover:border-[var(--acc)] cursor-pointer">
              <h2 className="text-[var(--acc)] mb-2">{subject.title}</h2>
              <p className="text-sm text-[var(--mut)] mb-4">{subject.description}</p>
              <div className="flex flex-wrap gap-2">
                {subject.categories.slice(0, 3).map((cat) => (
                  <span key={cat} className="tag text-xs">{cat}</span>
                ))}
                {subject.categories.length > 3 && (
                  <span className="tag text-xs">+{subject.categories.length - 3} more</span>
                )}
              </div>
            </div>
          </Link>
        ))}
        
        {subjects.length === 0 && (
          <div className="card col-span-full text-center py-10">
            <p className="text-[var(--warn)]">No reviewers found in the data folder.</p>
          </div>
        )}
      </div>
    </main>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { SubjectData, Card } from '@/lib/data';

export default function ReviewMode({ subject, activeCategory }: { subject: SubjectData, activeCategory: string }) {
  const [isShuffled, setIsShuffled] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [again, setAgain] = useState<Set<number>>(new Set());

  // Filter and shuffle deck
  const deck = useMemo(() => {
    let filtered = subject.cards;
    if (activeCategory !== 'All') {
      filtered = subject.cards.filter((c) => c.category === activeCategory);
    }
    // Deep copy to allow shuffle
    let result = filtered.map((c, i) => ({ ...c, originalIndex: i }));
    if (isShuffled) {
      result = [...result].sort(() => Math.random() - 0.5);
    }
    return result;
  }, [subject.cards, activeCategory, isShuffled]);

  const currentCard = deck[currentIndex];

  const go = (delta: number) => {
    if (deck.length === 0) return;
    setIsRevealed(false);
    setCurrentIndex((prev) => (prev + delta + deck.length) % deck.length);
  };

  const grade = (isOk: boolean) => {
    if (!currentCard) return;
    const id = currentCard.originalIndex;
    
    if (isOk) {
      setKnown((prev) => new Set(prev).add(id));
      setAgain((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setAgain((prev) => new Set(prev).add(id));
      setKnown((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    go(1);
  };

  if (!deck.length) {
    return <div className="text-center p-10 text-[var(--warn)]">No cards found in this module.</div>;
  }

  const progress = ((currentIndex + 1) / deck.length) * 100;
  const isCardKnown = known.has(currentCard.originalIndex);
  const isCardAgain = again.has(currentCard.originalIndex);

  return (
    <section aria-label="Review mode" className="fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-[var(--acc)]">{activeCategory === 'All' ? 'All Modules' : activeCategory}</h2>
        <div className="flex gap-2">
          <button className="btn ghost" onClick={() => { setIsShuffled(!isShuffled); setCurrentIndex(0); setIsRevealed(false); }}>
            {isShuffled ? 'Unshuffle' : 'Shuffle'}
          </button>
          <button className="btn ghost" onClick={() => { setKnown(new Set()); setAgain(new Set()); setCurrentIndex(0); setIsRevealed(false); }}>
            Reset progress
          </button>
        </div>
      </div>

      {/* Meta Stats */}
      <div className="flex items-center gap-5 flex-wrap mb-2">
        <span className="stat">Card {currentIndex + 1} of {deck.length}</span>
        <span className="flex-1"></span>
        <span className="stat ok">Got it <b>{known.size}</b></span>
        <span className="stat warn">Review again <b>{again.size}</b></span>
      </div>
      <div className="bar"><i style={{ width: `${progress}%` }}></i></div>

      {/* Flashcard */}
      <article className="card flash">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="tag text-[#7cc4ff] border-[#2b4d73]">{currentCard.category}</span>
          <span className="stat">
            {isCardKnown ? 'Marked: got it' : isCardAgain ? 'Marked: review again' : ''}
          </span>
        </div>
        
        <h2 className="mb-4 text-xl" dangerouslySetInnerHTML={{ __html: currentCard.question }}></h2>
        
        <div className="actions mb-4">
          <button 
            className="btn primary" 
            aria-expanded={isRevealed} 
            onClick={() => setIsRevealed(!isRevealed)}
          >
            {isRevealed ? 'Hide Answer' : 'Reveal Answer'}
          </button>
        </div>

        {/* Answer Reveal Area */}
        <div 
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isRevealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        >
          <div className="overflow-hidden">
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <div className="font-semibold text-sm text-[var(--acc)] mb-1">Answer</div>
              <div className="bg-[var(--inset)] border border-[var(--line)] border-l-4 border-l-[var(--ok)] rounded-lg p-3 mb-4" dangerouslySetInnerHTML={{ __html: currentCard.answer }}></div>
              
              {currentCard.explanation && (
                <>
                  <div className="font-semibold text-sm text-[var(--acc)] mb-1">Why it is correct</div>
                  <div className="text-[#c9d3e6] mb-4 text-sm" dangerouslySetInnerHTML={{ __html: currentCard.explanation }}></div>
                </>
              )}
              
              <div className="flex gap-3 mt-4">
                <button className="btn good flex-1 sm:flex-none" onClick={() => grade(true)}>Got it</button>
                <button className="btn warnb flex-1 sm:flex-none" onClick={() => grade(false)}>Review again</button>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* Navigation */}
      <div className="flex justify-between items-center gap-3 flex-wrap mt-6">
        <button className="btn ghost" onClick={() => go(-1)}>Previous</button>
        <span className="muted small text-center flex-1">Use buttons to navigate.</span>
        <button className="btn ghost" onClick={() => go(1)}>Next</button>
      </div>
    </section>
  );
}

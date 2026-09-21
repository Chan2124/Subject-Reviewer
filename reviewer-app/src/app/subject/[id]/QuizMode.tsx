'use client';

import { useState, useMemo } from 'react';
import { SubjectData, Question } from '@/lib/data';

type QuizState = 'setup' | 'playing' | 'result';

export default function QuizMode({ subject, activeCategory }: { subject: SubjectData, activeCategory: string }) {
  const [state, setState] = useState<QuizState>('setup');
  const [questionCount, setQuestionCount] = useState<number>(20);
  
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [userAnswers, setUserAnswers] = useState<any[]>([]);

  // Identification (fb) input state
  const [fbInput, setFbInput] = useState('');
  // Matching input state
  const [matchInputs, setMatchInputs] = useState<string[]>([]);

  const startQuiz = () => {
    let filtered = subject.questions;
    if (activeCategory !== 'All') {
      filtered = subject.questions.filter((q) => q.category === activeCategory);
    }
    
    // Deep copy and shuffle
    let pool = [...filtered].sort(() => Math.random() - 0.5);
    
    if (questionCount > 0 && questionCount < pool.length) {
      pool = pool.slice(0, questionCount);
    }
    
    // For matching type, shuffle right side options once when starting
    pool = pool.map(q => {
      if (q.type === 'match' && q.pairs) {
         const rights = q.pairs.map(p => p[1]).sort(() => Math.random() - 0.5);
         return { ...q, shuffledRights: rights };
      }
      return q;
    });

    setQuizQuestions(pool);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswers([]);
    setFeedback(null);
    setState('playing');
  };

  const handleAnswer = (answer: any, isCorrect: boolean) => {
    if (feedback) return; // Prevent multiple clicks

    const currentQ = quizQuestions[currentIndex];
    
    let isActuallyCorrect = isCorrect;
    
    // Custom check for FB (identification)
    if (currentQ.type === 'fb' && currentQ.options) {
      const normalized = typeof answer === 'string' ? answer.trim().toLowerCase() : '';
      isActuallyCorrect = currentQ.options.some(opt => opt.toLowerCase() === normalized);
    }
    
    // Custom check for Match
    if (currentQ.type === 'match' && currentQ.pairs) {
       const userArr = answer as string[];
       isActuallyCorrect = currentQ.pairs.every((pair, i) => pair[1] === userArr[i]);
    }

    if (isActuallyCorrect) {
      setScore(s => s + 1);
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }

    let explanationHTML = currentQ.explanation || '';
    if (currentQ.type === 'fb') {
      explanationHTML = `Correct answer(s): ${currentQ.options?.join(' or ')}. <br/> ${explanationHTML}`;
    }

    setFeedback({
      isCorrect: isActuallyCorrect,
      message: isActuallyCorrect ? `Correct! ${explanationHTML}` : `Incorrect. ${explanationHTML}`
    });
    
    setUserAnswers(prev => [...prev, { q: currentQ, answer, isCorrect: isActuallyCorrect }]);
  };

  const nextQuestion = () => {
    setFeedback(null);
    setFbInput('');
    setMatchInputs([]);
    if (currentIndex + 1 >= quizQuestions.length) {
      setState('result');
    } else {
      setCurrentIndex(c => c + 1);
    }
  };

  if (subject.questions.length === 0) {
    return <div className="text-center p-10 text-[var(--warn)]">No quiz questions found in this module.</div>;
  }

  if (state === 'setup') {
    return (
      <div className="card fade-in">
        <h2 className="mb-2">Build your quiz</h2>
        <p className="muted mb-6">Test your knowledge with instant feedback and score tracking.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-[var(--mut)] mb-1">Topic</label>
            <div className="w-full bg-[var(--inset)] border border-[var(--line)] rounded-lg px-3 py-2 text-[var(--tx)] font-semibold">
              {activeCategory === 'All' ? 'All Modules' : activeCategory}
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--mut)] mb-1">Number of questions</label>
            <select 
              className="w-full bg-[var(--inset)] border border-[var(--line)] rounded-lg px-3 py-2 text-[var(--tx)] cursor-pointer"
              value={questionCount} 
              onChange={e => setQuestionCount(Number(e.target.value))}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="40">40</option>
              <option value="0">All available</option>
            </select>
          </div>
        </div>
        
        <div className="actions">
          <button className="btn primary" onClick={startQuiz}>Start Quiz</button>
        </div>
      </div>
    );
  }

  if (state === 'result') {
    return (
      <div className="card fade-in text-center py-10">
        <h2>Quiz Complete</h2>
        <div className="text-5xl font-mono text-[var(--acc)] my-6">{score} / {quizQuestions.length}</div>
        <p className="muted mb-6">You scored {Math.round((score / quizQuestions.length) * 100)}%</p>
        <button className="btn primary" onClick={() => setState('setup')}>Take Another Quiz</button>
      </div>
    );
  }

  const currentQ = quizQuestions[currentIndex];
  const typeLabel = { mc: 'Multiple Choice', tf: 'True/False', fb: 'Identification', match: 'Matching Type' }[currentQ.type] || currentQ.type;
  
  // For matching type, ensure matchInputs has enough elements
  if (currentQ.type === 'match' && currentQ.pairs && matchInputs.length !== currentQ.pairs.length) {
      setMatchInputs(new Array(currentQ.pairs.length).fill(''));
  }

  return (
    <div className="card fade-in">
      {/* Quiz Header */}
      <div className="flex flex-wrap items-center gap-3 mb-2 text-sm">
        <span className="tag text-[var(--acc)] border-[var(--acc-d)] bg-[var(--panel2)]">{typeLabel}</span>
        <span className="tag text-[#7cc4ff] border-[#2b4d73]">{currentQ.category}</span>
        <span className="stat ml-2">Q {currentIndex + 1} of {quizQuestions.length}</span>
        <span className="flex-1"></span>
        <span className="stat">Score <b className="text-[var(--acc)] font-mono">{score}</b></span>
        <span className="stat">Streak <b className="text-[var(--warn)] font-mono">{streak}</b></span>
      </div>
      <div className="bar"><i style={{ width: `${((currentIndex + 1) / quizQuestions.length) * 100}%` }}></i></div>

      {/* Question Text */}
      <h2 className="mb-6 mt-4 text-lg" dangerouslySetInnerHTML={{ __html: currentQ.question }}></h2>

      {/* Answers Area */}
      <div className="space-y-3 mb-6">
        {(currentQ.type === 'mc' || currentQ.type === 'tf') && currentQ.options && (
          currentQ.options.map((opt, i) => (
            <button
              key={i}
              disabled={!!feedback}
              onClick={() => handleAnswer(opt, i === currentQ.correctAnswer)}
              className={`quiz-option ${
                feedback && i === currentQ.correctAnswer ? 'correct' :
                feedback ? 'incorrect-reveal' : ''
              }`}
            >
              <div dangerouslySetInnerHTML={{ __html: opt }}></div>
            </button>
          ))
        )}

        {currentQ.type === 'fb' && (
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              className="flex-1 bg-[var(--inset)] border border-[var(--line)] rounded-lg px-4 py-2 font-mono text-[var(--tx)] focus:outline-none focus:border-[var(--acc)]" 
              placeholder="Type your answer here..."
              value={fbInput}
              onChange={e => setFbInput(e.target.value)}
              disabled={!!feedback}
              onKeyDown={e => e.key === 'Enter' && !feedback && handleAnswer(fbInput, false)}
            />
            <button 
              className="btn primary disabled:opacity-50" 
              disabled={!!feedback || !fbInput.trim()} 
              onClick={() => handleAnswer(fbInput, false)}
            >
              Submit
            </button>
          </div>
        )}

        {currentQ.type === 'match' && currentQ.pairs && (
          <div className="space-y-2">
            {currentQ.pairs.map((pair, idx) => (
              <div key={idx} className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center gap-3 ${feedback ? (matchInputs[idx] === pair[1] ? 'border-[var(--ok)]' : 'border-[var(--bad)]') : 'bg-[var(--panel2)] border-[var(--line)]'}`}>
                <div className="flex-1 text-sm">{pair[0]}</div>
                <select 
                  className="bg-[var(--inset)] border border-[var(--line)] rounded-lg px-2 py-1 text-sm text-[var(--tx)] max-w-full sm:max-w-[200px]"
                  value={matchInputs[idx]}
                  onChange={e => {
                     const newInputs = [...matchInputs];
                     newInputs[idx] = e.target.value;
                     setMatchInputs(newInputs);
                  }}
                  disabled={!!feedback}
                >
                  <option value="">-- Select Match --</option>
                  {(currentQ as any).shuffledRights?.map((r: string, i: number) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="mt-4 text-right">
               <button 
                  className="btn primary disabled:opacity-50" 
                  disabled={!!feedback || matchInputs.some(i => i === '')} 
                  onClick={() => handleAnswer(matchInputs, false)}
               >
                 Submit Matches
               </button>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Area */}
      {feedback && (
        <div className={`p-4 rounded-xl border mb-6 ${feedback.isCorrect ? 'bg-[var(--ok-bg)] border-[var(--ok)]' : 'bg-[var(--bad-bg)] border-[var(--bad)]'}`}>
           <div className="font-bold mb-1" dangerouslySetInnerHTML={{ __html: feedback.message }}></div>
        </div>
      )}

      {/* Footer Controls */}
      <div className="flex justify-between items-center mt-6">
        <button className="btn ghost text-[var(--warn)] hover:text-white" onClick={() => setState('setup')}>Quit Quiz</button>
        {feedback && (
          <button className="btn primary" onClick={nextQuestion}>Next Question →</button>
        )}
      </div>
    </div>
  );
}

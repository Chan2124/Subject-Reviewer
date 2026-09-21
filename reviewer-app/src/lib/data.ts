import fs from 'fs';
import path from 'path';

export interface Card {
  category: string;
  question: string;
  answer: string;
  explanation: string;
}

export interface Question {
  type: 'mc' | 'fb' | 'tf' | 'match';
  category: string;
  question: string;
  options?: string[];
  pairs?: [string, string][];
  correctAnswer?: number | string | string[];
  explanation: string;
}

export interface Lesson {
  category: string;
  title: string;
  text: string;
}

export interface SubjectData {
  id: string;
  title: string;
  description: string;
  categories: string[];
  cards: Card[];
  questions: Question[];
  lessons?: Lesson[];
}

export function getAllSubjects(): Omit<SubjectData, 'cards' | 'questions'>[] {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) return [];
  const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.json'));

  return files.map((file) => {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content) as SubjectData;
    return {
      id: parsed.id,
      title: parsed.title,
      description: parsed.description,
      categories: parsed.categories,
    };
  });
}

export function getSubjectById(id: string): SubjectData | null {
  const filePath = path.join(process.cwd(), 'data', `${id}.json`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as SubjectData;
}

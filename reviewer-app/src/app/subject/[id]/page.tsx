import { getSubjectById, getAllSubjects } from '@/lib/data';
import { notFound } from 'next/navigation';
import SubjectClient from './SubjectClient';

export async function generateStaticParams() {
  const subjects = getAllSubjects();
  return subjects.map((s) => ({
    id: s.id,
  }));
}

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subject = getSubjectById(id);
  
  if (!subject) {
    notFound();
  }

  return <SubjectClient subject={subject} />;
}

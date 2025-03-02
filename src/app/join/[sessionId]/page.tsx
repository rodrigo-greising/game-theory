// This is the server component that receives the params
import { Suspense } from 'react';
import JoinClient from './JoinClient';

type JoinPageProps = {
  params: {
    sessionId: string;
  };
};

export default async function JoinSessionPage({ params }: JoinPageProps) {
  // In Next.js 15, we need to await params before accessing its properties
  const resolvedParams = await params;
  const sessionId = resolvedParams.sessionId;
  
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-lg">Loading...</p>
      </div>
    }>
      <JoinClient sessionId={sessionId} />
    </Suspense>
  );
} 
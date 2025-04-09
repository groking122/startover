'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Loading component for the dynamic import
const LoadingFallback = () => (
  <div className="flex flex-col h-screen bg-gray-900 text-white">
    <div className="flex-1 container mx-auto p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-xl text-gray-300">Initializing wallet interface...</p>
      </div>
    </div>
  </div>
);

// Dynamically import the HomeClient component with no SSR
const HomeClient = dynamic(
  () => import('./HomeClient'),
  { 
    ssr: false,
    loading: () => <LoadingFallback />
  }
);

export default function ClientHomeWrapper() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeClient />
    </Suspense>
  );
} 
import { Suspense } from 'react';
import ClientHomeWrapper from '../components/ClientHomeWrapper';

// Create a loading component for the Suspense fallback
const Loading = () => (
  <div className="flex flex-col h-screen bg-gray-900 text-white">
    <div className="flex-1 container mx-auto p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-xl text-gray-300">Loading wallet interface...</p>
      </div>
    </div>
  </div>
);

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <ClientHomeWrapper />
    </Suspense>
  );
}

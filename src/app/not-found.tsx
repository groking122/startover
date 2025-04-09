'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

// Basic server-rendered version with no client-side dependencies
function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-5xl font-bold">404</h1>
        <h2 className="text-2xl font-medium">Page Not Found</h2>
        <p className="text-gray-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/" className="inline-block px-6 py-3 rounded-md bg-blue-600 hover:bg-blue-700 transition-colors">
          Return Home
        </Link>
      </div>
    </div>
  );
}

// Export the component with SSR disabled
export default dynamic(() => Promise.resolve(NotFoundPage), { ssr: false }); 
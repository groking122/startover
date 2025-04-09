import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-5xl font-bold">404</h1>
        <h2 className="text-2xl font-medium">Page Not Found</h2>
        <p className="text-gray-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="inline-block px-6 py-3 rounded-md bg-blue-600 hover:bg-blue-700 transition-colors">
          <Link href="/" className="text-white no-underline">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
} 
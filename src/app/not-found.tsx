export const runtime = 'edge';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#111827',
      color: 'white',
      padding: '1rem'
    }}>
      <div style={{
        maxWidth: '28rem',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          marginBottom: '1rem'
        }}>404</h1>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '500',
          marginBottom: '1rem'
        }}>Page Not Found</h2>
        <p style={{
          color: '#9CA3AF',
          marginBottom: '1.5rem'
        }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563EB',
            color: 'white',
            borderRadius: '0.375rem',
            textDecoration: 'none'
          }}
        >
          Return Home
        </a>
      </div>
    </div>
  );
} 
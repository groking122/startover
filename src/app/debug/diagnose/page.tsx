'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the actual diagnostic component with SSR disabled
const DiagnoseComponent = dynamic(
  () => import('@/components/diagnostics/DiagnoseComponent'),
  { ssr: false }
);

/**
 * Wallet Signature Diagnostic Tool - Page Wrapper
 * 
 * This component serves as a server-safe wrapper that loads the actual
 * diagnostic functionality only on the client side.
 */
export default function DiagnosePage() {
  const [isMounted, setIsMounted] = useState(false);
  
  // Only show content after component has mounted on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  if (!isMounted) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Wallet Signature Diagnostic Tool</h1>
        <p>Loading wallet diagnostic tools...</p>
      </div>
    );
  }
  
  return <DiagnoseComponent />;
} 
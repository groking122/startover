'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the providers to avoid SSR errors
const CardanoProvider = dynamic(
  () => import('./CardanoProvider'),
  { ssr: false }
);

// Dynamically import the WalletIdentityProvider to avoid SSR errors
const WalletIdentityProviderClient = dynamic(
  () => import('../../contexts/WalletIdentityContext').then(mod => ({ default: mod.WalletIdentityProvider })),
  { ssr: false }
);

export default function ClientOnlyWalletProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Ensure we're in the browser before rendering wallet-related components
  useEffect(() => {
    setMounted(true);
  }, []);

  // When not mounted yet (during SSR), render just the children
  if (!mounted) {
    // The first render on the client happens before useEffect runs, 
    // so we need to render a placeholder to avoid hydration errors
    return <>{children}</>;
  }

  // Once mounted (client-side only), render the providers
  return (
    <CardanoProvider>
      <WalletIdentityProviderClient>
        {children}
      </WalletIdentityProviderClient>
    </CardanoProvider>
  );
} 
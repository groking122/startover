'use client';

import { ReactNode, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';
import SessionExpiredModal from '../session/SessionExpiredModal';

// Dynamically import the providers to avoid SSR errors
const CardanoProviderDynamic = dynamic(
  () => import('./CardanoProvider'),
  { ssr: false }
);

// Dynamically import the WalletIdentityProvider to avoid SSR errors
const WalletIdentityProviderClient = dynamic(
  () => import('../../contexts/WalletIdentityContext').then(mod => ({ default: mod.WalletIdentityProvider })),
  { ssr: false }
);

interface ClientOnlyWalletProvidersProps {
  children: ReactNode;
}

export default function ClientOnlyWalletProviders({ children }: ClientOnlyWalletProvidersProps) {
  const [mounted, setMounted] = useState(false);

  // When mounted on client, now we can render
  useEffect(() => {
    setMounted(true);
  }, []);

  // If not mounted yet (server-side), render nothing
  if (!mounted) {
    return <>{children}</>;
  }
  
  // Once mounted (client-side only), render the providers
  return (
    <CardanoProviderDynamic>
      <WalletIdentityProviderClient>
        <Toaster position="top-right" />
        <SessionExpiredModal checkInterval={30000} />
        {children}
      </WalletIdentityProviderClient>
    </CardanoProviderDynamic>
  );
} 
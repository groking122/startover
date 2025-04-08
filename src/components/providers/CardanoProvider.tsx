'use client';

import React from 'react';

/**
 * CardanoProvider component
 * This is a placeholder for the Cardano wallet provider
 * The actual wallet functionality is initialized from the WalletComponents
 */
export default function CardanoProvider({ children }: { children: React.ReactNode }) {
  // The library doesn't seem to have a provider component
  // The wallet functionality is initialized directly in the components that use it
  return <>{children}</>;
} 
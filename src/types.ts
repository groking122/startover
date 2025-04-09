export interface Chat {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'peer';
  timestamp: Date;
}

// Cardano wallet interface definitions
export interface CardanoAPI {
  getNetworkId: () => Promise<number>;
  getBalance: () => Promise<Record<string, unknown>>;
  getUsedAddresses: () => Promise<string[]>;
  getUnusedAddresses: () => Promise<string[]>;
  getChangeAddress: () => Promise<string>;
  getRewardAddresses: () => Promise<string[]>;
  signTx: (tx: string, partialSign: boolean) => Promise<string>;
  signData: (address: string, payload: string) => Promise<{ signature: string; key: string }>;
  submitTx: (tx: string) => Promise<string>;
  [key: string]: unknown;
}

export interface CardanoWallet {
  enable: () => Promise<CardanoAPI>;
  apiVersion: string;
  name: string;
  icon: string;
  [key: string]: unknown;
}

export interface CardanoWindow {
  cardano: {
    [walletId: string]: CardanoWallet;
  }
}

// Augment the Window interface
declare global {
  interface Window extends CardanoWindow {}
} 
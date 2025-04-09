declare global {
  interface Window {
    cardano: {
      [key: string]: {
        enable: () => Promise<{
          getChangeAddress: () => Promise<string>;
          getUsedAddresses: () => Promise<string[]>;
          getRewardAddresses: () => Promise<string[]>;
          signData: (address: string, message: string) => Promise<{
            key: string;
            signature: string;
          }>;
        }>;
        isEnabled: () => Promise<boolean>;
      };
    };
  }
}

export {}; 
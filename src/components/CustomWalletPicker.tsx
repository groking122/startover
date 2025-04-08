import React, { useEffect, useState } from 'react';
import { getWalletPickerConfig } from '@/utils/walletUtils';

export interface WalletOption {
  id: string;
  name: string;
  icon: string;
  isVespr: boolean;
}

interface CustomWalletPickerProps {
  onConnect: (walletId: string) => void;
  onCancel: () => void;
}

const CustomWalletPicker: React.FC<CustomWalletPickerProps> = ({ onConnect, onCancel }) => {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Only run on the client side
    if (typeof window !== 'undefined') {
      setLoading(true);
      
      // Small delay to ensure wallets are fully loaded
      setTimeout(() => {
        const availableWallets = getWalletPickerConfig();
        setWallets(availableWallets);
        setLoading(false);
      }, 500);
    }
  }, []);
  
  if (loading) {
    return (
      <div className="bg-white text-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Loading Wallets...</h3>
        <div className="flex justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white text-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
      <h3 className="text-xl font-bold mb-4">Select a Wallet</h3>
      <p className="text-sm text-gray-600 mb-4">
        Connect your Cardano wallet to access all features
      </p>
      
      {wallets.length === 0 ? (
        <div className="text-center p-4 bg-red-100 text-red-800 rounded mb-4">
          No Cardano wallets detected. Please install one to continue.
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {/* Highlight Vespr wallet if available */}
          {wallets.filter(w => w.isVespr).length > 0 && (
            <div className="mb-4">
              <h4 className="text-md font-semibold text-green-600 mb-2 flex items-center">
                <span className="mr-2">✨</span>
                Recommended Wallet
              </h4>
              <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                {wallets
                  .filter(wallet => wallet.isVespr)
                  .map(wallet => (
                    <button
                      key={wallet.id}
                      onClick={() => onConnect(wallet.id)}
                      className="w-full flex items-center justify-between p-3 rounded hover:bg-green-100 transition-colors"
                    >
                      <div className="flex items-center">
                        {wallet.icon ? (
                          <img src={wallet.icon} alt={wallet.name} className="h-6 w-6 mr-2" />
                        ) : (
                          <div className="h-6 w-6 bg-green-200 rounded-full mr-2 flex items-center justify-center">
                            <span className="text-xs">V</span>
                          </div>
                        )}
                        <span className="font-medium">{wallet.name}</span>
                      </div>
                      <span className="text-green-600 text-sm">Connect</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          
          {/* Other wallets */}
          <h4 className="text-md font-semibold text-gray-600 mb-2">
            Available Wallets
          </h4>
          {wallets
            .filter(wallet => !wallet.isVespr)
            .map(wallet => (
              <button
                key={wallet.id}
                onClick={() => onConnect(wallet.id)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  {wallet.icon ? (
                    <img src={wallet.icon} alt={wallet.name} className="h-6 w-6 mr-2" />
                  ) : (
                    <div className="h-6 w-6 bg-gray-200 rounded-full mr-2 flex items-center justify-center">
                      <span className="text-xs">{wallet.name.charAt(0)}</span>
                    </div>
                  )}
                  <span>{wallet.name}</span>
                </div>
                <span className="text-indigo-600 text-sm">Connect</span>
              </button>
            ))}
        </div>
      )}
      
      <button 
        onClick={onCancel}
        className="mt-4 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition-colors w-full"
      >
        Cancel
      </button>
    </div>
  );
};

export default CustomWalletPicker; 
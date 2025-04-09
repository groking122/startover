import React, { useState } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import { toHex } from '@/utils/client/stringUtils';

/**
 * Wallet Signature Diagnostic Tool
 * 
 * This component helps diagnose issues with Cardano wallet signatures by:
 * 1. Testing signature generation with simple messages
 * 2. Analyzing signature formats
 * 3. Testing verification with both hex and raw message formats
 */
const DiagnoseComponent: React.FC = () => {
  const { isVerified, stakeAddress, walletIdentityError, verifyWalletIdentityManually } = useWalletIdentity();
  const [testMessage, setTestMessage] = useState('test message');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [walletResponse, setWalletResponse] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  
  // Get wallet API
  const getWalletApi = async () => {
    try {
      if (!window.cardano) {
        throw new Error('Cardano object not found. Please install a wallet extension.');
      }
      
      // Get first wallet
      const wallets = Object.keys(window.cardano);
      if (wallets.length === 0) {
        throw new Error('No Cardano wallets found.');
      }
      
      const walletKey = wallets[0];
      console.log(`Using wallet: ${walletKey}`);
      
      return await window.cardano[walletKey].enable();
    } catch (error) {
      console.error('Error getting wallet API:', error);
      throw error;
    }
  };
  
  // Sign a test message
  const signTestMessage = async () => {
    try {
      setLoading(true);
      setResults(null);
      setWalletResponse(null);
      setVerificationResult(null);
      
      console.log(`Signing test message: "${testMessage}"`);
      
      // Get wallet API
      const api = await getWalletApi();
      
      // Get payment address (needed for signing)
      const paymentAddress = await api.getChangeAddress();
      console.log(`Payment address: ${paymentAddress}`);
      
      // Convert message to hex (required by CIP-30)
      const messageHex = toHex(testMessage);
      console.log(`Message hex: ${messageHex}`);
      
      // Sign the message
      const signResult = await api.signData(paymentAddress, messageHex);
      console.log('Sign result:', signResult);
      
      // Get the public key
      const pubKey = signResult.key;
      
      // Store wallet response
      setWalletResponse({
        walletName: Object.keys(window.cardano)[0],
        paymentAddress,
        pubKey,
        signature: signResult.signature,
        messageHex,
        rawMessage: testMessage
      });
      
      // Analyze signature with our diagnostic endpoint
      const analysisResponse = await fetch('/api/debug/wallet-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletName: Object.keys(window.cardano)[0],
          paymentAddress,
          pubKey,
          signature: signResult.signature
        })
      });
      
      const analysisResult = await analysisResponse.json();
      setResults(analysisResult);
      
      // Also test verification
      await testVerification({
        pubKey,
        signature: signResult.signature,
        message: messageHex,
        rawMessage: testMessage
      });
      
    } catch (error) {
      console.error('Error signing test message:', error);
      setResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Test verification
  const testVerification = async (data: any) => {
    try {
      const response = await fetch('/api/debug/verify-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      setVerificationResult(result);
      return result;
    } catch (error) {
      console.error('Error testing verification:', error);
      setVerificationResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Wallet Signature Diagnostic Tool</h1>
      
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">1. Test Message Signing</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Test Message:</label>
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            className="w-full p-2 bg-gray-700 text-white rounded"
          />
        </div>
        <button
          onClick={signTestMessage}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Signing...' : 'Sign Test Message'}
        </button>
      </div>
      
      {walletResponse && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Wallet Response</h2>
          <div className="overflow-x-auto">
            <pre className="bg-gray-900 p-3 rounded text-sm">
              {JSON.stringify({
                walletName: walletResponse.walletName,
                messageHex: walletResponse.messageHex,
                messageHexLength: walletResponse.messageHex?.length,
                rawMessage: walletResponse.rawMessage,
                pubKeyPreview: walletResponse.pubKey?.substring(0, 20) + '...',
                pubKeyLength: walletResponse.pubKey?.length,
                signaturePreview: walletResponse.signature?.substring(0, 20) + '...',
                signatureLength: walletResponse.signature?.length,
              }, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      {verificationResult && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Verification Results</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-3 rounded">
              <h3 className="font-medium mb-1">Hex Message Verification:</h3>
              <div className={`text-lg font-bold ${verificationResult.results?.hexVerification ? 'text-green-500' : 'text-red-500'}`}>
                {verificationResult.results?.hexVerification ? 'SUCCESS ✅' : 'FAILED ❌'}
              </div>
            </div>
            <div className="bg-gray-700 p-3 rounded">
              <h3 className="font-medium mb-1">Raw Message Verification:</h3>
              <div className={`text-lg font-bold ${verificationResult.results?.rawVerification ? 'text-green-500' : 'text-red-500'}`}>
                {verificationResult.results?.rawVerification ? 'SUCCESS ✅' : 'FAILED ❌'}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {results && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Signature Analysis</h2>
          
          <div className="mb-4">
            <h3 className="font-medium mb-1">Signature Info:</h3>
            <div className="bg-gray-900 p-3 rounded">
              <div><span className="font-medium">Hex Length:</span> {results.signatureInfo?.hexLength}</div>
              <div><span className="font-medium">Byte Length:</span> {results.signatureInfo?.byteLength}</div>
              <div><span className="font-medium">Valid Hex:</span> {results.signatureInfo?.isValidHex ? 'Yes ✅' : 'No ❌'}</div>
              <div><span className="font-medium">Preview:</span> {results.signatureInfo?.preview}</div>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-1">Signature Structure:</h3>
            <div className="bg-gray-900 p-3 rounded">
              <div><span className="font-medium">First Byte (Hex):</span> 0x{results.signatureAnalysis?.firstByteHex}</div>
              <div><span className="font-medium">First 4 Bytes:</span> {results.signatureAnalysis?.first4Bytes}</div>
              <div><span className="font-medium">First 4 Bytes (Hex):</span> {results.signatureAnalysis?.first4BytesHex}</div>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-1">Format Detection:</h3>
            <div className="bg-gray-900 p-3 rounded">
              <div><span className="font-medium">Detected Format:</span> {results.formatDetection?.detectedFormat}</div>
              <div><span className="font-medium">COSE_Sign1 Format:</span> {results.formatDetection?.isCOSESign1 ? 'Yes ✅' : 'No'}</div>
              <div><span className="font-medium">Eternl Format:</span> {results.formatDetection?.isEternlFormat ? 'Yes ✅' : 'No'}</div>
              <div><span className="font-medium">Raw Ed25519:</span> {results.formatDetection?.isRawEd25519 ? 'Yes ✅' : 'No'}</div>
              <div className="mt-2"><span className="font-medium">Possible Formats:</span></div>
              <ul className="list-disc list-inside ml-2">
                {results.formatDetection?.possibleFormats?.map((format: string, index: number) => (
                  <li key={index}>{format}</li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-1">Signature Extraction:</h3>
            <div className="bg-gray-900 p-3 rounded">
              <div><span className="font-medium">Success:</span> {results.extractionInfo?.success ? 'Yes ✅' : 'No ❌'}</div>
              <div><span className="font-medium">Method:</span> {results.extractionInfo?.method}</div>
              <div><span className="font-medium">Extracted Length:</span> {results.extractionInfo?.extractedLength} bytes</div>
              <div><span className="font-medium">Extracted Preview:</span> {results.extractionInfo?.extractedPreview}</div>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-1">Recommendations:</h3>
            <div className="bg-gray-900 p-3 rounded">
              <ul className="list-disc list-inside">
                {results.recommendations?.map((rec: string, index: number) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Wallet Status</h2>
        <div className="mb-4">
          <div className="font-medium mb-1">Verification Status:</div>
          <div className={`text-lg font-bold ${isVerified ? 'text-green-500' : 'text-yellow-500'}`}>
            {isVerified ? 'VERIFIED ✅' : 'NOT VERIFIED ⚠️'}
          </div>
        </div>
        
        {stakeAddress && (
          <div className="mb-4">
            <div className="font-medium mb-1">Stake Address:</div>
            <div className="bg-gray-900 p-2 rounded text-sm break-all">
              {stakeAddress}
            </div>
          </div>
        )}
        
        {walletIdentityError && (
          <div className="mb-4">
            <div className="font-medium mb-1">Error:</div>
            <div className="bg-red-900/50 text-red-300 p-2 rounded text-sm">
              {walletIdentityError}
            </div>
          </div>
        )}
        
        <button
          onClick={verifyWalletIdentityManually}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Verify Wallet Identity
        </button>
      </div>
    </div>
  );
};

export default DiagnoseComponent; 
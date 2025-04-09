import { NextRequest, NextResponse } from 'next/server';
import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';

// Common Cardano wallet prefixes to check for
const KNOWN_PREFIXES = {
  'COSE_Sign1': 0x84, // Standard COSE_Sign1 format
  'Eternl': 0x82,     // Eternl wallet often uses this
  'Other_CBOR': 0x44  // Another common CBOR tag
};

/**
 * Diagnose wallet signature issues by analyzing the raw signature
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentAddress, pubKey, signature, walletName } = await req.json();

    if (!signature) {
      return NextResponse.json({
        success: false,
        error: 'Signature is required'
      }, { status: 400 });
    }

    // Comprehensive signature analysis
    const sigBuffer = Buffer.from(signature, 'hex');
    
    // Basic signature information
    const sigInfo = {
      hexLength: signature.length,
      byteLength: sigBuffer.length,
      isValidHex: /^[0-9a-f]+$/i.test(signature),
      preview: signature.substring(0, 40) + '...'
    };
    
    // Analyze the signature structure
    const sigAnalysis = {
      firstByte: sigBuffer[0],
      firstByteHex: sigBuffer[0]?.toString(16),
      first4Bytes: Array.from(sigBuffer.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' '),
      first4BytesHex: sigBuffer.slice(0, 4).toString('hex'),
      last4Bytes: Array.from(sigBuffer.slice(-4)).map(b => b.toString(16).padStart(2, '0')).join(' '),
      last4BytesHex: sigBuffer.slice(-4).toString('hex')
    };
    
    // Detect signature format
    const formatDetection = {
      detectedFormat: 'Unknown',
      isCOSESign1: sigBuffer[0] === KNOWN_PREFIXES.COSE_Sign1,
      isEternlFormat: sigBuffer[0] === KNOWN_PREFIXES.Eternl,
      isRawEd25519: sigBuffer.length === 64,
      possibleFormats: []
    };
    
    // Check for known signature formats
    if (formatDetection.isCOSESign1) {
      formatDetection.detectedFormat = 'COSE_Sign1';
      formatDetection.possibleFormats.push('COSE_Sign1');
    }
    
    if (formatDetection.isEternlFormat) {
      formatDetection.detectedFormat = 'Eternl';
      formatDetection.possibleFormats.push('Eternl');
    }
    
    if (formatDetection.isRawEd25519) {
      formatDetection.detectedFormat = 'Raw Ed25519';
      formatDetection.possibleFormats.push('Raw Ed25519');
    }
    
    if (sigBuffer.length === 70) {
      formatDetection.possibleFormats.push('Common 70-byte format (likely signature at bytes 3-67)');
    }
    
    if (sigBuffer.length === 72) {
      formatDetection.possibleFormats.push('Common 72-byte format (likely signature at bytes 4-68)');
    }
    
    // Normalize and extract what should be the Ed25519 signature
    let extractedSignature;
    let extractionMethod = '';
    
    try {
      if (sigBuffer.length === 64) {
        // Already correct format
        extractedSignature = sigBuffer;
        extractionMethod = 'Already 64-byte signature';
      } 
      else if (sigBuffer.length === 70) {
        // Common 70-byte format
        extractedSignature = sigBuffer.slice(3, 67);
        extractionMethod = 'Extracted bytes 3-67 from 70-byte signature';
      }
      else if (sigBuffer.length === 72) {
        // Common 72-byte format
        extractedSignature = sigBuffer.slice(4, 68);
        extractionMethod = 'Extracted bytes 4-68 from 72-byte signature';
      }
      else if (formatDetection.isCOSESign1) {
        // Try standard COSE_Sign1 extraction (last 64 bytes)
        extractedSignature = sigBuffer.slice(sigBuffer.length - 64);
        extractionMethod = 'Extracted last 64 bytes from COSE_Sign1 structure';
      }
      else {
        // Fallback to last 64 bytes
        extractedSignature = sigBuffer.slice(sigBuffer.length - 64);
        extractionMethod = 'Fallback: extracted last 64 bytes';
      }
    } catch (error) {
      extractionMethod = 'Error: ' + (error instanceof Error ? error.message : 'Unknown error');
      extractedSignature = null;
    }
    
    // Validate extracted signature
    const extractionInfo = {
      success: !!extractedSignature && extractedSignature.length === 64,
      method: extractionMethod,
      extractedLength: extractedSignature?.length || 0,
      extractedPreview: extractedSignature?.toString('hex').substring(0, 40) + '...'
    };
    
    // Check if public key is valid
    let pubKeyInfo = {
      hexLength: pubKey?.length || 0,
      byteLength: 0,
      isValidHex: false,
      isValidFormat: false,
      error: null
    };
    
    try {
      if (pubKey) {
        const pubKeyBuffer = Buffer.from(pubKey, 'hex');
        pubKeyInfo.byteLength = pubKeyBuffer.length;
        pubKeyInfo.isValidHex = /^[0-9a-f]+$/i.test(pubKey);
        
        // Try to parse with Cardano Serialization Library
        try {
          const publicKey = CSL.PublicKey.from_hex(pubKey);
          pubKeyInfo.isValidFormat = true;
        } catch (e) {
          pubKeyInfo.isValidFormat = false;
          pubKeyInfo.error = e instanceof Error ? e.message : 'Unknown error';
        }
      }
    } catch (error) {
      pubKeyInfo.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    return NextResponse.json({
      success: true,
      walletName,
      signatureInfo: sigInfo,
      signatureAnalysis: sigAnalysis,
      formatDetection,
      extractionInfo,
      publicKeyInfo: pubKeyInfo,
      recommendations: getRecommendations(formatDetection, extractionInfo, pubKeyInfo)
    });
    
  } catch (error) {
    console.error('Error in wallet-test endpoint:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Generate wallet-specific recommendations based on analysis
 */
function getRecommendations(formatDetection: any, extractionInfo: any, pubKeyInfo: any) {
  const recommendations = [];
  
  if (!extractionInfo.success) {
    recommendations.push('❌ Unable to extract a valid 64-byte signature. Try a different normalization strategy.');
  }
  
  if (formatDetection.isCOSESign1) {
    recommendations.push('✅ COSE_Sign1 format detected. Use COSE libraries or extract the last 64 bytes.');
  }
  
  if (formatDetection.isEternlFormat) {
    recommendations.push('✅ Eternl wallet format detected. Try extracting bytes 3-67.');
  }
  
  if (!pubKeyInfo.isValidFormat) {
    recommendations.push('❌ Public key format is invalid. Ensure it\'s a proper hex-encoded ED25519 public key.');
  }
  
  if (pubKeyInfo.byteLength !== 32) {
    recommendations.push(`❌ Public key should be 32 bytes, but got ${pubKeyInfo.byteLength} bytes.`);
  }
  
  // Add wallet-specific recommendations
  if (formatDetection.detectedFormat === 'COSE_Sign1') {
    recommendations.push('ℹ️ For COSE_Sign1 format, use CBOR library to decode the signature properly.');
  }
  
  if (formatDetection.detectedFormat === 'Eternl') {
    recommendations.push('ℹ️ For Eternl wallet, extract bytes 3-67 from the signature.');
  }
  
  if (extractionInfo.success) {
    recommendations.push('✅ Successfully extracted 64-byte signature using: ' + extractionInfo.method);
  }
  
  return recommendations;
} 
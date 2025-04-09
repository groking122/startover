'use client';

import { CardanoAPI } from "../types";
import type { Cip30Wallet } from '@cardano-sdk/cip30';

// Types - will be dynamically imported
type Lucid = any;
type Blockfrost = any;

// In-memory cache for the Lucid instance
let lucidInstance: Lucid | null = null;

/**
 * Get a Lucid instance initialized with the provided wallet API.
 * This function memoizes the Lucid instance to avoid multiple initializations.
 * 
 * @param walletApi The wallet API instance returned from wallet.enable()
 * @returns A Promise that resolves to a Lucid instance
 */
export const getLucidInstance = async (walletApi: Cip30Wallet): Promise<Lucid | null> => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    console.warn("Lucid can only be initialized in a browser environment");
    return null;
  }
  
  // If we already have an instance, return it
  if (lucidInstance) {
    // Update wallet provider and return existing instance - using type assertion for compatibility
    return lucidInstance.selectWallet(walletApi as any);
  }
  
  // Get Blockfrost API key from environment variable
  const blockfrostKey = process.env.NEXT_PUBLIC_BLOCKFROST_KEY;
  
  if (!blockfrostKey) {
    throw new Error("Blockfrost API key is not set. Please add NEXT_PUBLIC_BLOCKFROST_KEY to your .env file.");
  }
  
  try {
    // Dynamically import lucid-cardano
    const lucidCardano = await import('lucid-cardano');
    const { Lucid, Blockfrost } = lucidCardano;
    
    // Initialize Lucid with Blockfrost provider (mainnet)
    const lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-mainnet.blockfrost.io/api/v0",
        blockfrostKey
      ),
      "Mainnet" // Use string literal instead of enum
    );
    
    // Select the wallet - using type assertion for compatibility
    lucidInstance = lucid.selectWallet(walletApi as any);
    
    return lucidInstance;
  } catch (error) {
    console.error("Error initializing Lucid:", error);
    throw new Error(`Failed to initialize Lucid: ${error}`);
  }
};

/**
 * Convert ADA amount to Lovelace (1 ADA = 1,000,000 Lovelace)
 * 
 * @param ada Amount in ADA
 * @returns Amount in Lovelace as a BigInt
 */
export const adaToLovelace = (ada: number): bigint => {
  return BigInt(Math.round(ada * 1_000_000));
};

/**
 * Convert Lovelace amount to ADA
 * 
 * @param lovelace Amount in Lovelace
 * @returns Amount in ADA as a number
 */
export const lovelaceToAda = (lovelace: bigint): number => {
  return Number(lovelace) / 1_000_000;
}; 
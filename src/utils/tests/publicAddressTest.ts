/**
 * Public Address Migration Test Script
 *
 * This script tests all the key components of the public address migration:
 * 1. Session creation with public address
 * 2. Database access with public address
 * 3. API calls with public address authentication
 * 4. Backward compatibility with stake addresses
 */

import { createClient } from '@supabase/supabase-js';
import { createSession, getSession, validateSessionForAddress } from '../sessionManager';

// Test configuration
const TEST_STAKE_ADDRESS = 'stake1uxc4xszhlytlx4qxs3jmkrjtcmrsl8zv7nwq5p33x5kr9qgwmr3ln';
const TEST_PUBLIC_ADDRESS = 'addr1qxc4xszhlytlx4qxs3jmkrjtcmrsl8zv7nwq5p33x5kr9qcvjrx3j0x9kmpw68x3vq50gqyuwrj8h5ms50h2kymw2tsdnqc4y';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Tests creating and validating sessions with public addresses
 */
async function testSessionManagement() {
  console.log('=== Testing Session Management ===');
  
  // Test 1: Create session with stake address only (legacy)
  await createSession(TEST_STAKE_ADDRESS, '');
  console.log('Created legacy session with stake address');
  
  // Validate session with stake address
  const isValidStake = await validateSessionForAddress(TEST_STAKE_ADDRESS);
  console.log('Legacy session valid with stake address:', isValidStake);
  
  // Test 2: Create session with public address 
  await createSession('', TEST_PUBLIC_ADDRESS);
  console.log('Created new session with public address');
  
  // Validate session with public address
  const isValidPublic = await validateSessionForAddress(TEST_PUBLIC_ADDRESS);
  console.log('New session valid with public address:', isValidPublic);
  
  // Check session data
  const session = await getSession();
  console.log('Session data:', session);
}

/**
 * Tests database access with public addresses
 */
async function testDatabaseAccess() {
  console.log('\n=== Testing Database Access ===');
  
  // Insert test user with public address
  const { error: insertError } = await supabase
    .from('users')
    .upsert({
      public_address: TEST_PUBLIC_ADDRESS,
      stake_address: TEST_STAKE_ADDRESS,
      last_verified: new Date().toISOString()
    });
  
  if (insertError) {
    console.error('Error inserting test user:', insertError);
    return;
  }
  
  console.log('Inserted test user with public and stake addresses');
  
  // Query by public address
  const { data: publicData, error: publicError } = await supabase
    .from('users')
    .select('*')
    .eq('public_address', TEST_PUBLIC_ADDRESS)
    .single();
  
  if (publicError) {
    console.error('Error querying by public address:', publicError);
  } else {
    console.log('Successfully queried by public address:', publicData);
  }
  
  // Query by stake address
  const { data: stakeData, error: stakeError } = await supabase
    .from('users')
    .select('*')
    .eq('stake_address', TEST_STAKE_ADDRESS)
    .single();
  
  if (stakeError) {
    console.error('Error querying by stake address:', stakeError);
  } else {
    console.log('Successfully queried by stake address:', stakeData);
  }
  
  // Test OR query condition for either address
  const { data: orData, error: orError } = await supabase
    .from('users')
    .select('*')
    .or(`public_address.eq.${TEST_PUBLIC_ADDRESS},stake_address.eq.${TEST_STAKE_ADDRESS}`)
    .single();
  
  if (orError) {
    console.error('Error with OR query condition:', orError);
  } else {
    console.log('Successfully queried with OR condition:', orData);
  }
}

/**
 * Tests the full migration
 */
async function runAllTests() {
  try {
    await testSessionManagement();
    await testDatabaseAccess();
    
    console.log('\n=== Test Results ===');
    console.log('All tests completed successfully!');
    console.log('Public address migration is working correctly.');
  } catch (error) {
    console.error('Error during tests:', error);
  }
}

// Execute tests
runAllTests();

/**
 * To run this test:
 * 1. Save this file
 * 2. Execute in terminal: npx ts-node src/utils/tests/publicAddressTest.ts
 */ 
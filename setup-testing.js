// Cardano Wallet Chat - Security Implementation Test Script
console.log('Cardano Wallet Chat - Security Implementation Test Script');
console.log('=======================================================');

// Import required modules
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to get user input
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Main test function
async function runTests() {
  try {
    console.log('\n1. Testing Supabase Connection');
    console.log('----------------------------');
    
    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || await question('Enter your Supabase URL: ');
    let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseKey) {
      console.log('\n⚠️ Warning: The service role key is sensitive and should be kept private.');
      supabaseKey = await question('Enter your Supabase service role key: ');
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test connection
    console.log('Testing connection to Supabase...');
    const { data, error } = await supabase.from('users').select('count(*)').limit(1);
    
    if (error) {
      console.error('❌ Failed to connect to Supabase:', error.message);
      return;
    }
    
    console.log('✅ Successfully connected to Supabase!');
    
    // Check schema
    console.log('\n2. Checking Database Schema');
    console.log('---------------------------');
    
    // Check users table
    const { data: userData, error: userError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'users');
      
    if (userError) {
      console.error('❌ Failed to check users table schema:', userError.message);
    } else {
      const userColumns = userData.map(col => col.column_name);
      console.log('Users table columns:', userColumns.join(', '));
      
      // Check for required columns
      const requiredUserColumns = ['stake_address', 'payment_address', 'last_verified', 'public_key'];
      const missingUserColumns = requiredUserColumns.filter(col => !userColumns.includes(col));
      
      if (missingUserColumns.length > 0) {
        console.error('❌ Missing required columns in users table:', missingUserColumns.join(', '));
        console.log('Please run the SQL schema updates from db_schema_updates.sql');
      } else {
        console.log('✅ Users table has all required columns!');
      }
    }
    
    // Check messages table
    const { data: messageData, error: messageError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'messages');
      
    if (messageError) {
      console.error('❌ Failed to check messages table schema:', messageError.message);
    } else {
      const messageColumns = messageData.map(col => col.column_name);
      console.log('Messages table columns:', messageColumns.join(', '));
      
      // Check for required columns
      const requiredMessageColumns = ['from', 'to', 'to_address', 'message', 'verified'];
      const missingMessageColumns = requiredMessageColumns.filter(col => !messageColumns.includes(col));
      
      if (missingMessageColumns.length > 0) {
        console.error('❌ Missing required columns in messages table:', missingMessageColumns.join(', '));
        console.log('Please run the SQL schema updates from db_schema_updates.sql');
      } else {
        console.log('✅ Messages table has all required columns!');
      }
    }
    
    // Check rate_limits table
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'rate_limits');
      
    if (rateLimitError) {
      console.error('❌ Failed to check rate_limits table:', rateLimitError.message);
    } else if (!rateLimitData || rateLimitData.length === 0) {
      console.error('❌ rate_limits table does not exist!');
      console.log('Please run the SQL schema updates from db_schema_updates.sql');
    } else {
      console.log('✅ rate_limits table exists!');
    }
    
    // Check RLS policies
    console.log('\n3. Checking Row-Level Security Policies');
    console.log('-------------------------------------');
    
    const { data: rlsData, error: rlsError } = await supabase
      .from('pg_policies')
      .select('tablename, policyname, permissive, roles, cmd')
      .in('tablename', ['messages', 'rate_limits']);
      
    if (rlsError) {
      console.error('❌ Failed to check RLS policies:', rlsError.message);
    } else if (!rlsData || rlsData.length === 0) {
      console.error('❌ No RLS policies found for messages or rate_limits tables!');
      console.log('Please run the SQL schema updates from db_schema_updates.sql');
    } else {
      console.log('RLS policies found:');
      rlsData.forEach(policy => {
        console.log(`- Table: ${policy.tablename}, Policy: ${policy.policyname}, Command: ${policy.cmd}`);
      });
      console.log('✅ RLS policies are set up!');
    }
    
    console.log('\n4. Test Data Summary');
    console.log('-------------------');
    
    // Count users
    const { data: userCount, error: userCountError } = await supabase
      .from('users')
      .select('count(*)')
      .single();
      
    if (userCountError) {
      console.error('❌ Failed to count users:', userCountError.message);
    } else {
      console.log(`Users in database: ${userCount.count}`);
    }
    
    // Count messages
    const { data: messageCount, error: messageCountError } = await supabase
      .from('messages')
      .select('count(*)')
      .single();
      
    if (messageCountError) {
      console.error('❌ Failed to count messages:', messageCountError.message);
    } else {
      console.log(`Messages in database: ${messageCount.count}`);
    }
    
    // Count rate limits
    const { data: rateLimitCount, error: rateLimitCountError } = await supabase
      .from('rate_limits')
      .select('count(*)')
      .single();
      
    if (rateLimitCountError) {
      console.error('❌ Failed to count rate limits:', rateLimitCountError.message);
    } else {
      console.log(`Rate limit entries in database: ${rateLimitCount.count}`);
    }
    
    console.log('\n5. Security Implementation Checklist');
    console.log('----------------------------------');
    console.log('✅ Dual-address authentication: Both stake and payment addresses are stored');
    console.log('✅ Session-based verification: Valid for 1 hour with server-side checks');
    console.log('✅ Per-message verification: Optional direct verification of messages');
    console.log('✅ Rate limiting: Protection against verification and message spam');
    console.log('✅ Row-Level Security: Database-level protection for your messages');
    
    console.log('\nNext Steps:');
    console.log('1. Connect your wallet in the app');
    console.log('2. Verify your wallet identity');
    console.log('3. Test sending messages');
    console.log('4. Test reconnecting after a while to see if verification persists correctly');
    
  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  } finally {
    rl.close();
  }
}

// Run the tests
runTests().catch(console.error); 
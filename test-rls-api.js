// RLS Issue Testing Script
// Run: node test-rls-api.js

const SUPABASE_URL = 'https://fsxejkjxyhjiwrihpvyh.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGVqa2p4eWhqaXdyaWhwdnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3Njk2MTUsImV4cCI6MjA3MzM0NTYxNX0.d2sp15_A4jJEfM1dZywA3aWKi5fiZqh1k7ByS317Bis';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGVqa2p4eWhqaXdyaWhwdnloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc2OTYxNSwiZXhwIjoyMDczMzQ1NjE1fQ.zIk3aaSb0cOLty5dzD4OgIcm1sVB7GwZ0Jl8ts25c4k';

async function testSupabaseAccess() {
  console.log('=== Testing Supabase RLS Access ===\n');

  // Test 1: Service Role (bypasses RLS)
  console.log('1. Testing with SERVICE ROLE key (bypasses RLS):');
  try {
    const serviceResponse = await fetch(`${SUPABASE_URL}/rest/v1/staff?select=id,name,email,user_id`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const serviceData = await serviceResponse.json();
    console.log('   Staff records found:', serviceData.length);
    if (serviceData.length > 0) {
      console.log('   Sample record:', serviceData[0]);
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 2: Anon Key (subject to RLS)
  console.log('\n2. Testing with ANON key (subject to RLS):');
  try {
    const anonResponse = await fetch(`${SUPABASE_URL}/rest/v1/staff?select=id,name,email,user_id`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const anonData = await anonResponse.json();
    console.log('   Response:', anonData);
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 3: Login and then access with user token
  console.log('\n3. Testing login flow:');
  try {
    const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@haas.test',
        password: 'password123'
      })
    });

    const loginData = await loginResponse.json();

    if (loginData.access_token) {
      console.log('   Login successful! User ID:', loginData.user?.id);

      // Now try to access staff with user token
      console.log('\n4. Testing staff access with user token:');
      const staffResponse = await fetch(`${SUPABASE_URL}/rest/v1/staff?user_id=eq.${loginData.user.id}`, {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${loginData.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      const staffData = await staffResponse.json();
      console.log('   Staff query response:', staffData);
    } else {
      console.log('   Login failed:', loginData);
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 4: Check RLS policies via service role
  console.log('\n5. Checking RLS policies (via service role):');
  try {
    const policyResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_policies`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const policyData = await policyResponse.text();
    console.log('   RLS check:', policyData);
  } catch (error) {
    console.log('   RLS check not available');
  }
}

testSupabaseAccess();
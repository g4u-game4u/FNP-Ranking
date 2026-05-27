/**
 * Setup script to configure Supabase environment variables
 * Run with: node scripts/setup-supabase-env.js
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env.local');

const SUPABASE_CONFIG = {
  VITE_SUPABASE_URL: 'https://fnp.centralsupernova.com.br',
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5MzMzOTU1LCJleHAiOjE5MzcwMTM5NTV9.2m9jUfgKs8wuBHA6s0omP2ktzJ0dlreeJ_n2--djKPw',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzkzMzM5NTUsImV4cCI6MTkzNzAxMzk1NX0.LEHMolITvfN6LUo6-UzoilG8_0-hl5IawI1h1k4Erps',
};

function setupSupabaseEnv() {
  console.log('🔧 Setting up Supabase environment variables...\n');

  let envContent = '';

  // Read existing .env.local if it exists
  if (fs.existsSync(ENV_FILE)) {
    console.log('📄 Found existing .env.local file');
    envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  } else {
    console.log('📄 Creating new .env.local file');
  }

  // Add Supabase configuration
  const supabaseSection = `
# ============================================================================
# Supabase Configuration
# ============================================================================
VITE_SUPABASE_URL=${SUPABASE_CONFIG.VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_CONFIG.VITE_SUPABASE_ANON_KEY}

# Server-side only (for migration scripts)
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_CONFIG.SUPABASE_SERVICE_ROLE_KEY}
`;

  // Check if Supabase config already exists
  if (envContent.includes('VITE_SUPABASE_URL')) {
    console.log('⚠️  Supabase configuration already exists in .env.local');
    console.log('   Skipping to avoid overwriting existing values');
  } else {
    envContent += supabaseSection;
    fs.writeFileSync(ENV_FILE, envContent);
    console.log('✅ Added Supabase configuration to .env.local');
  }

  console.log('\n📋 Configuration Summary:');
  console.log('   Supabase URL:', SUPABASE_CONFIG.VITE_SUPABASE_URL);
  console.log('   Anon Key: ✓ (configured)');
  console.log('   Service Role Key: ✓ (configured)');

  console.log('\n💡 Next Steps:');
  console.log('   1. Run database schema: Open Supabase Studio and run supabase-schema.sql');
  console.log('   2. Import data: npm run migrate:import');
  console.log('   3. Import to Supabase: npm run migrate:import');
  console.log('   4. Start dev server: npm run dev');
}

// Run setup
try {
  setupSupabaseEnv();
} catch (error) {
  console.error('❌ Error setting up environment:', error.message);
  process.exit(1);
}

/**
 * Seed Auth Users — creates test users via the Supabase Admin API.
 *
 * Direct INSERT into auth.users doesn't work on hosted Supabase because
 * GoTrue has internal state beyond the database tables. This script uses
 * the Admin API (service_role key) to create users properly.
 *
 * Usage:
 *   npx tsx scripts/seed-auth-users.ts
 *
 * Prerequisites:
 *   - .env.local must have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Run this BEFORE running seed.sql in the SQL Editor
 *
 * Safe to re-run: deletes existing seed users first, then re-creates them.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load .env.local (Next.js convention)
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing env vars. Ensure .env.local has:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL\n' +
      '  SUPABASE_SERVICE_ROLE_KEY',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Seed user definitions — UUIDs must match seed.sql
// ---------------------------------------------------------------------------
const SEED_USERS = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'admin@alphasar.test',
    password: 'TestPassword1!',
    display_name: 'Alice Admin',
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    email: 'ic@alphasar.test',
    password: 'TestPassword1!',
    display_name: 'Bob Commander',
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    email: 'ops@alphasar.test',
    password: 'TestPassword1!',
    display_name: 'Carol Ops',
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    email: 'field@alphasar.test',
    password: 'TestPassword1!',
    display_name: 'Dave Field',
  },
  {
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    email: 'observer@alphasar.test',
    password: 'TestPassword1!',
    display_name: 'Eve Observer',
  },
  {
    id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    email: 'admin@betasar.test',
    password: 'TestPassword1!',
    display_name: 'Frank Beta',
  },
] as const;

async function main() {
  console.log(`Seeding ${SEED_USERS.length} auth users...\n`);

  // Step 1: Delete existing seed users (safe if they don't exist)
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const seedEmails = new Set(SEED_USERS.map((u) => u.email));

  for (const existing of allUsers?.users ?? []) {
    if (existing.email && seedEmails.has(existing.email)) {
      const { error } = await supabase.auth.admin.deleteUser(existing.id);
      if (error) {
        console.error(`  Failed to delete ${existing.email}: ${error.message}`);
      } else {
        console.log(`  Deleted existing: ${existing.email}`);
      }
    }
  }

  console.log('');

  // Step 2: Create fresh users via Admin API
  let created = 0;
  for (const user of SEED_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { display_name: user.display_name },
    });

    if (error) {
      console.error(`  FAILED ${user.email}: ${error.message}`);
    } else {
      console.log(`  Created: ${data.user.email} (${data.user.id})`);
      created++;
    }
  }

  console.log(`\nDone! ${created}/${SEED_USERS.length} users created.`);
  if (created === SEED_USERS.length) {
    console.log('\nNext step: run seed.sql in the Supabase SQL Editor');
    console.log('to create organizations, members, incidents, etc.');
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

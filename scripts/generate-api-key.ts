#!/usr/bin/env npx ts-node
/**
 * Generate an API key and its hash for database insertion
 *
 * Usage:
 *   npx ts-node scripts/generate-api-key.ts
 *   npx ts-node scripts/generate-api-key.ts --env=test
 */

import * as crypto from 'crypto';

const env = process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'live';

if (env !== 'live' && env !== 'test') {
  console.error('Environment must be "live" or "test"');
  process.exit(1);
}

// Generate 32 random alphanumeric characters
const randomPart = crypto.randomBytes(24).toString('base64')
  .replace(/[^a-zA-Z0-9]/g, '')
  .slice(0, 32);

const apiKey = `aa_${env}_${randomPart}`;

// Generate SHA-256 hash
const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

console.log('\n=== Generated API Key ===\n');
console.log('API Key (store securely, give to user):');
console.log(`  ${apiKey}\n`);
console.log('Key Hash (store in database):');
console.log(`  ${hash}\n`);
console.log('SQL to insert:');
console.log(`
INSERT INTO api_keys (key_hash, key_prefix, user_id, environment, name)
VALUES (
  '${hash}',
  'aa_${env}_',
  '00000000-0000-0000-0000-000000000001',  -- Replace with actual user ID
  '${env}',
  'API Key'  -- Replace with friendly name
);
`);

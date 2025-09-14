#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from 'fs';

function findOAuthCredentials(): string | null {
  const isInTests = process.cwd().endsWith('/tests');
  const credentialsFolder = isInTests ? '../google-credentials' : './google-credentials';
  const rootFiles = isInTests ? ['../oauth-credentials.json'] : ['./oauth-credentials.json'];

  console.log('🔍 Testing OAuth credentials auto-detection...\n');

  if (existsSync(credentialsFolder)) {
    try {
      const files = readdirSync(credentialsFolder);
      console.log(`📁 Found files in google-credentials/:`, files);

      const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'README.md');
      console.log(`📄 JSON files found:`, jsonFiles);

      for (const file of jsonFiles) {
        const filePath = `${credentialsFolder}/${file}`;
        try {
          const content = JSON.parse(readFileSync(filePath, 'utf8'));
          if ((content.web || content.installed) && (content.web?.client_id || content.installed?.client_id)) {
            console.log(`✅ Valid OAuth credentials found: ${file}`);
            console.log(`🆔 Client ID: ${content.web?.client_id || content.installed?.client_id}`);
            console.log(`🌐 Auth URI: ${content.web?.auth_uri || content.installed?.auth_uri}`);
            return filePath;
          } else {
            console.log(`❌ Invalid OAuth format: ${file}`);
          }
        } catch (error) {
          console.log(`❌ Failed to parse JSON: ${file}`);
        }
      }
    } catch (error) {
      console.log('❌ Failed to read google-credentials folder');
    }
  } else {
    console.log('📁 google-credentials folder not found');
  }

  console.log('\n🔄 Checking root directory for fallback files...');
  for (const path of rootFiles) {
    if (existsSync(path)) {
      try {
        const content = JSON.parse(readFileSync(path, 'utf8'));
        if ((content.web || content.installed) && (content.web?.client_id || content.installed?.client_id)) {
          console.log(`✅ Found fallback OAuth credentials: ${path}`);
          return path;
        }
      } catch (error) {
        console.log(`❌ Invalid fallback file: ${path}`);
      }
    }
  }

  console.log('❌ No valid OAuth credentials found');
  return null;
}

async function main() {
  console.log('🧪 OAuth Credentials Detection Test\n');

  const credentialsPath = findOAuthCredentials();

  if (credentialsPath) {
    console.log(`\n🎉 SUCCESS: OAuth auto-detection working!`);
    console.log(`📍 Credentials path: ${credentialsPath}`);

    console.log('\n💡 To test full OAuth flow:');
    console.log('1. Run: bun run whatsapp-bot.ts');
    console.log('2. Open the authorization URL in browser');
    console.log('3. Click "Allow" and copy the code');
    console.log('4. Paste code when prompted');
  } else {
    console.log('\n❌ FAILED: No OAuth credentials detected');
    console.log('💡 Create OAuth credentials in Google Cloud Console:');
    console.log('   APIs & Services > Credentials > OAuth 2.0 Client IDs > Desktop Application');
    console.log('   Then drag the JSON file into google-credentials/');
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
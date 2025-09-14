#!/usr/bin/env bun

import { GoogleSheetsService } from '../sheets-service';

async function testSheetsService() {
  console.log('📊 Testing Google Sheets Integration...');

  try {
    // Test configuration
    const serviceAccountPath = '../service-account-key.json';
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID || 'TEST_SHEET_ID';

    if (!process.env.GOOGLE_SHEETS_ID) {
      console.log('💡 Set GOOGLE_SHEETS_ID environment variable or update this test');
      console.log('💡 Example: GOOGLE_SHEETS_ID=1ABC...XYZ bun run test-simple-sheets.ts');
      return;
    }

    console.log(`🔑 Service account: ${serviceAccountPath}`);
    console.log(`📋 Spreadsheet ID: ${spreadsheetId}`);

    // Initialize service
    const sheets = new GoogleSheetsService(serviceAccountPath, spreadsheetId);
    await sheets.initialize();
    await sheets.setupHeaders();

    // Test connection
    console.log('\n🧪 Testing connection...');
    const isConnected = await sheets.testConnection();
    if (isConnected) {
      console.log('✅ Connection successful');
    } else {
      console.log('❌ Connection failed');
      return;
    }

    // Test message writing
    console.log('\n📝 Testing message writing...');

    const testMessage = {
      timestamp: new Date().toISOString(),
      direction: '←',
      sender: 'TestUser',
      chat: 'test-chat',
      messageType: 'text',
      content: 'This is a test message from the simple sheets integration!'
    };

    await sheets.appendMessage(testMessage);
    console.log('✅ Message written successfully');

    // Test batch writing
    console.log('\n📝 Testing batch message writing...');

    const batchMessages = [
      {
        timestamp: new Date().toISOString(),
        direction: '←',
        sender: 'User1',
        chat: 'group-chat',
        messageType: 'text',
        content: 'Batch message 1'
      },
      {
        timestamp: new Date().toISOString(),
        direction: '→',
        sender: 'Bot',
        chat: 'group-chat',
        messageType: 'text',
        content: 'Batch message 2 - bot reply'
      }
    ];

    for (const message of batchMessages) {
      await sheets.appendMessage(message);
    }
    console.log('✅ Batch messages written successfully');

    console.log('\n🎉 Google Sheets integration test completed!');
    console.log(`📊 View your sheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

  } catch (error) {
    console.error('❌ Test failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('Service account key file not found')) {
        console.error('💡 Create service-account-key.json with your Google service account credentials');
      } else if (error.message.includes('permission') || error.message.includes('access')) {
        console.error('💡 Make sure the service account has edit access to the spreadsheet');
      } else if (error.message.includes('not found')) {
        console.error('💡 Check that the spreadsheet ID is correct and accessible');
      }
    }

    process.exit(1);
  }
}

testSheetsService();
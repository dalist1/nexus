# Tests

## Available Tests

### 🔍 OAuth Detection Test
```bash
bun run tests/test-oauth-detection.ts
```
Tests the automatic detection of OAuth credentials JSON files in the `google-credentials/` folder.

### 🤖 AI Service Test
```bash
bun run tests/test-ai.ts
```
Tests Google AI SDK integration, tool calling, and conversation management.

### 📊 Google Sheets Test
```bash
# After OAuth setup is complete:
bun run tests/test-sheets.ts

# Or with existing spreadsheet ID:
GOOGLE_SHEETS_ID="your-spreadsheet-id" bun run tests/test-sheets.ts
```
Tests Google Sheets integration and message logging functionality.

## Running All Tests

```bash
# Test OAuth credentials detection
bun run tests/test-oauth-detection.ts

# Test AI functionality
bun run tests/test-ai.ts

# Test sheets (requires OAuth authorization)
bun run tests/test-sheets.ts
```

## Test Results

- ✅ **OAuth Detection**: OAuth credentials files are detected automatically
- ✅ **AI Integration**: Google Gemini API working with tool calls
- ✅ **Sheets Integration**: Works with OAuth using your personal Google Drive storage
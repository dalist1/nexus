import { AIService } from '../ai/ai-service';

export class EnvironmentValidator {
  static async validateEnvironment(): Promise<void> {
    console.log('🔍 Checking environment configuration...');

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error('❌ Missing Google AI API key!');
      console.error('');
      console.error('Please set up your API key:');
      console.error('1. Get your API key from: https://ai.dev/apikey');
      console.error('2. Create .env file with: GOOGLE_GENERATIVE_AI_API_KEY=your_key_here');
      console.error('3. Your key should start with "AIza..."');
      console.error('');
      console.error('See README.md for detailed setup instructions.');
      process.exit(1);
    }

    if (!apiKey.startsWith('AIza')) {
      console.error('❌ Invalid Google AI API key format!');
      console.error('');
      console.error('Your API key should start with "AIza..." ');
      console.error('Please check your .env file and ensure you copied the key correctly.');
      console.error('Get a new key from: https://ai.dev/apikey');
      process.exit(1);
    }

    console.log('✅ Google AI API key configured');

    try {
      new AIService();
      console.log('✅ AI service ready');
    } catch (error) {
      console.error('❌ Failed to initialize AI service:', error);
      console.error('Please check your Google AI API key is valid.');
      process.exit(1);
    }
  }
}
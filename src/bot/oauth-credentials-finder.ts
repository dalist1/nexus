import { existsSync, readFileSync, readdirSync } from 'fs';
import { Logger } from '../utils/logger';

export class OAuthCredentialsFinder {
  static findCredentials(): string | null {
    const credentialsFolder = './google-credentials';
    const rootFiles = ['./oauth-credentials.json'];

    if (existsSync(credentialsFolder)) {
      try {
        const files = readdirSync(credentialsFolder);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        for (const file of jsonFiles) {
          const filePath = `${credentialsFolder}/${file}`;
          try {
            const content = JSON.parse(readFileSync(filePath, 'utf8'));
            if ((content.web || content.installed) && (content.web?.client_id || content.installed?.client_id)) {
              Logger.auth(`Found OAuth credentials: ${file}`);
              return filePath;
            }
          } catch (error) {
          }
        }
      } catch (error) {
      }
    }

    for (const path of rootFiles) {
      if (existsSync(path)) {
        try {
          const content = JSON.parse(readFileSync(path, 'utf8'));
          if ((content.web || content.installed) && (content.web?.client_id || content.installed?.client_id)) {
            return path;
          }
        } catch (error) {
        }
      }
    }

    return null;
  }
}
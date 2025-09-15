import { google } from '@ai-sdk/google';

export class ToolManager {
  static getTools(useSearch: boolean, useUrlContext: boolean, useCodeExecution: boolean): any {
    const tools: any = {};

    if (useSearch) {
      tools.google_search = google.tools.googleSearch({});
    }

    if (useUrlContext) {
      tools.url_context = google.tools.urlContext({});
    }

    if (useCodeExecution) {
      tools.code_execution = google.tools.codeExecution({});
    }

    return Object.keys(tools).length > 0 ? tools : undefined;
  }
}
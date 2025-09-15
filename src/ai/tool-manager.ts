export class ToolManager {
  static getTools(useSearch: boolean, useUrlContext: boolean, useCodeExecution: boolean): any {
    const tools: any = {};

    if (useSearch) {
      tools.search = {
        description: 'Search the web for current information',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query'
            }
          },
          required: ['query']
        }
      };
    }

    if (useUrlContext) {
      tools.getUrlContent = {
        description: 'Fetch and analyze content from a URL',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to fetch content from'
            }
          },
          required: ['url']
        }
      };
    }

    if (useCodeExecution) {
      tools.executeCode = {
        description: 'Execute Python code and return the result',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The Python code to execute'
            }
          },
          required: ['code']
        }
      };
    }

    return Object.keys(tools).length > 0 ? tools : undefined;
  }
}
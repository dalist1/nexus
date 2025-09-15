import { AIResponse, Source } from '../../types';

export class ResponseProcessor {
  static processResponse(result: any): AIResponse {
    let sources: Source[] = [];

    if (result.sources && Array.isArray(result.sources)) {
      sources = result.sources.map((source: any) => ({
        sourceType: source.sourceType || 'url' as const,
        id: source.id,
        url: source.url,
        title: source.title,
        filename: source.filename,
        mediaType: source.mediaType,
        providerMetadata: source.providerMetadata
      }));
    }

    let reasoning: string = '';
    if (result.reasoning && Array.isArray(result.reasoning)) {
      reasoning = result.reasoning.map((r: any) =>
        typeof r === 'string' ? r : (r.text || String(r))
      ).join(' ');
    } else if (result.reasoningText) {
      reasoning = result.reasoningText;
    }

    const toolCalls = result.toolCalls || [];

    return {
      content: result.text || '',
      sources,
      reasoning,
      toolCalls: toolCalls.map((tc: any) => ({
        id: tc.toolCallId || tc.id,
        type: tc.toolName || tc.type,
        parameters: tc.args || tc.input || tc.parameters || {}
      }))
    };
  }
}
import { AIResponse, Source } from '../../types';

export class ResponseProcessor {
  static processResponse(result: any): AIResponse {
    let sources: Source[] = [];

    if (result.sources) {
      sources = result.sources.map((source: any) => ({
        sourceType: (source as any).sourceType || 'url' as const,
        id: source.id,
        url: (source as any).url,
        title: source.title,
        filename: (source as any).filename,
        mediaType: (source as any).mediaType,
        providerMetadata: source.providerMetadata
      }));
    }

    let reasoning: string = '';
    if (result.reasoning) {
      if (Array.isArray(result.reasoning)) {
        reasoning = result.reasoning.map((r: any) =>
          typeof r === 'string' ? r : r.text || String(r)
        ).join(' ');
      } else {
        reasoning = typeof result.reasoning === 'string' ? result.reasoning : result.reasoning.text || String(result.reasoning);
      }
    }

    const toolCalls = result.toolCalls || [];

    return {
      content: result.text,
      sources,
      reasoning,
      toolCalls: toolCalls.map((tc: any) => ({
        id: tc.toolCallId,
        type: tc.toolName,
        parameters: (tc as any).args || tc.parameters || {}
      }))
    };
  }
}
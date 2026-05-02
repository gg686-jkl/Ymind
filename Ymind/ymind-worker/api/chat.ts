import { PROVIDERS, PROVIDER_API_KEYS } from './_lib/providers';
import { ChatRequest } from './_lib/types';
import { checkRateLimit, recordFailure, cleanRateLimitStore } from './_lib/rate-limit';

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

function formatMessages(prompt: string, provider: string): any[] {
  const userMessage = { role: 'user', content: prompt };

  switch (provider) {
    case 'anthropic':
      return [userMessage];
    case 'openrouter':
    case 'cohere':
      return [
        { role: 'system', content: 'You are a helpful assistant.' },
        userMessage,
      ];
    default:
      return [userMessage];
  }
}

function buildRequestBody(provider: string, model: string, prompt: string, temperature?: number, maxTokens?: number): any {
  const messages = formatMessages(prompt, provider);
  const commonParams = {
    model,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 4096,
    stream: true,
  };

  switch (provider) {
    case 'anthropic':
      return {
        model,
        messages,
        max_tokens: maxTokens ?? 4096,
        stream: true,
        ...(temperature !== undefined && { temperature }),
      };

    case 'google':
      return {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: temperature ?? 0.7,
          maxOutputTokens: maxTokens ?? 4096,
        },
      };

    case 'cohere':
      return {
        model,
        messages,
        ...(temperature !== undefined && { temperature }),
        max_tokens: maxTokens ?? 4096,
      };

    case 'wenxin':
      return {
        messages,
        stream: true,
        ...(temperature !== undefined && { temperature }),
      };

    default:
      return commonParams;
  }
}

function transformChunk(provider: string, data: any): string {
  switch (provider) {
    case 'anthropic':
      if (data.type === 'content_block_delta') {
        return data.delta?.text || '';
      }
      if (data.type === 'message_delta') {
        return '';
      }
      return '';

    case 'google':
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      return '';

    case 'cohere':
      if (data.delta?.text) {
        return data.delta.text;
      }
      return '';

    case 'wenxin':
      if (data.choices?.[0]?.delta?.content) {
        return data.choices[0].delta.content;
      }
      return '';

    case 'huggingface':
      if (data.token?.text) {
        return data.token.text;
      }
      return '';

    default:
      if (data.choices?.[0]?.delta?.content) {
        return data.choices[0].delta.content;
      }
      return '';
  }
}

export const config = {
  runtime: 'edge',
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function applyCors(base: ResponseInit = {}): ResponseInit {
  const headers = new Headers(base.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => {
    if (!headers.has(k)) headers.set(k, v);
  });
  return { ...base, headers };
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/health') {
    const availableProviders = Object.keys(PROVIDER_API_KEYS).filter(p => process.env[PROVIDER_API_KEYS[p]]);
    return new Response(
      JSON.stringify({ status: 'ok', providers: availableProviders }),
      applyCors({ headers: { 'Content-Type': 'application/json' } })
    );
  }

  return new Response(
    JSON.stringify({
      error: 'Method not allowed',
      hint: 'Use POST /api/chat with { provider, model, prompt }'
    }),
    applyCors({ status: 405, headers: { 'Content-Type': 'application/json' } })
  );
}

export async function POST(request: Request): Promise<Response> {
  const clientIP = getClientIP(request);
  const url = new URL(request.url);

  const providedToken = url.searchParams.get('key');
  if (providedToken !== process.env.WORKER_ACCESS_TOKEN) {
    recordFailure(clientIP);
    return new Response('Not Found', applyCors({ status: 404 }));
  }

  if (!checkRateLimit(clientIP)) {
    return new Response('Too Many Requests', applyCors({ status: 429 }));
  }
  cleanRateLimitStore();

  try {
    const bodyText = await request.text();
    let body: ChatRequest;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'Invalid JSON',
        received: bodyText.substring(0, 100)
      }), applyCors({ status: 400, headers: { 'Content-Type': 'application/json' } }));
    }
    const { provider, model, prompt, temperature, max_tokens, stream = true } = body;

    if (!provider || !model || !prompt) {
      return new Response(JSON.stringify(
        { error: 'Missing required fields: provider, model, prompt' }
      ), applyCors({ status: 400, headers: { 'Content-Type': 'application/json' } }));
    }

    const apiKeyEnv = PROVIDER_API_KEYS[provider];
    if (!apiKeyEnv) {
      return new Response(JSON.stringify(
        { error: `Unknown provider: ${provider}` }
      ), applyCors({ status: 400, headers: { 'Content-Type': 'application/json' } }));
    }

    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      return new Response(JSON.stringify(
        { error: `API key not configured for provider: ${provider}` }
      ), applyCors({ status: 400, headers: { 'Content-Type': 'application/json' } }));
    }

    const providerConfig = PROVIDERS[provider];
    let baseURL = providerConfig.baseURL;
    let endpoint = '/chat/completions';
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (provider) {
      case 'anthropic':
        endpoint = '/messages';
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        };
        break;

      case 'google':
        endpoint = `/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
        baseURL = 'https://generativelanguage.googleapis.com/v1beta';
        delete headers['Content-Type'];
        break;

      case 'groq':
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['Accept'] = 'text/event-stream';
        break;

      case 'openrouter':
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['HTTP-Referer'] = 'https://ymind.top';
        headers['X-Title'] = 'Ymind Brainstorm';
        break;

      case 'cohere':
        endpoint = '/chat';
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        };
        break;

      case 'wenxin':
        headers['Authorization'] = `Bearer ${apiKey}`;
        endpoint = '/chat/completions';
        break;

      case 'azure': {
        const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
        const deploymentName = model;
        baseURL = `${azureEndpoint}openai/deployments/${deploymentName}`;
        endpoint = '/chat/completions?api-version=2024-02-15-preview';
        headers = {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        };
        break;
      }

      default:
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['Accept'] = 'text/event-stream';
    }

    const requestBody = buildRequestBody(provider, model, prompt, temperature, max_tokens);

    const upstreamResponse = await fetch(`${baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      return new Response(JSON.stringify({
        error: `Upstream API error: ${upstreamResponse.status}`,
        details: errorText
      }), applyCors({ status: upstreamResponse.status, headers: { 'Content-Type': 'application/json' } }));
    }

    if (!stream) {
      const data = await upstreamResponse.json();
      return new Response(JSON.stringify(data), applyCors({ headers: { 'Content-Type': 'application/json' } }));
    }

    const reader = upstreamResponse.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: 'No response body' }), applyCors({ status: 500, headers: { 'Content-Type': 'application/json' } }));
    }

    const stream2 = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        let buffer = '';
        const isAnthropic = provider === 'anthropic';
        const isGoogle = provider === 'google';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === 'data: [DONE]' || trimmedLine === '[DONE]') {
                continue;
              }

              let dataStr = trimmedLine;
              if (dataStr.startsWith('data: ')) {
                dataStr = dataStr.slice(6);
              }

              try {
                const data = JSON.parse(dataStr);
                let text = '';

                if (isGoogle) {
                  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    text = data.candidates[0].content.parts[0].text;
                  }
                } else if (isAnthropic) {
                  if (data.type === 'content_block_delta') {
                    text = data.delta?.text || '';
                  }
                } else {
                  text = transformChunk(provider, data);
                }

                if (text) {
                  const sseData = `data: ${JSON.stringify({ text })}\n\n`;
                  controller.enqueue(new TextEncoder().encode(sseData));
                }

                if (provider === 'anthropic' && data.type === 'message_delta') {
                  controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                  controller.close();
                  break;
                }

                if (data.choices?.[0]?.finish_reason) {
                  controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                  controller.close();
                  break;
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        } catch {
          controller.close();
        }
      },
    });

    return new Response(stream2, applyCors({
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }));

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), applyCors({ status: 500, headers: { 'Content-Type': 'application/json' } }));
  }
}

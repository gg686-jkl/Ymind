import { PROVIDER_API_KEYS } from './_lib/providers';

export const config = {
  runtime: 'edge',
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  const providedToken = url.searchParams.get('key');

  if (providedToken !== process.env.WORKER_ACCESS_TOKEN) {
    return new Response('Not Found', applyCors({ status: 404 }));
  }

  const availableProviders = Object.keys(PROVIDER_API_KEYS).filter(
    p => process.env[PROVIDER_API_KEYS[p]]
  );

  return new Response(
    JSON.stringify({ status: 'ok', providers: availableProviders }),
    applyCors({ headers: { 'Content-Type': 'application/json' } })
  );
}

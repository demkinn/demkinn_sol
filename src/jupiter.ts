import { config } from './config.js';
import type { MemeToken } from './types.js';

const BASE = 'https://api.jup.ag';
const paths = [
  '/tokens/v2/recent?limit=50',
  '/tokens/v2/toptrending/5m?limit=50',
  '/tokens/v2/toptraded/5m?limit=50',
  '/tokens/v2/toporganicscore/5m?limit=50',
];

let lastApiCall = 0;

async function jup<T>(path: string): Promise<T> {
  if (!config.jupiterApiKey) throw new Error('JUPITER_API_KEY is required for scanner data');
  const wait = Math.max(0, config.apiMinIntervalMs - (Date.now() - lastApiCall));
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const res = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json', 'x-api-key': config.jupiterApiKey } });
  lastApiCall = Date.now();
  const body = await res.text();
  if (!res.ok) throw new Error(`Jupiter ${res.status}: ${body.slice(0, 400)}`);
  return JSON.parse(body) as T;
}

export async function getCandidates(): Promise<MemeToken[]> {
  const unique = new Map<string, MemeToken>();
  for (const path of paths) {
    const list = await jup<MemeToken[]>(path);
    for (const token of list) {
      if (!token.id || !Number.isFinite(token.decimals)) continue;
      unique.set(token.id, token);
    }
  }
  return [...unique.values()];
}

import { Keypair, VersionedTransaction } from '@solana/web3.js';
import { config } from './config.js';
import { log } from './logger.js';
import type { MemeToken } from './types.js';

const BASE = 'https://api.jup.ag';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

async function jup<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-api-key', config.jupiterApiKey);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Jupiter ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as T;
}

export async function getCandidates(): Promise<MemeToken[]> {
  const paths = [
    '/tokens/v2/recent',
    '/tokens/v2/toptrending/5m?limit=50',
    '/tokens/v2/toptraded/5m?limit=50',
    '/tokens/v2/toporganicscore/5m?limit=50',
  ];
  const results = await Promise.all(paths.map((p) => jup<MemeToken[]>(`${BASE}${p}`)));
  const unique = new Map<string, MemeToken>();
  for (const list of results) for (const token of list) unique.set(token.id, token);
  return [...unique.values()];
}

export interface OrderResponse {
  transaction: string | null;
  requestId: string;
  outAmount: string;
  router?: string;
  mode?: string;
  priceImpact?: string;
  swapUsdValue?: string;
  otherAmountThreshold?: string;
  [key: string]: unknown;
}

export interface ExecuteResponse {
  status: 'Success' | 'Failed';
  signature?: string;
  error?: string;
  code?: number;
  inputAmountResult?: string;
  outputAmountResult?: string;
}

export async function getOrder(inputMint: string, outputMint: string, amountSmallest: string, taker: string): Promise<OrderResponse> {
  const params = new URLSearchParams({ inputMint, outputMint, amount: amountSmallest, taker });
  return jup<OrderResponse>(`${BASE}/swap/v2/order?${params.toString()}`);
}

export async function executeOrder(order: OrderResponse, wallet: Keypair): Promise<ExecuteResponse> {
  if (!order.transaction) throw new Error('Jupiter returned no transaction');
  const tx = VersionedTransaction.deserialize(Buffer.from(order.transaction, 'base64'));
  tx.sign([wallet]);
  const signed = Buffer.from(tx.serialize()).toString('base64');
  const result = await jup<ExecuteResponse>(`${BASE}/swap/v2/execute`, {
    method: 'POST',
    body: JSON.stringify({ signedTransaction: signed, requestId: order.requestId }),
  });
  if (result.status === 'Success') log('Jupiter execution succeeded', result);
  return result;
}

export { SOL_MINT };

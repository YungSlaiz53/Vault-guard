export interface NearRpcCallParams {
  rpcUrl?: string;
  contractId: string;
  methodName: string;
  args?: Record<string, unknown>;
}

/**
 * Queries a live NEAR RPC endpoint (e.g. https://rpc.testnet.near.org) for contract view methods.
 */
export async function callNearRpcView<T>(params: NearRpcCallParams): Promise<{
  success: boolean;
  data?: T;
  error?: string;
}> {
  const rpcUrl = params.rpcUrl || process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org';
  const argsBase64 = Buffer.from(JSON.stringify(params.args ?? {}), 'utf8').toString('base64');

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'vaultguard-view',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: params.contractId,
          method_name: params.methodName,
          args_base64: argsBase64,
        },
      }),
    });
    if (!res.ok) {
      return { success: false, error: `NEAR RPC returned HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      result?: { result?: number[] };
      error?: { message?: string };
    };
    if (json.error || !json.result?.result) {
      return { success: false, error: json.error?.message || 'Empty NEAR RPC result' };
    }
    const decoded = Buffer.from(json.result.result).toString('utf8');
    return { success: true, data: JSON.parse(decoded) as T };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'NEAR RPC network error',
    };
  }
}

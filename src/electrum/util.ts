export function makeRequest(method: string, params?: unknown[], id?: string) {
  return JSON.stringify({
    jsonrpc: '2.0',
    method: method,
    params: params,
    id: id,
  });
}

export function createPromiseResult<T>(
  resolve: (value: T) => T,
  reject: (reason?: unknown) => void,
) {
  return (err: unknown | null, result: T) => {
    if (err) reject(err);
    else resolve(result);
  };
}

export type PromiseResult = ReturnType<typeof createPromiseResult>;

export function makeRequest(method: string, params?: unknown[], id?: string) {
  return JSON.stringify({
    jsonrpc: '2.0',
    method: method,
    params: params,
    id: id,
  });
}

export type PromiseResult<T> = (err: unknown | null, result: T) => void;

export function createPromiseResult<T>(
  resolve: (value: T) => void,
  reject: (reason?: unknown) => void,
): PromiseResult<T> {
  return (err: unknown | null, result: T) => {
    if (err) reject(err);
    else resolve(result);
  };
}

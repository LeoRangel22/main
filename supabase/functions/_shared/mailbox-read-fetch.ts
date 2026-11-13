// Bounded retry for idempotent mailbox reads only. OAuth, SQL and commits are not retried.
export function createMailboxReadFetcher(
 fetcher: typeof fetch = fetch,
 pause: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
): typeof fetch {
 return (async (input: RequestInfo | URL, options?: RequestInit) => {
  const method = (options?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  for (let attempt = 0; attempt < 2; attempt++) {
   try {
    const response = await fetcher(input, options);
    if (method !== 'GET' || attempt === 1 || ![502,503,504].includes(response.status) || options?.signal?.aborted) return response;
    try { await response.body?.cancel(); } catch { /* No response content enters diagnostics. */ }
   } catch (error) {
    const timeout = options?.signal?.aborted || error instanceof Error && ['AbortError','TimeoutError'].includes(error.name);
    if (timeout) throw new Error('provider_timeout');
    if (!(error instanceof TypeError)) throw error;
    if (method !== 'GET' || attempt === 1) throw new Error('provider_transport_failed');
   }
   await pause(250);
  }
  throw new Error('provider_transport_failed');
 }) as typeof fetch;
}


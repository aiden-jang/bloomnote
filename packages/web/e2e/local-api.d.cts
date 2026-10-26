export function startLocalApi(
  frontend: string,
  respond: (path: string, method: string) => unknown,
): Promise<{ origin: string; close: () => Promise<void> }>

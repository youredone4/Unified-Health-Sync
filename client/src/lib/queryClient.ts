import { MutationCache, QueryCache, QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Invalidates all queries whose first queryKey element starts with the given basePath.
 * This handles both plain paths ('/api/mothers') and scoped paths ('/api/mothers?barangay=X').
 */
export function invalidateScopedQueries(basePath: string): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && key.startsWith(basePath);
    },
  });
}

/**
 * A 401 from any API call means the session has ended (idle timeout, the
 * daily sign-in limit, or an administrator signed this account out).
 * Clearing the cached user sends the app back to the sign-in page instead
 * of leaving a screen full of failed requests.
 */
function handleSessionEnded(error: unknown) {
  if (error instanceof Error && /^401: /.test(error.message)) {
    queryClient.setQueryData(["/api/auth/me"], null);
  }
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleSessionEnded }),
  mutationCache: new MutationCache({ onError: handleSessionEnded }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

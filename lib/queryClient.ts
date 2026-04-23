import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Prefer the server's structured `{ error: "..." }` message over
    // the raw body. Every first-party API route returns a JSON error
    // envelope, and throwing `400: {"error":"Invalid email"}` at the
    // UI leaves callers either showing the raw JSON or falling back
    // to generic "Something went wrong". Pull the `error` field out
    // when present so .catch handlers can display the actionable
    // signal directly.
    const raw = (await res.text()) || res.statusText;
    let message = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.error === "string") {
        message = parsed.error;
      }
    } catch {
      /* non-JSON body — keep raw text */
    }
    throw new Error(`${res.status}: ${message}`);
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

export const queryClient = new QueryClient({
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

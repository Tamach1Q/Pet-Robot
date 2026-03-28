const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
).replace(/\/$/, "");

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const errorPayload = (await response.json()) as { message?: string };

      if (errorPayload.message) {
        message = errorPayload.message;
      }
    } catch {
      // Ignore non-JSON error bodies and keep the fallback message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

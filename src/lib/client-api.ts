/** Client-side API helper */
export async function api<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "Terjadi kesalahan" };
    }
    return json;
  } catch {
    return { success: false, error: "Koneksi gagal" };
  }
}

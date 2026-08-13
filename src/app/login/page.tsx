"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (res.status === 200) {
        router.push("/tool");
        return;
      }

      if (res.status === 401) {
        setError("Email atau password salah.");
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Terjadi kesalahan, silakan coba lagi.");
      }
    } catch {
      setError("Gagal terhubung ke server, silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: "var(--bg-base)" }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-8"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <h1
          className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Masuk ke bapak2shift
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 font-[family-name:var(--font-worksans)]"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@email.com"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={
                {
                  background: "var(--bg-base)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                  "--tw-ring-color": "var(--accent)",
                } as React.CSSProperties
              }
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password kamu"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={
                {
                  background: "var(--bg-base)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                  "--tw-ring-color": "var(--accent)",
                } as React.CSSProperties
              }
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{
              background: "var(--accent)",
              color: "var(--bg-base)",
            }}
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <p
          className="mt-6 text-center text-sm font-[family-name:var(--font-worksans)]"
          style={{ color: "var(--text-muted)" }}
        >
          Baru beli dan belum setup akun?{" "}
          <Link
            href="/setup-password"
            className="underline"
            style={{ color: "var(--accent)" }}
          >
            Aktifkan di sini.
          </Link>
        </p>
      </div>
    </div>
  );
}

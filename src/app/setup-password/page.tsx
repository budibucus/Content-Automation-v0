"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function SetupPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginCta, setShowLoginCta] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setShowLoginCta(false);

    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.status === 200) {
        setSuccess(true);
        return;
      }

      if (res.status === 404) {
        setError("Email tidak terdaftar sebagai pembeli.");
      } else if (res.status === 400) {
        setError("Akun sudah pernah di-setup, silakan login.");
        setShowLoginCta(true);
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
          Selamat datang di shift kedua kamu.
        </h1>
        <p
          className="mt-2 font-[family-name:var(--font-worksans)] text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Ini langkah terakhir sebelum kamu bisa akses tool. Buat password
          untuk akunmu.
        </p>

        {success ? (
          <div className="mt-8 space-y-4">
            <p
              className="font-[family-name:var(--font-worksans)] text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              Akun kamu berhasil diaktifkan. Sekarang kamu bisa login dan
              mulai pakai tool-nya.
            </p>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 font-[family-name:var(--font-worksans)] text-sm font-semibold"
              style={{
                background: "var(--accent)",
                color: "var(--bg-base)",
              }}
            >
              Ke halaman login
            </Link>
          </div>
        ) : (
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
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
                htmlFor="confirmPassword"
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Konfirmasi Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password"
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

            {error && (
              <div className="space-y-2">
                <p className="text-sm text-red-400">{error}</p>
                {showLoginCta && (
                  <Link
                    href="/login"
                    className="inline-block text-sm underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Ke halaman login
                  </Link>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              style={{
                background: "var(--accent)",
                color: "var(--bg-base)",
              }}
            >
              {loading ? "Memproses..." : "Aktifkan akun"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

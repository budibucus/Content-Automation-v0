"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface ToolFormProps {
  email: string;
}

const inputStyle = {
  background: "var(--bg-base)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
  "--tw-ring-color": "var(--accent)",
} as React.CSSProperties;

export function ToolForm({ email }: ToolFormProps) {
  const router = useRouter();
  const [jobRole, setJobRole] = useState("");
  const [skills, setSkills] = useState("");
  const [dailyChallenge, setDailyChallenge] = useState("");
  const [availableTime, setAvailableTime] = useState("");
  const [familyContext, setFamilyContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/generate-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jobRole,
          skills,
          dailyChallenge,
          availableTime,
          familyContext: familyContext || undefined,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setResult(data?.result ?? "");
      } else {
        setError(data?.error ?? "Terjadi kesalahan, silakan coba lagi.");
      }
    } catch {
      setError("Gagal terhubung ke server, silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <header
        className="flex items-center justify-between border-b px-4 py-4 sm:px-8"
        style={{ borderColor: "var(--border)" }}
      >
        <p
          className="font-[family-name:var(--font-worksans)] text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Masuk sebagai:{" "}
          <span style={{ color: "var(--text-primary)" }}>{email}</span>
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="font-[family-name:var(--font-worksans)] text-sm underline"
          style={{ color: "var(--text-muted)" }}
        >
          Keluar
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
        <h1
          className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold sm:text-4xl"
          style={{ color: "var(--text-primary)" }}
        >
          Peta Skill ke Ide Bisnis kamu
        </h1>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border p-6 font-[family-name:var(--font-worksans)]"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
            }}
          >
            <div className="space-y-1.5">
              <label
                htmlFor="jobRole"
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Peran kerja
              </label>
              <input
                id="jobRole"
                type="text"
                required
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="Contoh: Supervisor QC di pabrik makanan"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="skills"
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Skill dan pengalaman
              </label>
              <textarea
                id="skills"
                required
                rows={3}
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Skill apa aja yang kamu pakai sehari-hari di kerjaan?"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="dailyChallenge"
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Keresahan soal usaha sampingan
              </label>
              <textarea
                id="dailyChallenge"
                required
                rows={3}
                value={dailyChallenge}
                onChange={(e) => setDailyChallenge(e.target.value)}
                placeholder="Apa yang bikin kamu ragu atau bingung buat mulai?"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="availableTime"
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Waktu yang tersedia
              </label>
              <input
                id="availableTime"
                type="text"
                required
                value={availableTime}
                onChange={(e) => setAvailableTime(e.target.value)}
                placeholder="Contoh: Malam 1-2 jam setelah anak tidur"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="familyContext"
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Konteks keluarga{" "}
                <span style={{ color: "var(--text-muted)" }}>(Opsional)</span>
              </label>
              <input
                id="familyContext"
                type="text"
                value={familyContext}
                onChange={(e) => setFamilyContext(e.target.value)}
                placeholder="Contoh: Anak pertama usia 2 tahun"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              style={{
                background: "var(--accent)",
                color: "var(--bg-base)",
              }}
            >
              {loading ? "Memproses..." : "Buat laporan saya"}
            </button>
          </form>

          <div
            className="rounded-xl border p-6 font-[family-name:var(--font-worksans)]"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
            }}
          >
            {loading && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Lagi meracik ide buat kamu...
              </p>
            )}

            {!loading && error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {!loading && !error && !result && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Isi form di sebelah kiri, hasilnya bakal muncul di sini.
              </p>
            )}

            {!loading && !error && result && (
              <div
                className="space-y-3 text-sm leading-relaxed [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:mt-6 [&_h1]:font-[family-name:var(--font-fraunces)] [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:font-[family-name:var(--font-fraunces)] [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_hr]:my-4 [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                style={{ color: "var(--text-primary)" }}
              >
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

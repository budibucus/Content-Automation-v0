"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ContentStatus = "pending_review" | "approved";
type LoadingAction = "approve" | "revision" | null;

interface ReviewActionsProps {
  id: string;
  currentStatus: ContentStatus;
}

async function callApi(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Terjadi kesalahan, silakan coba lagi.");
  }
}

export function ReviewActions({ id, currentStatus }: ReviewActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleApprove() {
    setError(null);
    setLoading("approve");

    try {
      await callApi("/api/admin/approve-content", { id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyetujui konten.");
    } finally {
      setLoading(null);
    }
  }

  async function handleRequestRevision() {
    if (!notes.trim()) {
      setError("Catatan revisi wajib diisi.");
      return;
    }

    setError(null);
    setLoading("revision");

    try {
      await callApi("/api/admin/request-revision", { id, notes });
      setShowRevisionForm(false);
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim revisi.");
    } finally {
      setLoading(null);
    }
  }

  if (currentStatus === "approved") {
    return (
      <span
        className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
        style={{ background: "rgba(74, 222, 128, 0.14)", color: "#4ade80" }}
      >
        Terjadwal - akan tayang otomatis
      </span>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={loading !== null}
          className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--bg-base)" }}
        >
          {loading === "approve" ? "Memproses..." : "Approve"}
        </button>

        <button
          type="button"
          onClick={() => setShowRevisionForm((prev) => !prev)}
          disabled={loading !== null}
          className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Minta Revisi
        </button>
      </div>

      {showRevisionForm && (
        <div className="mt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan revisi untuk konten ini..."
            rows={3}
            className="w-full rounded-lg border p-2 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-base)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="button"
            onClick={handleRequestRevision}
            disabled={loading !== null}
            className="mt-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--bg-base)" }}
          >
            {loading === "revision" ? "Mengirim revisi..." : "Kirim Revisi"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

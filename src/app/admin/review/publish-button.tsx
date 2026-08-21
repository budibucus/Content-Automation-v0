"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PublishButtonProps {
  id: string;
}

export function PublishButton({ id }: PublishButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/publish-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Gagal publish, silakan coba lagi.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Gagal terhubung ke server, silakan coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePublish}
        disabled={loading}
        className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
        style={{ background: "var(--accent)", color: "var(--bg-base)" }}
      >
        {loading ? "Memproses..." : "Approve & Publish"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

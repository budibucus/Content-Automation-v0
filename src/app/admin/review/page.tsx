import { supabaseAdmin } from "@/lib/supabase";
import { PublishButton } from "./publish-button";

export default async function AdminReviewPage() {
  const { data: pieces, error } = await supabaseAdmin
    .from("content_pieces")
    .select("id, funnel_stage, thread_posts, created_at")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen p-8" style={{ background: "var(--bg-base)" }}>
        <p className="text-sm text-red-400">Gagal memuat data: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-8" style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto max-w-3xl">
        <h1
          className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold sm:text-4xl"
          style={{ color: "var(--text-primary)" }}
        >
          Review Konten
        </h1>
        <p
          className="mt-1 font-[family-name:var(--font-worksans)] text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {pieces.length} thread menunggu review.
        </p>

        <div className="mt-8 space-y-6">
          {pieces.length === 0 && (
            <p
              className="font-[family-name:var(--font-worksans)] text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Tidak ada konten yang perlu direview saat ini.
            </p>
          )}

          {pieces.map((piece) => {
            const posts = (piece.thread_posts ?? []) as string[];

            return (
              <div
                key={piece.id}
                className="rounded-xl border p-6 font-[family-name:var(--font-worksans)]"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                }}
              >
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  {piece.funnel_stage}
                </span>

                <ol className="mt-4 space-y-3">
                  {posts.map((post, index) => (
                    <li
                      key={index}
                      className="rounded-lg border p-3 text-sm whitespace-pre-wrap"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <span
                        className="mr-2 font-semibold"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {index + 1}.
                      </span>
                      {post}
                    </li>
                  ))}
                </ol>

                <div className="mt-4">
                  <PublishButton id={piece.id} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

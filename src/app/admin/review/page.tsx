import { supabaseAdmin } from "@/lib/supabase";
import { ReviewActions } from "./review-actions";

export const dynamic = 'force-dynamic';

const JAKARTA_TZ = "Asia/Jakarta";
const ACTIVE_STAGES = ["tofu", "mofu"] as const;
type ActiveStage = (typeof ACTIVE_STAGES)[number];
type ContentStatus = "pending_review" | "approved";

interface ContentPiece {
  id: string;
  funnel_stage: ActiveStage;
  thread_posts: string[];
  scheduled_for: string;
  status: ContentStatus;
}

interface DayGroup {
  dateKey: string;
  heading: string;
  pieces: Partial<Record<ActiveStage, ContentPiece>>;
}

const STATUS_LABEL: Record<ContentStatus, string> = {
  pending_review: "Menunggu Review",
  approved: "Disetujui",
};

const STATUS_STYLE: Record<ContentStatus, { background: string; color: string }> = {
  pending_review: {
    background: "rgba(155, 154, 148, 0.15)",
    color: "var(--text-muted)",
  },
  approved: {
    background: "rgba(74, 222, 128, 0.14)",
    color: "#4ade80",
  },
};

function dateKeyFor(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function formatDateHeading(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return `${time} WIB`;
}

export default async function AdminReviewPage() {
  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const { data: pieces, error } = await supabaseAdmin
    .from("content_pieces")
    .select("id, funnel_stage, thread_posts, scheduled_for, status")
    .in("status", ["pending_review", "approved"])
    .gte("scheduled_for", now.toISOString())
    .lte("scheduled_for", in14Days.toISOString())
    .order("scheduled_for", { ascending: true });

  if (error) {
    return (
      <div className="min-h-screen p-8" style={{ background: "var(--bg-base)" }}>
        <p className="text-sm text-red-400">Gagal memuat data: {error.message}</p>
      </div>
    );
  }

  const typedPieces = (pieces ?? []) as ContentPiece[];

  const days: DayGroup[] = [];
  const dayIndex = new Map<string, DayGroup>();

  for (const piece of typedPieces) {
    if (!piece.scheduled_for) continue;
    if (piece.funnel_stage !== "tofu" && piece.funnel_stage !== "mofu") continue;

    const dateKey = dateKeyFor(piece.scheduled_for);
    let group = dayIndex.get(dateKey);

    if (!group) {
      group = {
        dateKey,
        heading: formatDateHeading(piece.scheduled_for),
        pieces: {},
      };
      dayIndex.set(dateKey, group);
      days.push(group);
    }

    group.pieces[piece.funnel_stage] = piece;
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
          {typedPieces.length} konten terjadwal dalam 14 hari ke depan.
        </p>

        <div className="mt-8 space-y-10">
          {days.length === 0 && (
            <p
              className="font-[family-name:var(--font-worksans)] text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Tidak ada konten yang perlu direview dalam 14 hari ke depan.
            </p>
          )}

          {days.map((day) => (
            <section key={day.dateKey}>
              <h2
                className="font-[family-name:var(--font-fraunces)] text-xl font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {day.heading}
              </h2>

              <div className="mt-4 space-y-4">
                {ACTIVE_STAGES.map((stage) => {
                  const piece = day.pieces[stage];
                  if (!piece) return null;

                  const posts = (piece.thread_posts ?? []) as string[];
                  const statusStyle = STATUS_STYLE[piece.status];

                  return (
                    <div
                      key={piece.id}
                      className="rounded-xl border p-6 font-[family-name:var(--font-worksans)]"
                      style={{
                        background: "var(--bg-surface)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                          style={{
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                          }}
                        >
                          {piece.funnel_stage}
                        </span>

                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {formatTime(piece.scheduled_for)}
                        </span>

                        <span
                          className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
                          style={statusStyle}
                        >
                          {STATUS_LABEL[piece.status] ?? piece.status}
                        </span>
                      </div>

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
                        <ReviewActions id={piece.id} currentStatus={piece.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

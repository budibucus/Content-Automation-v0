async function createContainer(
  text: string,
  replyToId?: string
): Promise<string> {
  const params = new URLSearchParams({
    media_type: "TEXT",
    text,
    access_token: process.env.THREADS_ACCESS_TOKEN!,
  });

  if (replyToId) {
    params.set("reply_to_id", replyToId);
  }

  const res = await fetch(
    `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads`,
    { method: "POST", body: params }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Gagal membuat container: ${JSON.stringify(data)}`);
  }

  return data.id;
}

async function publishContainer(creationId: string): Promise<string> {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: process.env.THREADS_ACCESS_TOKEN!,
  });

  const res = await fetch(
    `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}/threads_publish`,
    { method: "POST", body: params }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Gagal publish: ${JSON.stringify(data)}`);
  }

  return data.id;
}

export async function publishThread(posts: string[]): Promise<string[]> {
  const publishedIds: string[] = [];
  let lastPostId: string | undefined;

  for (let i = 0; i < posts.length; i++) {
    try {
      const creationId = await createContainer(posts[i], lastPostId);
      const postId = await publishContainer(creationId);
      publishedIds.push(postId);
      lastPostId = postId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Gagal publish post ke-${i + 1} dari ${posts.length}: ${message}`
      );
    }
  }

  return publishedIds;
}

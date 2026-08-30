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

async function waitForContainerReady(creationId: string): Promise<true> {
  const maxAttempts = 10;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const params = new URLSearchParams({
      fields: "status",
      access_token: process.env.THREADS_ACCESS_TOKEN!,
    });

    const res = await fetch(
      `https://graph.threads.net/v1.0/${creationId}?${params.toString()}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Gagal cek status container: ${JSON.stringify(data)}`);
    }

    if (data.status === "FINISHED") {
      return true;
    }

    if (data.status === "ERROR" || data.status === "EXPIRED") {
      throw new Error(`Container gagal diproses: status ${data.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Timeout menunggu container siap setelah ${maxAttempts} percobaan`
  );
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

async function retryOnMediaNotFound<T>(
  fn: () => Promise<T>,
  delayMs: number,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isMediaNotFound =
        message.includes("Media Not Found") || message.includes("does not exist");

      if (!isMediaNotFound || attempt === maxRetries) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Tidak pernah tercapai: loop di atas selalu return atau throw.
  throw new Error("Retry gagal tanpa error yang jelas");
}

export async function publishThread(posts: string[]): Promise<string[]> {
  const publishedIds: string[] = [];
  let lastPostId: string | undefined;

  for (let i = 0; i < posts.length; i++) {
    try {
      const creationId = await retryOnMediaNotFound(
        () => createContainer(posts[i], lastPostId),
        2000
      );
      console.log(
        `[threads] Container dibuat untuk post ${i + 1}/${posts.length}: creationId=${creationId}`
      );

      await waitForContainerReady(creationId);
      console.log(
        `[threads] Container siap (status FINISHED) untuk post ${i + 1}/${posts.length}`
      );

      const postId = await retryOnMediaNotFound(
        () => publishContainer(creationId),
        3000
      );
      console.log(
        `[threads] Post ${i + 1}/${posts.length} berhasil dipublish: postId=${postId}`
      );

      publishedIds.push(postId);
      lastPostId = postId;

      if (i < posts.length - 1) {
        // Beri jeda supaya post yang baru dipublish "terdaftar" di sisi
        // Threads sebelum dipakai sebagai reply_to_id untuk post berikutnya.
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Gagal publish post ke-${i + 1} dari ${posts.length}: ${message}`
      );
    }
  }

  return publishedIds;
}

// One-off script — NOT part of the main app.
// Exchanges a short-lived Threads access token for a long-lived one.
//
// Usage:
//   node scripts/exchange-threads-token.mjs <SHORT_LIVED_TOKEN> <APP_SECRET>
//
// Or via env vars:
//   THREADS_SHORT_LIVED_TOKEN=... THREADS_APP_SECRET=... node scripts/exchange-threads-token.mjs

const shortLivedToken = process.argv[2] ?? process.env.THREADS_SHORT_LIVED_TOKEN;
const appSecret = process.argv[3] ?? process.env.THREADS_APP_SECRET;

if (!shortLivedToken || !appSecret) {
  console.error(
    "Usage: node scripts/exchange-threads-token.mjs <SHORT_LIVED_TOKEN> <APP_SECRET>\n" +
      "(or set THREADS_SHORT_LIVED_TOKEN / THREADS_APP_SECRET env vars)"
  );
  process.exit(1);
}

const url = new URL("https://graph.threads.net/access_token");
url.searchParams.set("grant_type", "th_exchange_token");
url.searchParams.set("client_secret", appSecret);
url.searchParams.set("access_token", shortLivedToken);

const res = await fetch(url);
const data = await res.json().catch(() => null);

if (!res.ok) {
  console.error(`Request failed with HTTP ${res.status}`);
  console.error(data);
  process.exit(1);
}

console.log(data);

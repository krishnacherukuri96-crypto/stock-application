import { prisma } from "./prisma";

export interface DhanCredentials {
  token:    string;
  clientId: string;
}

// Returns a valid access token, auto-renewing if within 2 hours of expiry.
// On first call: seeds DB from DHAN_ACCESS_TOKEN env var if no DB entry exists.
export async function getDhanToken(): Promise<DhanCredentials | null> {
  try {
    let stored = await prisma.dhanToken.findUnique({ where: { id: "singleton" } });

    // If DB has no entry, seed from env var
    if (!stored) {
      const env = parseEnvToken();
      if (!env) return null;
      try {
        stored = await prisma.dhanToken.upsert({
          where:  { id: "singleton" },
          update: { accessToken: env.token, clientId: env.clientId, expiresAt: env.expiresAt },
          create: { id: "singleton", accessToken: env.token, clientId: env.clientId, expiresAt: env.expiresAt },
        });
      } catch {
        // DB table may not exist yet — return env creds directly
        return { token: env.token, clientId: env.clientId };
      }
    }

    const msToExpiry = stored.expiresAt.getTime() - Date.now();

    // Auto-renew when < 2 hours remain
    if (msToExpiry < 2 * 3600 * 1000) {
      const renewed = await callRenewToken(stored.accessToken, stored.clientId);
      if (renewed) {
        const expiresAt = parseISTDate(renewed.expiryTime);
        try {
          await prisma.dhanToken.update({
            where: { id: "singleton" },
            data:  { accessToken: renewed.accessToken, expiresAt },
          });
        } catch { /* non-critical */ }
        return { token: renewed.accessToken, clientId: stored.clientId };
      }
      if (msToExpiry <= 0) {
        // Expired and renewal failed — try fresh env var as last resort
        const env = parseEnvToken();
        return env ? { token: env.token, clientId: env.clientId } : null;
      }
    }

    return { token: stored.accessToken, clientId: stored.clientId };

  } catch {
    // DB unavailable — fall back to env var
    const env = parseEnvToken();
    return env ? { token: env.token, clientId: env.clientId } : null;
  }
}

// Parses DHAN_ACCESS_TOKEN (a JWT) and extracts clientId + expiry automatically
function parseEnvToken(): { token: string; clientId: string; expiresAt: Date } | null {
  const token = process.env.DHAN_ACCESS_TOKEN;
  if (!token) return null;

  let clientId  = process.env.DHAN_CLIENT_ID ?? "";
  let expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // default 24h

  try {
    // Decode JWT payload (middle segment) without verification
    const payloadB64 = token.split(".")[1];
    const payload    = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8")) as {
      dhanClientId?: string;
      exp?:          number;
    };
    if (payload.dhanClientId) clientId  = payload.dhanClientId;
    if (payload.exp)          expiresAt = new Date(payload.exp * 1000);
  } catch { /* use defaults */ }

  return { token, clientId, expiresAt };
}

// Calls Dhan's RenewToken endpoint to silently extend token by 24 h
async function callRenewToken(currentToken: string, clientId: string) {
  try {
    const res = await fetch("https://api.dhan.co/v2/RenewToken", {
      method: "POST",
      headers: {
        "access-token":  currentToken,
        "client-id":     clientId,
        "Content-Type":  "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json() as { accessToken: string; expiryTime: string };
  } catch {
    return null;
  }
}

// Step 1: Generate a Dhan OAuth consent session
export async function generateDhanConsent(dhanClientId: string) {
  const appId     = process.env.DHAN_APP_ID;
  const appSecret = process.env.DHAN_APP_SECRET;
  if (!appId || !appSecret) throw new Error("DHAN_APP_ID / DHAN_APP_SECRET not configured");

  const res = await fetch(
    `https://auth.dhan.co/app/generate-consent?client_id=${dhanClientId}`,
    {
      method:  "POST",
      headers: { app_id: appId, app_secret: appSecret, "Content-Type": "application/json" },
    },
  );
  if (!res.ok) throw new Error(`Dhan consent error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.consentAppId) throw new Error("No consentAppId returned by Dhan");
  return json.consentAppId as string;
}

// Step 3: Exchange tokenId for access token and persist it
export async function consumeDhanConsent(tokenId: string) {
  const appId     = process.env.DHAN_APP_ID;
  const appSecret = process.env.DHAN_APP_SECRET;
  if (!appId || !appSecret) throw new Error("DHAN_APP_ID / DHAN_APP_SECRET not configured");

  const res = await fetch(
    `https://auth.dhan.co/app/consumeApp-consent?tokenId=${tokenId}`,
    {
      method:  "POST",
      headers: { app_id: appId, app_secret: appSecret, "Content-Type": "application/json" },
    },
  );
  if (!res.ok) throw new Error(`Token exchange error ${res.status}: ${await res.text()}`);

  const json = await res.json() as {
    dhanClientId: string;
    accessToken:  string;
    expiryTime:   string;
  };

  const expiresAt = parseISTDate(json.expiryTime);
  await prisma.dhanToken.upsert({
    where:  { id: "singleton" },
    update: { accessToken: json.accessToken, clientId: json.dhanClientId, expiresAt },
    create: { id: "singleton", accessToken: json.accessToken, clientId: json.dhanClientId, expiresAt },
  });
  return json;
}

// Dhan returns expiry as IST without timezone suffix: "2025-09-23T12:37:23"
function parseISTDate(raw: string): Date {
  return new Date(raw.includes("+") ? raw : raw + "+05:30");
}

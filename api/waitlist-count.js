const crypto = require("crypto");

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(key) {
  return key ? key.replace(/\\n/g, "\n") : "";
}

function allowedOrigin(origin) {
  const configured = process.env.ORBIT_ALLOWED_ORIGINS || "https://matttan2.github.io";
  const origins = configured.split(",").map((item) => item.trim()).filter(Boolean);
  return origin && origins.includes(origin) ? origin : origins[0] || "*";
}

async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google service account credentials");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsignedToken = `${header}.${claims}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const signature = signer.sign(privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`
    })
  });

  if (!tokenResponse.ok) {
    throw new Error("Google token request failed");
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function getWaitlistCount() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE || "A:A";
  const headerRows = Number(process.env.GOOGLE_SHEET_HEADER_ROWS || 1);

  if (!sheetId) {
    throw new Error("Missing Google Sheet ID");
  }

  const accessToken = await getAccessToken();
  const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const sheetResponse = await fetch(sheetUrl, {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });

  if (!sheetResponse.ok) {
    throw new Error("Google Sheet request failed");
  }

  const sheetData = await sheetResponse.json();
  const rows = Array.isArray(sheetData.values) ? sheetData.values : [];
  const filledRows = rows.filter((row) => row.some((cell) => String(cell || "").trim()));

  return Math.max(0, filledRows.length - headerRows);
}

module.exports = async function handler(request, response) {
  const origin = allowedOrigin(request.headers.origin);

  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Vary", "Origin");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const count = await getWaitlistCount();
    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    response.status(200).json({ count, updatedAt: new Date().toISOString() });
  } catch {
    response.status(500).json({ error: "Unable to load waitlist count" });
  }
};

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface DhanStatus {
  connected:  boolean;
  clientId?:  string;
  expiresAt?: string;
  hoursLeft?: number;
  isExpired?: boolean;
  updatedAt?: string;
}

function SettingsContent() {
  const params  = useSearchParams();
  const success = params.get("success") === "true";
  const error   = params.get("error");

  const [status,   setStatus]   = useState<DhanStatus | null>(null);
  const [clientId, setClientId] = useState("");
  const [loading,  setLoading]  = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const callbackUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/dhan/callback`
    : "/api/dhan/callback";

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/dhan/status");
      setStatus(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchStatus(); }, []);

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/dhan/status", { method: "DELETE" });
    await fetchStatus();
    setDisconnecting(false);
  }

  const connectUrl = `/api/dhan/connect?clientId=${encodeURIComponent(clientId)}`;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Manage integrations for your dashboard.</p>

      {/* Success / Error banners */}
      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          Dhan account connected successfully. The token will auto-renew every 24 hours.
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <strong>Error:</strong> {decodeURIComponent(error)}
        </div>
      )}

      {/* ── Dhan Connection Card ── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Dhan Account</h2>
            <p className="text-xs text-gray-500 mt-0.5">Powers the Momentum Scanner with live NSE data</p>
          </div>
          {loading ? (
            <span className="text-xs text-gray-400">Checking…</span>
          ) : status?.connected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs">
              Not connected
            </span>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Connected state */}
          {status?.connected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Client ID</div>
                  <div className="font-mono font-medium text-gray-900">{status.clientId}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Token expires</div>
                  <div className={`font-medium text-sm ${status.isExpired ? "text-red-600" : status.hoursLeft! < 4 ? "text-amber-600" : "text-gray-700"}`}>
                    {status.isExpired
                      ? "Expired — reconnect below"
                      : `${status.hoursLeft}h remaining (auto-renews)`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Last updated</div>
                  <div className="text-gray-600 text-sm">
                    {status.updatedAt ? new Date(status.updatedAt).toLocaleString("en-IN") : "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 rounded-lg border text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
                <span className="text-xs text-gray-400">
                  Token auto-renews before expiry — you should never need to reconnect.
                </span>
              </div>
            </div>
          )}

          {/* Connect form */}
          {(!status?.connected || status?.isExpired) && (
            <div className="space-y-4">

              {/* Step 0 — prerequisites */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 space-y-1">
                <p className="font-semibold">Before connecting:</p>
                <p>1. Go to <strong>dhanhq.co</strong> → Generate API Key tab</p>
                <p>2. Set <strong>Redirect URL</strong> to: <code className="bg-blue-100 px-1 rounded text-xs">{callbackUrl}</code></p>
                <p>3. Add <code className="bg-blue-100 px-1 rounded text-xs">DHAN_APP_ID</code> and <code className="bg-blue-100 px-1 rounded text-xs">DHAN_APP_SECRET</code> to your Vercel environment variables</p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Your Dhan Client ID
                  <span className="ml-1 text-xs text-gray-400 font-normal">(your Dhan account/login number)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1000123456"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <a
                  href={connectUrl}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
                    clientId.trim()
                      ? "bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                      : "bg-gray-300 pointer-events-none"
                  }`}
                >
                  Connect Dhan Account →
                </a>
                <p className="text-xs text-gray-400">
                  You&apos;ll be redirected to Dhan to log in. After approval you&apos;ll come back here automatically. This is a one-time step.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── How auto-renewal works ── */}
      <div className="mt-6 bg-gray-50 rounded-xl border p-5 text-sm text-gray-600 space-y-1">
        <p className="font-semibold text-gray-800 mb-2">How auto-renewal works</p>
        <p>Every time the Momentum Scanner fetches data, it checks if your Dhan token expires within 2 hours.</p>
        <p>If yes, it automatically calls Dhan&apos;s <code className="bg-gray-200 px-1 rounded text-xs">RenewToken</code> API and stores the new token — no action needed from you.</p>
        <p className="text-gray-400">The API Key itself (valid 12 months) is stored in Vercel env vars and never expires during normal use.</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

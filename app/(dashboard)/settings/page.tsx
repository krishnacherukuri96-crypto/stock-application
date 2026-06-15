"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface DhanStatus {
  connected:  boolean;
  clientId?:  string;
  expiresAt?: string;
  hoursLeft?: number;
  isExpired?: boolean;
  updatedAt?: string | null;
  source?:    "database" | "env_var";
  warning?:   string;
  reason?:    string;
}

interface SyncStatus {
  count:      number;
  lastSynced: string | null;
}

interface WatchlistEntry {
  symbol:     string;
  name:       string;
  securityId: number | null;
  resolved:   boolean;
}

interface SearchResult {
  symbol:     string;
  name:       string;
  securityId: number;
}

function SettingsContent() {
  const params  = useSearchParams();
  const success = params.get("success") === "true";
  const error   = params.get("error");

  // ── Dhan connection ──
  const [dhanStatus,    setDhanStatus]    = useState<DhanStatus | null>(null);
  const [clientId,      setClientId]      = useState("");
  const [loadingDhan,   setLoadingDhan]   = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [renewing,      setRenewing]      = useState(false);
  const [renewResult,   setRenewResult]   = useState<string | null>(null);

  // ── Instrument sync ──
  const [syncStatus,  setSyncStatus]  = useState<SyncStatus | null>(null);
  const [syncing,     setSyncing]     = useState(false);
  const [syncResult,  setSyncResult]  = useState<string | null>(null);

  // ── Watchlist ──
  const [watchlist,      setWatchlist]      = useState<WatchlistEntry[]>([]);
  const [loadingWL,      setLoadingWL]      = useState(true);
  const [addInput,       setAddInput]       = useState("");
  const [addLoading,     setAddLoading]     = useState(false);
  const [addError,       setAddError]       = useState<string | null>(null);
  const [searchResults,  setSearchResults]  = useState<SearchResult[]>([]);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const callbackUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/dhan/callback`
    : "/api/dhan/callback";

  // ── Dhan status ──
  async function fetchDhanStatus() {
    setLoadingDhan(true);
    try {
      const res = await fetch("/api/dhan/status");
      setDhanStatus(await res.json());
    } catch { /* ignore */ }
    setLoadingDhan(false);
  }

  // ── Sync status ──
  async function fetchSyncStatus() {
    try {
      const res = await fetch("/api/dhan/sync-instruments");
      setSyncStatus(await res.json());
    } catch { /* ignore */ }
  }

  // ── Watchlist ──
  async function fetchWatchlist() {
    setLoadingWL(true);
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      setWatchlist(data.items ?? []);
    } catch { /* ignore */ }
    setLoadingWL(false);
  }

  useEffect(() => {
    fetchDhanStatus();
    fetchSyncStatus();
    fetchWatchlist();
  }, []);

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/dhan/status", { method: "DELETE" });
    await fetchDhanStatus();
    setDisconnecting(false);
  }

  async function renewNow() {
    setRenewing(true);
    setRenewResult(null);
    try {
      const res  = await fetch("/api/dhan/renew", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRenewResult(`Renewed — expires ${new Date(data.expiresAt).toLocaleString("en-IN")}`);
        await fetchDhanStatus();
      } else {
        setRenewResult(`Failed: ${data.reason}`);
      }
    } catch (e) {
      setRenewResult(`Error: ${String(e)}`);
    }
    setRenewing(false);
  }

  async function syncInstruments() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/dhan/sync-instruments", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncResult(`Error: ${data.error}`);
      } else {
        setSyncResult(`Synced ${data.count.toLocaleString()} NSE instruments successfully.`);
        await fetchSyncStatus();
        await fetchWatchlist(); // refresh resolved status
      }
    } catch (e) {
      setSyncResult(`Network error: ${String(e)}`);
    }
    setSyncing(false);
  }

  // Typeahead search
  function onAddInput(val: string) {
    setAddInput(val);
    setAddError(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/watchlist/search?q=${encodeURIComponent(val.toUpperCase().trim())}`);
        const data = await res.json();
        setSearchResults(data.results ?? []);
        setSearchOpen((data.results ?? []).length > 0);
      } catch { /* ignore */ }
    }, 200);
  }

  async function addStock(symbol: string) {
    setAddLoading(true);
    setAddError(null);
    setSearchOpen(false);
    setAddInput("");
    setSearchResults([]);
    try {
      const res  = await fetch("/api/watchlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (data.error) {
        setAddError(data.error);
      } else {
        await fetchWatchlist();
      }
    } catch (e) {
      setAddError(String(e));
    }
    setAddLoading(false);
  }

  async function removeStock(symbol: string) {
    try {
      await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
      setWatchlist(w => w.filter(x => x.symbol !== symbol));
    } catch { /* ignore */ }
  }

  const connectUrl = `/api/dhan/connect?clientId=${encodeURIComponent(clientId)}`;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Settings</h1>
        <p className="text-sm text-gray-500">Manage integrations and your momentum watchlist.</p>
      </div>

      {/* Success / Error banners from OAuth redirect */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          Dhan account connected successfully. Token will auto-renew every 24 hours.
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <strong>Error:</strong> {decodeURIComponent(error)}
        </div>
      )}

      {/* ── 1. Dhan Connection Card ── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Dhan Account</h2>
            <p className="text-xs text-gray-500 mt-0.5">Powers the Momentum Scanner with live NSE data</p>
          </div>
          {loadingDhan ? (
            <span className="text-xs text-gray-400">Checking…</span>
          ) : dhanStatus?.connected ? (
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
          {dhanStatus?.connected && (
            <div className="space-y-3">
              {/* DB unreachable warning */}
              {dhanStatus.source === "env_var" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">⚠ Database unreachable — token read directly from env var</p>
                  <p>Your <code className="bg-amber-100 px-1 rounded">DATABASE_URL</code> is using the direct Supabase connection (port 5432) which doesn&apos;t work on Vercel serverless. You need the <strong>Transaction Pooler URL</strong> (port 6543).</p>
                  <p className="font-medium">Fix: In Supabase → Project Settings → Database → Connection string → select <strong>Transaction</strong> mode → copy that URL → update <code className="bg-amber-100 px-1 rounded">DATABASE_URL</code> in Vercel env vars → redeploy.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Client ID</div>
                  <div className="font-mono font-medium text-gray-900">{dhanStatus.clientId}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Token expires</div>
                  <div className={`font-medium text-sm ${dhanStatus.isExpired ? "text-red-600" : (dhanStatus.hoursLeft ?? 99) < 4 ? "text-amber-600" : "text-gray-700"}`}>
                    {dhanStatus.isExpired
                      ? "Expired — reconnect below"
                      : `${dhanStatus.hoursLeft}h remaining (auto-renews)`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Last updated</div>
                  <div className="text-gray-600 text-sm">
                    {dhanStatus.updatedAt ? new Date(dhanStatus.updatedAt).toLocaleString("en-IN") : dhanStatus.source === "env_var" ? "From env var" : "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <button
                  onClick={renewNow}
                  disabled={renewing || dhanStatus?.isExpired}
                  className="px-4 py-2 rounded-lg border border-indigo-200 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                >
                  {renewing ? "Renewing…" : "Renew Now"}
                </button>
                <button
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 rounded-lg border text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
              {renewResult && (
                <p className={`text-xs mt-1 ${renewResult.startsWith("Failed") || renewResult.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                  {renewResult}
                </p>
              )}
            </div>
          )}

          {(!dhanStatus?.connected || dhanStatus?.isExpired) && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 space-y-1">
                <p className="font-semibold">Before connecting:</p>
                <p>1. Go to <strong>dhanhq.co</strong> → Generate API Key tab</p>
                <p>2. Set <strong>Redirect URL</strong> to: <code className="bg-blue-100 px-1 rounded text-xs">{callbackUrl}</code></p>
                <p>3. Add <code className="bg-blue-100 px-1 rounded text-xs">DHAN_APP_ID</code> and <code className="bg-blue-100 px-1 rounded text-xs">DHAN_APP_SECRET</code> to Vercel env vars</p>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Your Dhan Client ID
                  <span className="ml-1 text-xs text-gray-400 font-normal">(your Dhan account number)</span>
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Instrument Sync Card ── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-900">NSE Instrument Library</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Sync Dhan&apos;s instrument master to enable adding <strong>any NSE stock</strong> to your watchlist
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              {syncStatus?.lastSynced ? (
                <div className="text-sm text-gray-700">
                  <span className="font-semibold text-emerald-600">{syncStatus.count.toLocaleString()}</span> NSE stocks cached
                  <span className="text-xs text-gray-400 ml-2">
                    (synced {new Date(syncStatus.lastSynced).toLocaleDateString("en-IN")})
                  </span>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Not synced yet — using default Nifty 50 list</div>
              )}
            </div>
            <button
              onClick={syncInstruments}
              disabled={syncing}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {syncing ? "Syncing…" : syncStatus?.lastSynced ? "Re-sync" : "Sync Now"}
            </button>
          </div>

          {syncing && (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              Downloading Dhan instrument master (~10 MB) and indexing NSE stocks…
            </div>
          )}

          {syncResult && (
            <div className={`p-3 rounded-lg text-sm ${
              syncResult.startsWith("Error")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}>
              {syncResult}
            </div>
          )}

          <p className="text-xs text-gray-400 leading-relaxed">
            Downloads the official Dhan instrument master CSV (~10 MB) and stores NSE EQ stocks in your database.
            Only needed once — use Re-sync monthly to pick up new listings.
          </p>
        </div>
      </div>

      {/* ── 3. Watchlist Management Card ── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-900">Momentum Watchlist</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {watchlist.length === 0
              ? "No custom list — scanner uses Nifty 50 defaults"
              : `${watchlist.length} stocks being scanned for intraday momentum`}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Add stock input */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Add a stock
              {!syncStatus?.lastSynced && (
                <span className="ml-2 text-xs text-amber-600 font-normal">
                  (sync instruments first for typeahead search)
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="e.g. ZOMATO, IRCTC, DMART…"
                  value={addInput}
                  onChange={e => onAddInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && addInput.trim()) addStock(addInput.trim().toUpperCase());
                    if (e.key === "Escape") { setSearchOpen(false); setSearchResults([]); }
                  }}
                  onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
                />
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-10 overflow-hidden">
                    {searchResults.map(r => (
                      <button
                        key={r.symbol}
                        onMouseDown={() => addStock(r.symbol)}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm flex items-center justify-between gap-3 border-b last:border-0"
                      >
                        <div>
                          <span className="font-semibold font-mono text-gray-900">{r.symbol}</span>
                          <span className="ml-2 text-gray-500 text-xs">{r.name}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">#{r.securityId}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => addInput.trim() && addStock(addInput.trim().toUpperCase())}
                disabled={addLoading || !addInput.trim()}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {addLoading ? "Adding…" : "Add"}
              </button>
            </div>
            {addError && (
              <p className="mt-1.5 text-xs text-red-600">{addError}</p>
            )}
          </div>

          {/* Current watchlist */}
          {loadingWL ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : watchlist.length === 0 ? (
            <div className="py-6 text-center rounded-xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">No custom stocks added yet.</p>
              <p className="text-xs text-gray-400 mt-0.5">
                The scanner will use the default Nifty 50 list until you add stocks above.
              </p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Symbol</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Dhan ID</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {watchlist.map(item => (
                    <tr key={item.symbol} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono font-semibold text-gray-900">{item.symbol}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{item.name}</td>
                      <td className="px-4 py-2.5">
                        {item.securityId ? (
                          <span className="font-mono text-xs text-gray-500">#{item.securityId}</span>
                        ) : (
                          <span className="text-xs text-amber-600">No ID — sync instruments</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => removeStock(item.symbol)}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {watchlist.length > 0 && (
            <p className="text-xs text-gray-400">
              Custom watchlist active — momentum scanner is tracking these {watchlist.length} stocks instead of the Nifty 50 defaults.
              Remove all stocks to revert to defaults.
            </p>
          )}
        </div>
      </div>

      {/* ── How auto-renewal works ── */}
      <div className="bg-gray-50 rounded-xl border p-5 text-sm text-gray-600 space-y-2">
        <p className="font-semibold text-gray-800">How token renewal works — fully automatic</p>
        <div className="space-y-1 text-gray-500">
          <p>🕗 <strong>Daily cron at 8:00 AM IST (weekdays)</strong> — Vercel automatically calls <code className="bg-gray-200 px-1 rounded text-xs">POST /api/dhan/renew</code> every morning before market open. Token stays fresh without any action from you.</p>
          <p>🔄 <strong>On every scanner call</strong> — if token is within 2 hours of expiry, it renews inline as a safety net.</p>
          <p>🔑 <strong>One-time setup</strong> — generate a token from Dhan HQ once, add it to <code className="bg-gray-200 px-1 rounded text-xs">DHAN_ACCESS_TOKEN</code> in Vercel env vars, and never touch it again.</p>
        </div>
        <p className="text-xs text-gray-400 pt-1 border-t">If you see &quot;Dhan not connected&quot; it means the initial token was never set, or it expired while the app was inactive. Generate a fresh token from Dhan HQ and update the env var — the cron will handle everything after that.</p>
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

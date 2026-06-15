"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const nav = [
  { href: "/", label: "Overview", icon: "◉" },
  { href: "/rbi-rates", label: "RBI Rates", icon: "🏦" },
  { href: "/inflation", label: "Inflation", icon: "📈" },
  { href: "/gdp", label: "GDP", icon: "📊" },
  { href: "/iip", label: "IIP", icon: "🏭" },
  { href: "/fiscal-deficit", label: "Fiscal Deficit", icon: "💰" },
  { href: "/budget", label: "Union Budget", icon: "📋" },
  { href: "/stock-selection", label: "Stock Selection", icon: "🔎" },
  { href: "/intraday",  label: "Intraday Scanner", icon: "⚡" },
  { href: "/momentum", label: "Momentum",         icon: "🔥" },
  { href: "/settings", label: "Settings",         icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">India Macro</h1>
        <p className="text-xs text-gray-400 mt-0.5">Economic Dashboard</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-700">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>⎋</span> Sign out
        </button>
      </div>
    </aside>
  );
}

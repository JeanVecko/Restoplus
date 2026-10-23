import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthenticatedActor } from "@/server/auth/session";
import { Icon } from "./dashboard-icon";

const navigation: {
  label: string;
  href: string;
  icon: Parameters<typeof Icon>[0]["name"];
}[] = [
  { label: "Tableau de bord", href: "/", icon: "dashboard" },
  { label: "Menus", href: "/menus", icon: "menu" },
  { label: "Tables", href: "/tables", icon: "table" },
  { label: "Commandes", href: "/commandes", icon: "order" },
  { label: "Cuisine / Bar", href: "/cuisine", icon: "kitchen" },
  { label: "Caisse", href: "/caisse", icon: "cash" },
  { label: "Stocks", href: "/stocks", icon: "stock" },
  { label: "Rapports", href: "/rapports", icon: "report" },
  { label: "Utilisateurs", href: "/utilisateurs", icon: "users" },
  { label: "Parametres", href: "/parametres", icon: "settings" },
];

export function DashboardLayout({
  actor,
  todayStr,
  children,
}: {
  actor: AuthenticatedActor;
  todayStr: string;
  children: ReactNode;
}) {
  const initials = actor.displayName
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rp-dashboard min-h-screen bg-[#f0f2f5] text-slate-900 lg:flex">
      <aside className="rp-sidebar border-b border-slate-200/10 bg-gradient-to-b from-[#1a1b1e] to-[#252629] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[260px] lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="rp-brand flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-6">
          <Image
            src="/resto-plus-logo.jpeg"
            alt="Resto+"
            width={48}
            height={48}
            priority
            className="rp-logo size-11 rounded-xl bg-white object-contain p-0.5 shadow-lg shadow-black/20"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.2em] text-amber-400 uppercase">
              Resto+
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white/90">
              {actor.restaurantName}
            </p>
          </div>
        </div>
        <nav
          aria-label="Navigation principale"
          className="rp-nav flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-4 lg:pb-4"
        >
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rp-nav-link flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-slate-300/80 transition-all duration-200 hover:bg-white/8 hover:text-white lg:w-full lg:px-4 lg:py-3"
            >
              <Icon name={item.icon} className="size-[18px] shrink-0 opacity-70" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="rp-user-card hidden border-t border-white/10 p-4 lg:block">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3 backdrop-blur-sm">
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-white shadow-md shadow-amber-500/20">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/90">
                {actor.displayName}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {actor.role} · {actor.restaurantCode}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="rp-main min-w-0 flex-1 px-5 pt-6 pb-10 sm:px-7 lg:px-10 lg:py-8 xl:px-12">
        <header className="rp-header mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-400">
              {todayStr}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Tableau de bord
            </h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

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
    <div className="rp-dashboard min-h-screen bg-[#f6f7f9] text-slate-900 lg:flex">
      <aside className="rp-sidebar border-b border-slate-200 bg-[#202124] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[248px] lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0 lg:border-white/5">
        <div className="rp-brand flex items-center gap-3 px-4 py-3 lg:px-5 lg:py-5">
          <Image
            src="/resto-plus-logo.jpeg"
            alt="Resto+"
            width={54}
            height={54}
            priority
            className="rp-logo size-12 rounded-xl bg-white object-contain p-0.5"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-amber-400 uppercase">
              Gestion restaurant
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {actor.restaurantName}
            </p>
          </div>
        </div>
        <nav
          aria-label="Navigation principale"
          className="rp-nav flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-3 lg:pb-4"
        >
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rp-nav-link flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors lg:w-full lg:px-3.5 lg:py-3 text-slate-300 hover:bg-white/8 hover:text-white`}
            >
              <Icon name={item.icon} className="size-[18px] shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="rp-user-card hidden border-t border-white/10 p-4 lg:block">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-amber-400/15 text-sm font-bold text-amber-300">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                {actor.displayName}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {actor.role} · {actor.restaurantCode}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="rp-main min-w-0 flex-1 px-4 pt-5 pb-8 sm:px-6 lg:px-8 lg:py-7 xl:px-10">
        <header className="rp-header mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {todayStr}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">
              Tableau de bord
            </h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
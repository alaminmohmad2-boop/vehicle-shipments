import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  FileBarChart,
  LayoutDashboard,
  Package,
  Settings,
  Ship,
  Tags,
  Warehouse,
} from "lucide-react";
import type { ReactNode } from "react";
import { LanguageSwitch } from "@/client/components/LanguageSwitch";
import { ThemePreferenceRadio } from "@/client/components/ThemePreferenceMenuItems";
import { t } from "@/lib/i18n";

/**
 * The frame every page sits in: a bar with the way back to the Gateway and
 * the theme pick, then one scrolling column. The document itself doesn't
 * scroll (src/client/styles/app.css); the column does. A page starts with a
 * `PageHeader`. An app with more than one page puts its tabs or links in
 * `nav`.
 */
export function AppShell({
  nav,
  wide = false,
  children,
}: {
  nav?: ReactNode;
  /** A wider column, for pages built around a table. */
  wide?: boolean;
  children: ReactNode;
}) {
  const gatewayUrl = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData;
      return root && "gatewayUrl" in root ? root.gatewayUrl : null;
    },
  });
  return (
    <div className="flex h-dvh flex-col lg:flex-row print:block print:h-auto">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex print:hidden">
        <div className="flex h-16 items-center gap-3 px-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Ship className="size-5" aria-hidden />
          </span>
          <span className="text-base font-semibold leading-tight">
            {t("Vehicle Shipments")}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {nav ?? <AppNav vertical />}
        </div>
        <div className="space-y-3 border-t border-sidebar-border p-4">
          <div className="flex items-center justify-between gap-2">
            <LanguageSwitch />
            <ThemePreferenceRadio />
          </div>
          {gatewayUrl ? (
            <a
              href={gatewayUrl}
              className="inline-flex items-center gap-1 text-xs text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
              {t("All apps")}
            </a>
          ) : null}
        </div>
      </aside>
      <header className="shrink-0 bg-sidebar text-sidebar-foreground lg:hidden print:hidden">
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Ship className="size-4" aria-hidden />
            {t("Vehicle Shipments")}
          </span>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <ThemePreferenceRadio />
          </div>
        </div>
        <div className="overflow-x-auto px-2 pb-2">{nav ?? <AppNav />}</div>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto print:overflow-visible">
        <main
          className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-4xl"} space-y-8 px-4 pt-6 pb-24 md:px-10 md:pt-10 print:max-w-none print:p-0`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

const ITEMS = [
  { to: "/", label: "Bookings", icon: Package, exact: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/yard", label: "Yard", icon: Warehouse },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/tariffs", label: "Tariffs", icon: Tags },
  { to: "/settings", label: "Company", icon: Settings },
] as const;

/** The app's sections. */
function AppNav({ vertical = false }: { vertical?: boolean }) {
  const linkClass =
    "flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:font-medium data-[status=active]:text-sidebar-primary-foreground";
  return (
    <nav
      className={vertical ? "flex flex-col gap-1" : "flex items-center gap-1"}
    >
      {ITEMS.map(({ to, label, icon: Icon, ...rest }) => (
        <Link
          key={to}
          to={to}
          className={linkClass}
          activeOptions={"exact" in rest ? { exact: true } : undefined}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}

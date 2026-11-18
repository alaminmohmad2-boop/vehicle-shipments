import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ThemePreferenceRadio } from "@/client/components/ThemePreferenceMenuItems";

/**
 * The frame every page sits in: a bar with the way back to the Gateway and
 * the theme pick, then one scrolling column. The document itself doesn't
 * scroll (src/client/styles/app.css); the column does. A page starts with a
 * `PageHeader`. An app with more than one page puts its tabs or links in
 * `nav`.
 */
export function AppShell({
  nav = <AppNav />,
  wide = false,
  children,
}: {
  nav?: ReactNode;
  /** A wider column, for pages built around a table. */
  wide?: boolean;
  children: ReactNode;
}) {
  // From the root route's loader (src/serverFunctions/gateway.ts).
  const gatewayUrl = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData;
      return root && "gatewayUrl" in root ? root.gatewayUrl : null;
    },
  });
  return (
    <div className="flex h-dvh flex-col print:block print:h-auto">
      <header className="shrink-0 border-b border-border print:hidden">
        <div
          className={`${column(wide)} flex h-12 items-center justify-between gap-3`}
        >
          <div className="flex min-w-0 items-center gap-4">
            {gatewayUrl ? (
              <a
                href={gatewayUrl}
                className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden />
                All apps
              </a>
            ) : null}
            {nav}
          </div>
          <ThemePreferenceRadio />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
        <main
          className={`${column(wide)} space-y-10 pt-8 pb-24 md:pt-10 print:pt-0 print:pb-0`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** The column the bar and the page share. */
const column = (wide: boolean) =>
  `mx-auto w-full ${wide ? "max-w-6xl" : "max-w-3xl"} px-4 md:px-10`;

/** The app's two sections. */
function AppNav() {
  const linkClass =
    "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";
  return (
    <nav className="flex items-center gap-4">
      <Link to="/" className={linkClass} activeOptions={{ exact: true }}>
        Bookings
      </Link>
      <Link to="/tariffs" className={linkClass}>
        Tariffs
      </Link>
    </nav>
  );
}

import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import {
  themePreferenceInitScript,
  useThemePreference,
} from "@/client/lib/theme";
import appCss from "@/client/styles/app.css?url";
import { langFromCookie, setLang, type Lang } from "@/lib/i18n";
import { useRouterState } from "@tanstack/react-router";
import { getGatewayUrl } from "@/serverFunctions/gateway";

export const Route = createRootRoute({
  // Where the Gateway is: the way back to it (AppShell), and the theme pick
  // the app shares with the launcher and every other app.
  loader: () => getGatewayUrl(),
  staleTime: Infinity,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
});

/** Toasts ("Copied") in the app's theme. */
function ThemedToaster() {
  const { themePreference } = useThemePreference();
  return <Toaster theme={themePreference} position="bottom-right" />;
}

function RootDocument({ children }: { children: ReactNode }) {
  const serverLang: Lang = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData;
      return root && "lang" in root && root.lang === "ar" ? "ar" : "en";
    },
  });
  // The cookie may not reach the server (some proxies drop it), so the
  // browser re-reads it after load and re-renders if it differs.
  const [lang, setLangState] = useState<Lang>(serverLang);
  useEffect(() => {
    const fromBrowser = langFromCookie(document.cookie);
    if (fromBrowser !== lang) setLangState(fromBrowser);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  // Set before the page below renders, on the server and in the browser.
  setLang(lang);
  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the theme before the first paint: dark never flashes light. */}
        <script
          dangerouslySetInnerHTML={{ __html: themePreferenceInitScript }}
        />
        <HeadContent />
      </head>
      <body>
        <Fragment key={lang}>{children}</Fragment>
        <ThemedToaster />
        <Scripts />
      </body>
    </html>
  );
}

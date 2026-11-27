import { getLang, LANG_COOKIE, type Lang } from "@/lib/i18n";

/** English / العربية. Saves the pick in a cookie and reloads the page. */
export function LanguageSwitch() {
  const lang = getLang();
  const pick = (next: Lang) => {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  const cls = (active: boolean) =>
    `rounded-md px-2 py-1 text-xs transition-colors print:hidden ${
      active
        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
    }`;
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-sidebar-border p-0.5 print:hidden"
      role="group"
      aria-label={lang === "ar" ? "اللغة" : "Language"}
    >
      <button
        type="button"
        className={cls(lang === "en")}
        onClick={() => pick("en")}
        lang="en"
      >
        English
      </button>
      <button
        type="button"
        className={cls(lang === "ar")}
        onClick={() => pick("ar")}
        lang="ar"
      >
        العربية
      </button>
    </div>
  );
}

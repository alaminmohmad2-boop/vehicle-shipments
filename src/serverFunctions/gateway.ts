import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { langFromCookie } from "@/lib/i18n";
import { ConfigurationError, gatewayUrl } from "@every-app/sdk/server";

/**
 * The Gateway's origin: the way back to the other apps, and the host the
 * light/dark cookie is set on. No middleware: the public tracking page
 * renders under the same root, and the Gateway's address is no secret.
 */
export const getGatewayUrl = createServerFn().handler(() => {
  const lang = langFromCookie(getRequestHeader("cookie"));
  try {
    return { gatewayUrl: new URL(gatewayUrl(env)).origin, lang };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return { gatewayUrl: null, lang };
  }
});

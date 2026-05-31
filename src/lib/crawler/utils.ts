import { CRAWLER_USER_AGENT } from "./constants";

export function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function resolveUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function isHttpUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function isInternalUrl(candidate: string, origin: string) {
  try {
    const parsed = new URL(candidate);
    return parsed.origin === origin;
  } catch {
    return false;
  }
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function defaultHeaders() {
  return {
    "User-Agent": CRAWLER_USER_AGENT,
  };
}

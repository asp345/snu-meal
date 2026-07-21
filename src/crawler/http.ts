import http from "node:http";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

export const SNU_BROWSER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

export interface FetchTextOptions {
  userAgent?: string;
  insecureSnucoTls?: boolean;
}

function charsetFromHeaders(headers: IncomingHttpHeaders): string | undefined {
  const contentType = headers["content-type"];
  const value = Array.isArray(contentType) ? contentType[0] : contentType;
  return value?.match(/charset\s*=\s*["']?\s*([A-Za-z0-9_-]+)/i)?.[1];
}

function decodeBody(body: Buffer, headers: IncomingHttpHeaders): string {
  const headerCharset = charsetFromHeaders(headers);
  const head = body.subarray(0, 8192).toString("latin1");
  const metaCharset = head.match(/charset\s*=\s*["']?\s*([A-Za-z0-9_-]+)/i)?.[1];
  const charset = headerCharset ?? metaCharset ?? "utf-8";

  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

function parseUrl(value: string, base?: URL): URL | undefined {
  return URL.parse(value, base) ?? undefined;
}

export function fetchText(
  url: string,
  options: FetchTextOptions = {},
  redirects = 0,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = parseUrl(url);
    if (!parsedUrl) {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }
    const transport = parsedUrl.protocol === "https:" ? https : http;
    const request = transport.get(
      parsedUrl,
      {
        headers: options.userAgent ? { "user-agent": options.userAgent } : undefined,
        rejectUnauthorized: !(options.insecureSnucoTls && parsedUrl.hostname === "snuco.snu.ac.kr"),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          response.resume();
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error(`Too many redirects fetching ${url}`));
            return;
          }
          const redirectedUrl = parseUrl(location, parsedUrl);
          if (!redirectedUrl) {
            reject(new Error(`Invalid redirect URL from ${url}`));
            return;
          }
          fetchText(redirectedUrl.toString(), options, redirects + 1).then(resolve, reject);
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`HTTP ${status} fetching ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => resolve(decodeBody(Buffer.concat(chunks), response.headers)));
        response.on("error", reject);
      },
    );

    const timeout = setTimeout(() => {
      request.destroy(new Error(`Request timed out after ${TIMEOUT_MS}ms: ${url}`));
    }, TIMEOUT_MS);
    timeout.unref();
    request.on("close", () => clearTimeout(timeout));
    request.on("error", reject);
  });
}

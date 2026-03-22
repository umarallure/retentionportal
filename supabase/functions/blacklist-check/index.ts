// @ts-nocheck

type LookupResponse = {
  sid?: string;
  status?: string;
  message?: string;
  code?: string[];
  phone?: string;
  results?: number;
  wireless?: number;
  carrier?: Record<string, unknown>;
  db?: Array<Record<string, unknown>>;
};

const resolveAllowedOrigin = (origin: string | null): string => {
  if (!origin) return "*";

  const localhostPatterns = ["http://localhost", "https://localhost", "http://127.0.0.1", "https://127.0.0.1"];
  if (localhostPatterns.some((p) => origin.startsWith(p))) {
    return origin;
  }

  // Keep production permissive unless you want to lock this to specific app origins.
  return "*";
};

const corsHeadersFor = (req: Request) => {
  const origin = req.headers.get("origin");
  const requestHeaders = req.headers.get("access-control-request-headers");

  return {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(origin),
    "Access-Control-Allow-Headers":
      requestHeaders ??
      "authorization, x-client-info, apikey, content-type, x-requested-with, x-forwarded-for, x-real-ip",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
};

const BLACKLIST_STATUSES = new Set(["blacklisted", "suppressed", "federaldnc", "statednc"]);
const TCPA_CODE_KEYWORDS = [
  "plaintiff",
  "attorney",
  "prelitigation",
  "anti-telemarketing",
  "federal-dnc",
  "gov",
];

const normalizePhone = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  if (digits.length === 10) {
    return digits;
  }

  return null;
};

const parseLookupPayload = (raw: unknown): LookupResponse | null => {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const nested = record.data;
  if (nested && typeof nested === "object") {
    return nested as LookupResponse;
  }

  return record as LookupResponse;
};

const hasTcpaCode = (codes: unknown): boolean => {
  if (!Array.isArray(codes)) return false;
  return codes.some((code) => {
    if (typeof code !== "string") return false;
    const lowered = code.toLowerCase();
    return TCPA_CODE_KEYWORDS.some((keyword) => lowered.includes(keyword));
  });
};

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("BLACKLIST_ALLIANCE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing BLACKLIST_ALLIANCE_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const phone = normalizePhone(body.phone ?? body.mobileNumber);

    if (!phone) {
      return new Response(JSON.stringify({ error: "Invalid phone number. Provide a 10-digit US number." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = Deno.env.get("BLACKLIST_ALLIANCE_BASE_URL") ?? "https://api.blacklistalliance.net";
    const ver = Deno.env.get("BLACKLIST_ALLIANCE_VER") ?? "v5";

    const url = new URL("/lookup", baseUrl);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("ver", ver);
    url.searchParams.set("resp", "json");
    url.searchParams.set("phone", phone);

    const upstreamResponse = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Blacklist lookup failed",
          status: upstreamResponse.status,
          details: text,
        }),
        {
          status: upstreamResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let rawPayload: unknown = null;
    try {
      rawPayload = JSON.parse(text);
    } catch {
      // If upstream responds with raw format, treat non-zero as blacklisted.
      const rawValue = text.trim();
      const isBlacklisted = rawValue === "1";
      return new Response(
        JSON.stringify({
          data: {
            phone,
            provider: "blacklistalliance",
            is_blacklisted: isBlacklisted,
            is_dnc: isBlacklisted,
            is_tcpa: isBlacklisted,
            status: isBlacklisted ? "tcpa" : "clear",
            message: isBlacklisted
              ? "Blacklisted number detected by Blacklist Alliance."
              : "Number is clear.",
            raw: rawValue,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const payload = parseLookupPayload(rawPayload);
    const message = typeof payload?.message === "string" ? payload.message : "";
    const normalizedMessage = message.toLowerCase();
    const blacklistedByMessage = BLACKLIST_STATUSES.has(normalizedMessage);
    const blacklistedByCode = hasTcpaCode(payload?.code);
    const blacklistedByResults = typeof payload?.results === "number" && payload.results > 0 && normalizedMessage !== "good";

    const isBlacklisted = blacklistedByMessage || blacklistedByCode || blacklistedByResults;
    const isTcpa = isBlacklisted;
    const isDnc = isBlacklisted;

    return new Response(
      JSON.stringify({
        data: {
          phone,
          provider: "blacklistalliance",
          is_blacklisted: isBlacklisted,
          is_dnc: isDnc,
          is_tcpa: isTcpa,
          status: isTcpa ? "tcpa" : isDnc ? "dnc" : "clear",
          message: isTcpa
            ? "WARNING: This number is blacklisted/TCPA flagged."
            : "This number is clear. Please verify consent with the customer.",
          upstream_message: payload?.message ?? null,
          codes: Array.isArray(payload?.code) ? payload?.code : [],
          carrier: payload?.carrier ?? null,
          raw: payload ?? rawPayload,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

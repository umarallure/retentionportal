import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

const VICIDIAL_AGENT_USER = "hussain_khan";

function buildVicidialUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_VICIDIAL_AGENT_URL ||
    process.env.NEXT_PUBLIC_VICIDIAL_URL ||
    "";
  if (!baseUrl) return "";

  const campaignId =
    (typeof window !== "undefined"
      ? localStorage.getItem("retention_portal_vicidial_campaign")?.trim()
      : null) ||
    process.env.NEXT_PUBLIC_VICIDIAL_CAMPAIGN_ID ||
    "ret1cda9";

  try {
    const u = new URL(baseUrl);
    if (campaignId) u.searchParams.set("VD_campaign", campaignId);
    u.searchParams.set("VD_login", VICIDIAL_AGENT_USER);
    return u.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Iframe that lives in _app.tsx and never unmounts.
 * When on the dialer page, it positions itself over the element with
 * id="vicidial-iframe-anchor". On other pages it's hidden (0×0).
 */
export function PersistentVicidialIframe() {
  const router = useRouter();
  const isDialerPage = router.pathname === "/agent/dialer";
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [url] = useState<string>(() => buildVicidialUrl());
  const [hasEverMounted, setHasEverMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (isDialerPage && !hasEverMounted && url) {
      setHasEverMounted(true);
    }
  }, [isDialerPage, hasEverMounted, url]);

  useEffect(() => {
    if (!isDialerPage) {
      setRect(null);
      return;
    }

    function updateRect() {
      const anchor = document.getElementById("vicidial-iframe-anchor");
      if (anchor) {
        setRect(anchor.getBoundingClientRect());
      }
    }

    updateRect();
    const interval = setInterval(updateRect, 500);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [isDialerPage]);

  if (!url || !hasEverMounted) return null;

  const visible = isDialerPage && rect != null;

  return (
    <iframe
      ref={iframeRef}
      id="vicidial-persistent-iframe"
      src={url}
      allow="microphone; autoplay; speaker-selection; camera"
      title="VICIdial Agent"
      style={
        visible
          ? {
              position: "fixed",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              border: "none",
              zIndex: 10,
            }
          : {
              position: "fixed",
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              opacity: 0,
              pointerEvents: "none",
              zIndex: -1,
            }
      }
    />
  );
}

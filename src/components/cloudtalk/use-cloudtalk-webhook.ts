/**
 * Hook to listen for CloudTalk webhook events
 * Automatically navigates to deal details page when a call is answered
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

export function useCloudTalkWebhook() {
  const router = useRouter();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDealIdRef = useRef<number | null>(null);
  const processedContactsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pollLatestContact = async () => {
      try {
        const response = await fetch("/api/cloudtalk/webhook/latest");
        const data = await response.json();

        if (data.success && data.contact) {
          const { phone, dealId } = data.contact;

          // Create a unique key for this contact (phone + dealId)
          const contactKey = `${phone}-${dealId}`;

          // Only process if it's a new contact we haven't seen before
          if (dealId && !processedContactsRef.current.has(contactKey)) {
            processedContactsRef.current.add(contactKey);
            lastDealIdRef.current = dealId;

            console.log("[CloudTalk Webhook] Call answered, navigating to deal:", dealId, {
              phone,
            });

            // Navigate to deal details page (client-side, no reload)
            void router.push(`/agent/assigned-lead-details?dealld=${dealId}`);
          }
        }
      } catch (error) {
        // Silently fail - don't spam console with polling errors
        console.debug("[CloudTalk Webhook] Polling error:", error);
      }
    };

    // Poll every 1 second for faster response
    pollingIntervalRef.current = setInterval(pollLatestContact, 1000);

    // Initial poll
    pollLatestContact();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [router]);

  return null;
}

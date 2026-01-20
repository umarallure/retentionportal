/**
 * Hook to listen for CloudTalk webhook events
 * Polls the latest contact endpoint and updates dashboard context
 */

import { useEffect, useRef } from "react";
import { useDashboard } from "@/components/dashboard-context";
import { useRouter } from "next/router";

export function useCloudTalkWebhook() {
  const { setCurrentLeadPhone } = useDashboard();
  const router = useRouter();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastContactRef = useRef<string | null>(null);

  useEffect(() => {
    // Only poll if user is an agent (you can add access check here)
    // For now, we'll poll for all users, but you can restrict it

    const pollLatestContact = async () => {
      try {
        const response = await fetch("/api/cloudtalk/webhook/latest");
        const data = await response.json();

        if (data.success && data.contact) {
          const { phone, leadId, dealId } = data.contact;

          // Only update if it's a new contact (different from last one)
          if (phone && phone !== lastContactRef.current) {
            lastContactRef.current = phone;
            
            // Update the current lead phone in dashboard context
            setCurrentLeadPhone(phone);

            console.log("[CloudTalk Webhook] Updated current lead phone:", phone, {
              leadId,
              dealId,
            });

            // Optional: Navigate to lead details if dealId is found
            // if (dealId) {
            //   router.push(`/agent/assigned-lead-details?dealld=${dealId}`);
            // }
          }
        }
      } catch (error) {
        // Silently fail - don't spam console with polling errors
        console.debug("[CloudTalk Webhook] Polling error:", error);
      }
    };

    // Poll every 2 seconds for new contacts
    pollingIntervalRef.current = setInterval(pollLatestContact, 2000);

    // Initial poll
    pollLatestContact();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [setCurrentLeadPhone, router]);

  return null;
}

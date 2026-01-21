/**
 * Hook to listen for CloudTalk webhook events
 * DISABLED: No longer using webhook polling - agents use External URL button in CloudTalk instead
 */

import { useRouter } from "next/router";

export function useCloudTalkWebhook() {
  // Webhook polling disabled - agents now use the "Lead Details" button in CloudTalk
  // which opens the details page in a new tab via ExternalUrl
  return null;
}

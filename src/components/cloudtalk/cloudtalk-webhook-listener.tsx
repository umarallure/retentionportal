/**
 * CloudTalk Webhook Listener Component
 * Listens for CloudTalk webhook events and updates dashboard context
 */

"use client";

import { useCloudTalkWebhook } from "./use-cloudtalk-webhook";
import { useAccess } from "@/components/access-context";

export function CloudTalkWebhookListener() {
  const { access } = useAccess();
  
  // Only listen for webhooks if user is an agent
  if (!access.isAgent) {
    return null;
  }

  useCloudTalkWebhook();
  return null;
}

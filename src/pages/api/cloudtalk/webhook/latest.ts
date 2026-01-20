/**
 * Get Latest CloudTalk Contact
 * Returns the most recent contact number received from CloudTalk webhook
 * Frontend can poll this endpoint to get updates
 */

import type { NextApiRequest, NextApiResponse } from "next";

// Simple in-memory store (in production, use Redis or database)
let latestContact: {
  phone: string;
  leadId?: number;
  dealId?: number;
  timestamp: string;
} | null = null;

// Export function to update latest contact (used by webhook)
export function updateLatestContact(phone: string, leadId?: number, dealId?: number) {
  latestContact = {
    phone,
    leadId,
    dealId,
    timestamp: new Date().toISOString(),
  };
}

// Export function to get latest contact
export function getLatestContact() {
  return latestContact;
}

type LatestContactResponse = {
  success: boolean;
  contact?: {
    phone: string;
    leadId?: number;
    dealId?: number;
    timestamp: string;
  };
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LatestContactResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Only GET requests are accepted.",
    });
  }

  try {
    return res.status(200).json({
      success: true,
      contact: latestContact || undefined,
    });
  } catch (error) {
    console.error("[CloudTalk Latest Contact] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

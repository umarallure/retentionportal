/**
 * CloudTalk Contact API Integration
 * Adds contacts to CloudTalk campaigns via tag-based routing
 */

// Hardcoded mapping for Hussain (agent profile ID -> CloudTalk config)
// TODO: Move to database or config file for multiple agents
// For now, ALL agents use Hussain's CloudTalk config:
// - Agent ID: 530325
// - Tag ID: 1165830
// - Tag Name: "testing compaign" (used in API)
// - Campaign ID: 293641 (Hussain's parallel dialer campaign)
//
// To add more agents:
// 1. Create a campaign for each agent in CloudTalk dashboard
// 2. Create a tag for each agent
// 3. Add mapping here: AGENT_CLOUDTALK_MAP[profileId] = { agentId, tagId, tagName, campaignId }
const AGENT_CLOUDTALK_MAP: Record<string, { agentId: string; tagId: string; tagName: string; campaignId: string }> = {
  // Default to Hussain's config for all agents (hardcoded for now)
  default: {
    agentId: "530325",
    tagId: "1165830",
    tagName: "testing compaign", // Tag name used in API (Tags array with name field)
    campaignId: "293641",
  },
};

interface CloudTalkContactResponse {
  responseData: {
    status: number;
    data?: {
      id: string;
    };
    message?: string;
  };
}

/**
 * Get CloudTalk configuration for an agent profile ID
 * For now, hardcoded to Hussain's config
 */
function getCloudTalkConfig(profileId: string): { agentId: string; tagId: string; tagName: string; campaignId: string } | null {
  // Check if we have a specific mapping for this profile
  if (AGENT_CLOUDTALK_MAP[profileId]) {
    return AGENT_CLOUDTALK_MAP[profileId];
  }

  // For now, default to Hussain's config
  // TODO: Add proper agent mapping logic
  return AGENT_CLOUDTALK_MAP.default;
}

// Base URL for the deployed Retention Portal app
const RETENTION_PORTAL_BASE_URL = "https://retention-portal-lyart.vercel.app";

/**
 * Build the external URL for lead details page
 */
function buildLeadDetailUrl(dealId: number): string {
  return `${RETENTION_PORTAL_BASE_URL}/agent/assigned-lead-details?dealId=${dealId}`;
}

/**
 * Add a contact to CloudTalk with the agent's tag
 * This automatically adds them to the agent's campaign
 */
export async function addContactToCloudTalk(
  phoneNumber: string,
  firstName: string,
  lastName: string,
  agentProfileId: string,
  dealId?: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get CloudTalk config for this agent
    const config = getCloudTalkConfig(agentProfileId);
    if (!config) {
      console.warn(`[CloudTalk] No config found for agent profile ${agentProfileId}`);
      return { success: false, error: "Agent not configured for CloudTalk" };
    }

    // Get API credentials from environment
    const accountId = process.env.NEXT_PUBLIC_CLOUDTALK_ACCOUNT_ID;
    const apiSecret = process.env.NEXT_PUBLIC_CLOUDTALK_API_SECRET;

    if (!accountId || !apiSecret) {
      console.warn("[CloudTalk] API credentials not configured");
      return { success: false, error: "CloudTalk API credentials not configured" };
    }

    // Format phone number (ensure it starts with +)
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith("+")) {
      // If it doesn't start with +, assume US number and add +1
      formattedPhone = formattedPhone.replace(/\D/g, ""); // Remove non-digits
      if (formattedPhone.length === 10) {
        formattedPhone = `+1${formattedPhone}`;
      } else if (formattedPhone.length === 11 && formattedPhone.startsWith("1")) {
        formattedPhone = `+${formattedPhone}`;
      } else {
        formattedPhone = `+${formattedPhone}`;
      }
    }

    // Create Basic Auth header
    const authString = `${accountId}:${apiSecret}`;
    const base64Auth = Buffer.from(authString).toString("base64");

    // Build full name
    const fullName = `${firstName || "Unknown"} ${lastName || "Contact"}`.trim();

    // Build request body
    const requestBody: Record<string, unknown> = {
        name: fullName,
        ContactNumber: [
          {
            public_number: formattedPhone,
          },
        ],
        ContactsTag: [
          {
            name: config.tagName, // Use tag name (not ID)
          },
        ],
    };

    // Add ExternalUrl if dealId is provided - this shows as a button in CloudTalk when call connects
    if (dealId) {
      requestBody.ExternalUrl = [
        {
          name: "Lead Details",
          url: buildLeadDetailUrl(dealId),
        },
      ];
    }

    // Make request to CloudTalk API
    // CloudTalk API format: uses ContactNumber array and ContactsTag array with name
    const response = await fetch("https://my.cloudtalk.io/api/contacts/add.json", {
      method: "PUT",
      headers: {
        Authorization: `Basic ${base64Auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json()) as CloudTalkContactResponse;

    if (data.responseData.status === 201 || data.responseData.status === 200) {
      console.log(`[CloudTalk] Contact added successfully: ${formattedPhone}`, {
        contactId: data.responseData.data?.id,
        tagId: config.tagId,
        agentId: config.agentId,
      });
      return { success: true };
    } else {
      const errorMessage = data.responseData.message || "Unknown error";
      console.error(`[CloudTalk] Failed to add contact: ${errorMessage}`, {
        status: data.responseData.status,
        phone: formattedPhone,
      });
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    console.error("[CloudTalk] Error adding contact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse name into first and last name
 */
export function parseName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  if (!fullName || !fullName.trim()) {
    return { firstName: "Unknown", lastName: "Contact" };
  }

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

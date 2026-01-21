"use client";

import * as React from "react";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuickDispositionButton } from "@/components/agent/quick-disposition-button";
import { PhoneIcon, XIcon } from "lucide-react";

type LeadHeaderProps = {
  name: string;
  carrier: string;
  productType: string;
  center: string;
  dealId: number | null;
  previousAssignedDealId: number | null;
  nextAssignedDealId: number | null;
  assignedDealsLoading: boolean;
  selectedPolicyView: unknown;
  onPreviousLead: () => void;
  onNextLead: () => void;
  onOpenDisposition: () => void;
};

export function LeadHeader({
  name,
  carrier,
  productType,
  center,
  dealId,
  previousAssignedDealId,
  nextAssignedDealId,
  assignedDealsLoading,
  selectedPolicyView,
  onPreviousLead,
  onNextLead,
  onOpenDisposition,
}: LeadHeaderProps) {
  // Check if this page was opened from CloudTalk (new tab from dialer)
  const canCloseTab = typeof window !== "undefined" && window.opener !== null;

  const handleReturnToDialer = () => {
    if (canCloseTab) {
      // Page was opened from dialer - close this tab to return
      window.close();
    } else {
      // Fallback: navigate to dialer page
      window.location.href = "/agent/dialer";
    }
  };

  return (
    <CardHeader>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle>{name}</CardTitle>
          <CardDescription>
            {carrier !== "-" ? carrier : ""}
            {productType !== "-" ? ` • ${productType}` : ""}
            {center !== "-" ? ` • ${center}` : ""}
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* Return to Dialer button - prominent for agents */}
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-1.5 bg-green-600 hover:bg-green-700"
            onClick={handleReturnToDialer}
          >
            <PhoneIcon className="h-4 w-4" />
            {canCloseTab ? "Done - Return to Dialer" : "Go to Dialer"}
          </Button>
          <QuickDispositionButton onClick={onOpenDisposition} disabled={!selectedPolicyView || !dealId} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={assignedDealsLoading || !dealId || !previousAssignedDealId}
            onClick={onPreviousLead}
          >
            Previous Lead
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={assignedDealsLoading || !dealId || !nextAssignedDealId}
            onClick={onNextLead}
          >
            Next Lead
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}


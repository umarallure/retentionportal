"use client";

import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useAircallWorkspace } from "@/components/aircall/use-aircall-workspace";
import { useDashboard } from "@/components/dashboard-context";

export function AircallPopover({ open }: { open: boolean }) {
  const containerId = "#aircall-workspace";
  const { ready, loggedIn, lastError, dialNumber, autoDialNumber } = useAircallWorkspace({ enabled: open, containerId });
  const { currentLeadPhone } = useDashboard();
  const previousPhoneRef = useRef<string | null>(null);

  useEffect(() => {
    const shouldPopulate = open && loggedIn && currentLeadPhone && currentLeadPhone !== "-";
    if (!shouldPopulate) {
      previousPhoneRef.current = currentLeadPhone;
      return;
    }

    if (previousPhoneRef.current === currentLeadPhone) return;
    previousPhoneRef.current = currentLeadPhone;

    autoDialNumber(currentLeadPhone);
  }, [currentLeadPhone, open, loggedIn, autoDialNumber]);

  return (
    <div className="w-[380px] overflow-hidden rounded-md border bg-background shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b bg-background px-4 pb-3 pt-3">
        <div className="flex flex-1 items-center justify-between">
          <div className="text-sm font-semibold">Dialer</div>
          <Badge variant="outline" className="text-[10px]">
            {ready ? (loggedIn ? "Logged in" : "Logged out") : "Loading..."}
          </Badge>
        </div>
      </div>

      {lastError ? <div className="border-b px-4 py-2 text-xs text-destructive">{lastError}</div> : null}

      <div className="border-b bg-background px-4 py-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Current lead phone</div>
            <div className="truncate text-sm font-medium text-foreground">
              {currentLeadPhone && currentLeadPhone !== "-" ? currentLeadPhone : "No phone on current lead"}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="text-xs"
            disabled={!currentLeadPhone || currentLeadPhone === "-" || !loggedIn}
            onClick={() => {
              if (!currentLeadPhone) return;
              dialNumber(currentLeadPhone);
            }}
          >
            Call lead
          </Button>
        </div>
      </div>

      <div className="bg-muted/10">
        <div id="aircall-workspace" className="h-[580px] w-full" />
      </div>
    </div>
  );
}

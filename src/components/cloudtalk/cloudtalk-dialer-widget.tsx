"use client";

import * as React from "react";
import { PhoneIcon, XIcon, Minimize2Icon } from "lucide-react";

import { useAccess } from "@/components/access-context";
import { useDashboard } from "@/components/dashboard-context";
import { Button } from "@/components/ui/button";

export function CloudTalkDialerWidget() {
  const { access } = useAccess();
  const { dialerOpen, setDialerOpen } = useDashboard();
  const [isMinimized, setIsMinimized] = React.useState(false);

  // Only show for agents
  if (!access.isAgent) {
    return null;
  }

  // Get partner name from environment variable or use default
  const partnerName = process.env.NEXT_PUBLIC_CLOUDTALK_PARTNER_NAME || "unlimitedinsurance";
  const iframeSrc = `https://phone.cloudtalk.io?partner=${partnerName}`;

  // If closed, only show the trigger button
  if (!dialerOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon-lg"
          className="rounded-full shadow-lg bg-primary hover:bg-primary/90"
          aria-label="Open dialer"
          onClick={() => setDialerOpen(true)}
        >
          <PhoneIcon className="size-5" />
        </Button>
      </div>
    );
  }

  // If minimized, show small header bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-[400px]">
        <div className="bg-card border rounded-lg shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
            <h3 className="text-sm font-semibold">CloudTalk Dialer</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsMinimized(false)}
                aria-label="Expand dialer"
              >
                <PhoneIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setDialerOpen(false)}
                aria-label="Close dialer"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full popup widget
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px]">
      <div className="bg-card border rounded-lg shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <h3 className="text-lg font-semibold">CloudTalk Dialer</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMinimized(true)}
              aria-label="Minimize dialer"
            >
              <Minimize2Icon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDialerOpen(false)}
              aria-label="Close dialer"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* Iframe Content */}
        <div className="flex-1 bg-background overflow-hidden relative">
          <iframe
            src={iframeSrc}
            allow="microphone *"
            className="absolute inset-0 w-full h-full border-0"
            title="CloudTalk Dialer"
          />
        </div>
      </div>
    </div>
  );
}

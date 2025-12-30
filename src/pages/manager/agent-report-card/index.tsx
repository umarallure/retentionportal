import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AgentReportCardPage() {
  return (
    <div className="w-full px-8 py-10 min-h-screen bg-muted/20">
      <div className="mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Detailed performance data per agent (placeholder).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input placeholder="Search agent..." />
              <div className="flex gap-2">
                <Button variant="secondary" type="button">
                  Select Agent
                </Button>
                <Button type="button">Refresh</Button>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="grid grid-cols-4 gap-3 p-3 text-sm font-medium text-muted-foreground">
                <div>Agent</div>
                <div>Conversion Rate</div>
                <div>Call Volume</div>
                <div>Lead Aging</div>
              </div>
              <div className="border-t p-3 text-sm text-muted-foreground">No report data yet.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

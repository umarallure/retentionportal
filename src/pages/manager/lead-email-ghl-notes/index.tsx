import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LeadEmailGhlNotesPage() {
  return (
    <div className="w-full px-8 py-10 min-h-screen bg-muted/20">
      <div className="mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Communication History</CardTitle>
            <CardDescription>Timestamp, Agent, Type (Call/Email/Note), Content Summary (placeholder).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Input placeholder="Search by lead, policy #, or agent..." />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" type="button">
                  Filter: Type
                </Button>
                <Button variant="secondary" type="button">
                  Filter: Agent
                </Button>
                <Button type="button">Refresh</Button>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="grid grid-cols-4 gap-3 p-3 text-sm font-medium text-muted-foreground">
                <div>Timestamp</div>
                <div>Agent</div>
                <div>Type</div>
                <div>Summary</div>
              </div>
              <div className="border-t p-3 text-sm text-muted-foreground">No notes yet.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

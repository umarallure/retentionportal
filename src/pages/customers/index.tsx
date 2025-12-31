import * as React from "react";
import { DealsKanbanView } from "@/components/customers/deals-kanban-view";

export default function CustomersPage() {
  const [mounted, setMounted] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(() => {
    setLoading(true);
    setRefreshToken((t) => t + 1);
    setTimeout(() => setLoading(false), 300);
  }, []);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="w-full px-8 py-10 h-screen overflow-hidden bg-muted/20 flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex-1 min-h-0">
        {mounted ? <DealsKanbanView key={refreshToken} onRefresh={refresh} refreshLoading={loading} /> : null}
      </div>
    </div>
  );
}
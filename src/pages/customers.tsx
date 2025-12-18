import * as React from "react";
import { CustomersTable } from "@/components/customers/customers-table";
import { Button } from "@/components/ui/button";
import { useRealtimeMondayDeals } from "@/hooks/use-realtime-monday-deals";
import { RefreshCcw } from "lucide-react";

export default function CustomersPage() {
  const [mounted, setMounted] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const pageSize = 25;

  const { data, loading, refresh, hasMore } = useRealtimeMondayDeals(page, pageSize);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="w-full px-8 py-10 min-h-screen bg-muted/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Customer Pipeline</h1>
            <p className="text-muted-foreground text-sm mt-1">Real-time synchronization with your Monday.com board.</p>
        </div>
        
        <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refresh()} 
            disabled={loading}
            className="w-fit shadow-sm bg-card hover:bg-muted"
        >
            <RefreshCcw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Syncing..." : "Refresh Board"}
        </Button>
      </div>

      <div className="mx-auto space-y-4">
        {mounted ? <CustomersTable data={data} loading={loading} /> : null}

        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            Page <span className="font-medium">{page}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useCallback, useMemo, useState, useRef } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type RetentionDealFlowRow = Record<string, unknown>;

function toTitleCaseLabel(key: string) {
  const overrides: Record<string, string> = {
    id: "ID",
    submission_id: "Submission ID",
    insured_name: "Insured Name",
    client_phone_number: "Client Phone",
    policy_number: "Policy #",
    lead_vendor: "Lead Vendor",
    product_type: "Product Type",
    retention_agent: "Retention Agent",
    licensed_agent_account: "Licensed Agent",
    buffer_agent: "Buffer Agent",
    call_result: "Call Source",
    monthly_premium: "Monthly Premium",
    face_amount: "Coverage Amount",
    draft_date: "Draft Date",
    created_at: "Created",
    updated_at: "Updated",
  };

  if (overrides[key]) return overrides[key];

  const cleaned = key
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned.length) return key;

  return cleaned
    .split(" ")
    .map((w) => {
      const lower = w.toLowerCase();
      if (lower === "id") return "ID";
      if (lower === "ssn") return "SSN";
      if (lower === "dob") return "DOB";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export default function RetentionDailyDealFlowPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<RetentionDealFlowRow[]>([]);

  const [agentFilter, setAgentFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");

  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      window.clearTimeout(t);
    };
  }, [search]);

  const loadRows = useCallback(async (opts?: { toastOnError?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: selectErr } = await supabase
        .from("retention_deal_flow")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (selectErr) throw selectErr;

      const raw = (data ?? []) as RetentionDealFlowRow[];
      setRawRows(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load retention deal flow.";
      setError(msg);
      setRawRows([]);
      if (opts?.toastOnError) {
        toastRef.current({ title: "Load failed", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const tableColumns = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const r of rawRows) {
      for (const k of Object.keys(r)) set.add(k);
    }

    const hidden = new Set([
      "id",
      "submission_id",
      "retention_agent_id",
      "created_at",
      "updated_at",
      "date",
      "draft_date",
      "from_callback",
      "is_retention_call",
      "user_id",
    ]);

    const preferred = [
      "insured_name",
      "client_phone_number",
      "policy_number",
      "lead_vendor",
      "carrier",
      "product_type",
      "retention_agent",
      "licensed_agent_account",
      "agent",
      "buffer_agent",
      "call_result",
      "status",
      "monthly_premium",
      "face_amount",
    ];

    const rest = Array.from(set)
      .filter((k) => !preferred.includes(k) && !hidden.has(k))
      .sort((a, b) => a.localeCompare(b));

    return [...preferred.filter((k) => set.has(k) && !hidden.has(k)), ...rest];
  }, [rawRows]);

  const visibleRows = useMemo<RetentionDealFlowRow[]>(() => {
    const qLower = debouncedSearch.trim().toLowerCase();

    return rawRows.filter((r) => {
      const agentValue =
        (typeof r["licensed_agent_account"] === "string" ? (r["licensed_agent_account"] as string) : "") ||
        (typeof r["agent"] === "string" ? (r["agent"] as string) : "") ||
        (typeof r["retention_agent"] === "string" ? (r["retention_agent"] as string) : "") ||
        (typeof r["buffer_agent"] === "string" ? (r["buffer_agent"] as string) : "");

      const statusValue = typeof r["status"] === "string" ? (r["status"] as string) : "";
      const sourceValue = typeof r["call_result"] === "string" ? (r["call_result"] as string) : "";

      if (agentFilter && agentValue !== agentFilter) return false;
      if (statusFilter && statusValue !== statusFilter) return false;
      if (sourceFilter && sourceValue !== sourceFilter) return false;

      if (!qLower.length) return true;
      for (const v of Object.values ? Object.values(r) : []) {
        if (v == null) continue;
        const s =
          typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
        if (s && s.toLowerCase().includes(qLower)) return true;
      }
      return false;
    });
  }, [agentFilter, debouncedSearch, rawRows, sourceFilter, statusFilter]);

  const filterOptions = useMemo<{ agents: string[]; statuses: string[]; sources: string[] }>(() => {
    const agents = new Set<string>();
    const statuses = new Set<string>();
    const sources = new Set<string>();

    for (const r of rawRows) {
      const agentValue =
        (typeof r["licensed_agent_account"] === "string" ? (r["licensed_agent_account"] as string) : "") ||
        (typeof r["agent"] === "string" ? (r["agent"] as string) : "") ||
        (typeof r["retention_agent"] === "string" ? (r["retention_agent"] as string) : "") ||
        (typeof r["buffer_agent"] === "string" ? (r["buffer_agent"] as string) : "");
      if (agentValue.trim().length) agents.add(agentValue.trim());

      const statusValue = typeof r["status"] === "string" ? (r["status"] as string) : "";
      if (statusValue.trim().length) statuses.add(statusValue.trim());

      const sourceValue = typeof r["call_result"] === "string" ? (r["call_result"] as string) : "";
      if (sourceValue.trim().length) sources.add(sourceValue.trim());
    }

    return {
      agents: Array.from(agents).sort((a: string, b: string) => a.localeCompare(b)),
      statuses: Array.from(statuses).sort((a: string, b: string) => a.localeCompare(b)),
      sources: Array.from(sources).sort((a: string, b: string) => a.localeCompare(b)),
    };
  }, [rawRows]);

  return (
    <div className="w-full px-4 md:px-8 py-10 min-h-screen bg-muted/20">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Retention Daily Deal Flow</h1>
            <p className="text-muted-foreground text-sm mt-1">
              View all active leads across agents. Filter by Agent, Status, or Source to monitor workload and bottlenecks.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Leads</CardTitle>
            <CardDescription>Complete deal flow for all agents.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Input
                placeholder="Search leads (policy #, phone, name, vendor)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <div className="min-w-[180px]">
                  <Label className="sr-only">Agent</Label>
                  <Select
                    value={agentFilter}
                    onValueChange={(v) => {
                      setAgentFilter(v === "__all_agents__" ? "" : v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter: Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all_agents__">All Agents</SelectItem>
                      {filterOptions.agents.map((a: string) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[180px]">
                  <Label className="sr-only">Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v === "__all_statuses__" ? "" : v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter: Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all_statuses__">All Statuses</SelectItem>
                      {filterOptions.statuses.map((s: string) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[180px]">
                  <Label className="sr-only">Source</Label>
                  <Select
                    value={sourceFilter}
                    onValueChange={(v) => {
                      setSourceFilter(v === "__all_sources__" ? "" : v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter: Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all_sources__">All Sources</SelectItem>
                      {filterOptions.sources.map((s: string) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setAgentFilter("");
                    setStatusFilter("");
                    setSourceFilter("");
                  }}
                >
                  Clear Filters
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    void loadRows({ toastOnError: true });
                  }}
                  disabled={loading}
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              {error ? (
                <div className="p-3 text-sm text-red-600">{error}</div>
              ) : loading && rawRows.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Loading...</div>
              ) : visibleRows.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No data yet.</div>
              ) : (
                <table className="min-w-[1400px] w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      {tableColumns.map((c: string) => (
                        <th key={c} className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">
                          {toTitleCaseLabel(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r, idx) => (
                      <tr key={(typeof r["id"] === "string" && (r["id"] as string)) || String(idx)} className="border-t">
                        {tableColumns.map((c: string) => {
                          const v = r[c];
                          const text =
                            v == null
                              ? ""
                              : typeof v === "string"
                                ? v
                                : typeof v === "number" || typeof v === "boolean"
                                  ? String(v)
                                  : JSON.stringify(v);
                          return (
                            <td key={c} className="px-3 py-2 whitespace-nowrap max-w-[260px] truncate" title={text}>
                              {text || "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
  FilterIcon,
} from "lucide-react";

import type { MondayComDeal } from "@/types";

/**
 * Status Badge with refined UI
 */
function statusBadge(status: string | null) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "won" || s === "closed" || s === "issued" || s === "approved"
      ? "bg-green-500/10 text-green-600 border-green-500/20"
      : s === "lost" || s === "canceled" || s === "inactive"
        ? "bg-red-500/10 text-red-600 border-red-500/20"
        : "bg-amber-500/10 text-amber-600 border-amber-500/20";

  return (
    <Badge variant="outline" className={`font-medium ${cls}`}>
      {status ?? "—"}
    </Badge>
  );
}

export function CustomersTable({ data, loading }: { data: MondayComDeal[]; loading: boolean }) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [groupFilter, setGroupFilter] = React.useState<string>("all");
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  // 1. Group the data by group_title
  const groupedData = React.useMemo(() => {
    const groups: Record<string, { deals: MondayComDeal[]; color: string }> = {};
    
    data.forEach((deal) => {
      const title = deal.group_title || "Uncategorized";
      if (!groups[title]) {
        groups[title] = { deals: [], color: deal.group_color || "#cbd5e1" };
      }
      groups[title].deals.push(deal);
    });

    // Initial state: expand all groups
    if (Object.keys(expandedGroups).length === 0 && Object.keys(groups).length > 0) {
        const initial: Record<string, boolean> = {};
        Object.keys(groups).forEach(k => initial[k] = true);
        setExpandedGroups(initial);
    }

    return groups;
  }, [data, expandedGroups]);

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const columns = React.useMemo<ColumnDef<MondayComDeal>[]>(
    () => [
      {
        accessorKey: "policy_number",
        header: "Policy Number",
        cell: ({ row }) => {
          const deal = row.original;
          const id = deal.monday_item_id ?? String(deal.id);
          return (
            <Link href={`/customers/${id}`} className="font-semibold text-foreground hover:underline">
              {deal.policy_number ?? "—"}
            </Link>
          );
        },
      },
      {
        accessorKey: "writing_no",
        header: "Carrier",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.carrier ?? "—"}</span>,
      },
      {
        accessorKey: "policy_status",
        header: "Policy Status",
        cell: ({ row }) => statusBadge(row.original.policy_status),
      },
      {
        accessorKey: "ghl_name",
        header: "GHL Name",
        cell: ({ row }) => <div className="truncate max-w-[180px] font-medium">{row.original.ghl_name ?? "—"}</div>,
      },
      {
        accessorKey: "phone_number",
        header: "Phone No",
        cell: ({ row }) => <span className="tabular-nums">{row.original.phone_number ?? "—"}</span>,
      },
      {
        accessorKey: "call_center",
        header: "Center",
        cell: ({ row }) => <Badge variant="secondary" className="bg-secondary/50">{row.original.call_center ?? "—"}</Badge>,
      },
      {
        accessorKey: "deal_creation_date",
        header: "Creation Date",
        cell: ({ row }) => {
          const date = row.original.deal_creation_date;
          return date ? new Date(date).toLocaleDateString() : "—";
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Filter keys for the Group dropdown
  const uniqueGroups = Object.keys(groupedData);

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative w-full max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by Policy or GHL Name..."
            value={(table.getColumn("policy_number")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("policy_number")?.setFilterValue(e.target.value)}
            className="pl-10 h-10 border-none bg-muted/50 focus-visible:ring-1"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <FilterIcon className="size-4 text-muted-foreground hidden sm:block" />
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 bg-muted/50 border-none">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {uniqueGroups.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grouped Table Content */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table className="table-fixed border-collapse">
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent border-none">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-4 px-6">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground italic">Syncing with Monday.com...</TableCell></TableRow>
            ) : uniqueGroups.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">No records found.</TableCell></TableRow>
            ) : (
              uniqueGroups
                .filter(title => groupFilter === "all" || title === groupFilter)
                .map((groupTitle) => {
                  const group = groupedData[groupTitle];
                  const isExpanded = expandedGroups[groupTitle];

                  return (
                    <React.Fragment key={groupTitle}>
                      {/* Group Header Row */}
                      <TableRow 
                        className="hover:bg-muted/10 cursor-pointer border-l-4" 
                        style={{ borderLeftColor: group.color }}
                        onClick={() => toggleGroup(groupTitle)}
                      >
                        <TableCell colSpan={columns.length} className="py-3 px-6 bg-muted/10">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDownIcon className="size-4 text-muted-foreground" /> : <ChevronRightIcon className="size-4 text-muted-foreground" />}
                            <span className="font-bold text-sm" style={{ color: group.color }}>
                                {groupTitle.toUpperCase()}
                            </span>
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full">
                                {group.deals.length}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Group Items */}
                      {isExpanded &&
                        group.deals.map((deal) => (
                          <TableRow
                            key={deal.id}
                            className="group transition-colors hover:bg-muted/20 border-l-4 border-transparent hover:border-muted-foreground/20 cursor-pointer"
                          >
                            <TableCell className="py-4 px-6 text-sm">
                              <Link
                                href={`/customers/${deal.monday_item_id ?? String(deal.id)}`}
                                className="font-semibold hover:underline"
                              >
                                {deal.policy_number ?? "—"}
                              </Link>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-sm">
                              <span className="text-muted-foreground">{deal.carrier ?? "—"}</span>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-sm">{statusBadge(deal.policy_status)}</TableCell>
                            <TableCell className="py-4 px-6 text-sm">
                              <div className="truncate max-w-[180px] font-medium">{deal.ghl_name ?? "—"}</div>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-sm">
                              <span className="tabular-nums">{deal.phone_number ?? "—"}</span>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-sm">
                              <Badge variant="secondary" className="bg-secondary/50">
                                {deal.call_center ?? "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-sm">
                              {deal.deal_creation_date
                                ? new Date(deal.deal_creation_date).toLocaleDateString()
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                    </React.Fragment>
                  );
                })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
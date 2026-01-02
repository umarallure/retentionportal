"use client";

import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatValue,
  pickRowValue,
  titleizeKey,
  useAssignedLeadDetails,
} from "@/lib/agent/assigned-lead-details.logic";
import { useDashboard } from "@/components/dashboard-context";
import { getDealLabelStyle, getDealTagLabelFromGhlStage, getPolicyStatusStyle } from "@/lib/monday-deal-category-tags";
import { NewSaleWorkflow, FixedPaymentWorkflow, CarrierRequirementsWorkflow, type RetentionType } from "@/components/agent/retention-workflows";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AssignedLeadDetailsPage() {
  const { setCurrentLeadPhone } = useDashboard();
  const [expandedWorkflowKey, setExpandedWorkflowKey] = React.useState<string | null>(null);
  const [activeWorkflowType, setActiveWorkflowType] = React.useState<RetentionType | null>(null);
  const [policyStatusAlertOpen, setPolicyStatusAlertOpen] = React.useState(false);
  const [retentionAgent, setRetentionAgent] = React.useState("");
  const [expandedDealFlowRows, setExpandedDealFlowRows] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;

    const loadLoggedInAgent = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session?.user) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const name = (profile?.display_name as string | null) ?? null;
        if (!cancelled && name && name.trim().length) {
          setRetentionAgent(name);
        }
      } catch {
        if (!cancelled) setRetentionAgent("");
      }
    };

    void loadLoggedInAgent();
    return () => {
      cancelled = true;
    };
  }, []);
  const {
    lead,
    dealId,
    previousAssignedDealId,
    nextAssignedDealId,
    assignedDealsLoading,
    goToPreviousAssignedLead,
    goToNextAssignedLead,
    selectedDeal,
    router,
    mondayLoading,
    duplicateLoading,
    mondayError,
    duplicateError,
    policyCards,
    policyViews,
    selectedPolicyKey,
    setSelectedPolicyKey,
    selectedPolicyView,
    verificationLoading,
    verificationError,
    verificationItems,
    verificationInputValues,
    toggleVerificationItem,
    updateVerificationItemValue,
    dailyFlowLoading,
    dailyFlowError,
    dailyFlowRows,
    personalPhone,
    personalAddress1,
    personalDob,
    personalSsnLast4,
    loading,
    error,
    name,
    carrier,
    productType,
    center,
  } = useAssignedLeadDetails();

  React.useEffect(() => {
    const raw = typeof personalPhone === "string" ? personalPhone.trim() : "";
    const phone = raw && raw !== "-" ? raw : null;
    setCurrentLeadPhone(phone);
  }, [personalPhone, setCurrentLeadPhone]);

  React.useEffect(() => {
    return () => {
      setCurrentLeadPhone(null);
    };
  }, [setCurrentLeadPhone]);

  return (
    <div className="w-full px-6 py-8 min-h-screen bg-muted/20">
      <Dialog open={policyStatusAlertOpen} onOpenChange={setPolicyStatusAlertOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Policy Status Alert
            </DialogTitle>
          </DialogHeader>

          <div className="text-muted-foreground text-lg leading-relaxed">
            This is not a pending policy. Either select a different workflow or policy.
          </div>

          <div className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="secondary"
                className="h-12"
                onClick={() => {
                  setPolicyStatusAlertOpen(false);
                  setExpandedWorkflowKey(selectedPolicyKey);
                  setActiveWorkflowType("fixed_payment");
                }}
              >
                Switch to Fix Payment
              </Button>

              <Button
                variant="secondary"
                className="h-12"
                onClick={() => {
                  setPolicyStatusAlertOpen(false);
                  setExpandedWorkflowKey(selectedPolicyKey);
                  setActiveWorkflowType("new_sale");
                }}
              >
                Switch to New Sale
              </Button>
            </div>

            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => {
                setPolicyStatusAlertOpen(false);
                if (selectedPolicyView && lead && typeof lead.id === "string" && selectedPolicyView.policyNumber) {
                  const raw = (selectedPolicyView.raw ?? null) as unknown as Record<string, unknown> | null;
                  const dealIdForRoute = raw && typeof raw["id"] === "number" ? (raw["id"] as number) : null;
                  void router.push(
                    `/agent/call-update?leadId=${encodeURIComponent(lead.id)}&policyNumber=${encodeURIComponent(
                      selectedPolicyView.policyNumber,
                    )}&dealId=${encodeURIComponent(String(dealIdForRoute ?? ""))}&callCenter=${encodeURIComponent(
                      selectedPolicyView.callCenter ?? "",
                    )}&retentionAgent=${encodeURIComponent(retentionAgent)}&retentionType=carrier_requirements`,
                  );
                }
              }}
            >
              Update Call Result
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="w-full">
        <Card>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={assignedDealsLoading || !dealId || !previousAssignedDealId}
                  onClick={() => void goToPreviousAssignedLead()}
                >
                  Previous Lead
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={assignedDealsLoading || !dealId || !nextAssignedDealId}
                  onClick={() => void goToNextAssignedLead()}
                >
                  Next Lead
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading lead details...</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : !lead && !selectedDeal ? (
              <div className="text-sm text-muted-foreground">Lead not found.</div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                <div className="min-w-0">
                  <Tabs defaultValue="policies" className="w-full min-w-0">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="policies">Policies</TabsTrigger>
                      <TabsTrigger value="daily">Deal Notes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="policies" className="pt-2">
                      <div className="rounded-md border p-4">
                        <div className="text-sm font-medium">Policies</div>
                        <Separator className="my-3" />

                      {mondayLoading || duplicateLoading ? (
                        <div className="text-sm text-muted-foreground">Loading policies...</div>
                      ) : mondayError || duplicateError ? (
                        <div className="text-sm text-red-600">{mondayError ?? duplicateError}</div>
                      ) : policyCards.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No policies found.</div>
                      ) : (
                        <div className="space-y-3 max-w-xl">
                          {policyViews.map((p) => {
                            const isSelected = p.key === selectedPolicyKey;
                            const rawStage = p.raw && typeof (p.raw as { ghl_stage?: unknown }).ghl_stage === "string" ? ((p.raw as { ghl_stage?: string }).ghl_stage as string) : null;
                            const stageLabel = getDealTagLabelFromGhlStage(rawStage);
                            const stageStyle = getDealLabelStyle(stageLabel);

                            const statusLabel = (p.status ?? "").toString();
                            const statusStyle = getPolicyStatusStyle(statusLabel);
                            const shouldShowStatusPill =
                              statusLabel.trim().length > 0 &&
                              statusLabel.trim() !== "—" &&
                              statusLabel.trim().toLowerCase() !== (stageLabel ?? "").toString().trim().toLowerCase();
                            return (
                              <div
                                key={p.key}
                                onClick={() => setSelectedPolicyKey(p.key)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelectedPolicyKey(p.key);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                className={
                                  "text-left rounded-lg border bg-card p-4 transition-all cursor-pointer " +
                                  (isSelected ? "ring-2 ring-primary border-primary shadow-md" : "hover:shadow-sm hover:border-muted-foreground/20")
                                }
                              >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-base font-semibold text-foreground truncate" title={p.clientName}>
                                      {p.clientName}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate mt-0.5" title={String(p.callCenter ?? "")}>
                                      {p.callCenter ?? "—"}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {stageLabel && stageStyle ? (
                                      <div
                                        className="text-[11px] rounded-full border px-2 py-0.5 font-medium whitespace-nowrap"
                                        style={{ backgroundColor: stageStyle.bg, borderColor: stageStyle.border, color: stageStyle.text }}
                                      >
                                        {stageLabel}
                                      </div>
                                    ) : null}
                                    {shouldShowStatusPill ? (
                                      <div
                                        className="text-xs rounded-md border px-2.5 py-1 font-medium whitespace-nowrap"
                                        style={
                                          statusStyle
                                            ? { backgroundColor: statusStyle.bg, borderColor: statusStyle.border, color: statusStyle.text }
                                            : undefined
                                        }
                                      >
                                        {p.status}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-3">
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Policy #</div>
                                    <div className="text-sm font-medium text-foreground truncate" title={p.policyNumber ?? undefined}>
                                      {p.policyNumber ?? "—"}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Carrier</div>
                                    <div className="text-sm font-medium text-foreground truncate" title={p.carrier ?? undefined}>
                                      {p.carrier ?? "—"}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Agent</div>
                                    <div className="text-sm font-medium text-foreground truncate" title={p.agentName ?? undefined}>
                                      {p.agentName ?? "—"}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Monthly Premium</div>
                                    <div className="text-sm font-medium text-foreground">
                                      {formatCurrency(p.monthlyPremium)}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Coverage</div>
                                    <div className="text-sm font-medium text-foreground">
                                      {formatValue(p.coverage)}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Initial Draft Date</div>
                                    <div className="text-sm font-medium text-foreground">
                                      {formatValue(p.initialDraftDate)}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Status Notes</div>
                                  <div className="text-sm text-foreground/80 line-clamp-2" title={p.statusNotes ?? undefined}>
                                    {p.statusNotes ?? "—"}
                                  </div>
                                </div>
                          
                                </div>


                                <div className="mt-3 mb-5 pt-3 border-t">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Last Updated</div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatValue(p.lastUpdated)}
                                    </div>
                                  </div>
                                </div>

                                {isSelected ? (
                                  <div className="mt-4 space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (expandedWorkflowKey === p.key && activeWorkflowType === "new_sale") {
                                            setExpandedWorkflowKey(null);
                                            setActiveWorkflowType(null);
                                          } else {
                                            setExpandedWorkflowKey(p.key);
                                            setActiveWorkflowType("new_sale");
                                          }
                                        }}
                                        className={expandedWorkflowKey === p.key && activeWorkflowType === "new_sale" ? "border-primary bg-primary/10" : ""}
                                      >
                                        New Sale
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (expandedWorkflowKey === p.key && activeWorkflowType === "fixed_payment") {
                                            setExpandedWorkflowKey(null);
                                            setActiveWorkflowType(null);
                                          } else {
                                            setExpandedWorkflowKey(p.key);
                                            setActiveWorkflowType("fixed_payment");
                                          }
                                        }}
                                        className={expandedWorkflowKey === p.key && activeWorkflowType === "fixed_payment" ? "border-primary bg-primary/10" : ""}
                                      >
                                        Fix Payment
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPolicyStatusAlertOpen(true);
                                        }}
                                        className={expandedWorkflowKey === p.key && activeWorkflowType === "carrier_requirements" ? "border-primary bg-primary/10" : ""}
                                      >
                                        Carrier Req.
                                      </Button>
                                    </div>

                                    {expandedWorkflowKey === p.key && activeWorkflowType ? (
                                      <div className="mt-3">
                                        {(() => {
                                          const leadIdForRoute = typeof lead?.id === "string" ? lead.id : null;
                                          const raw = (p.raw ?? null) as unknown as Record<string, unknown> | null;
                                          const dealIdForRoute = raw && typeof raw["id"] === "number" ? (raw["id"] as number) : null;
                                          const phoneNumberForRoute = raw && typeof raw["phone_number"] === "string" ? (raw["phone_number"] as string) : null;
                                          const agentNameForRoute = p.agentName && p.agentName !== "—" ? p.agentName : "";
                                          const writingNumberForRoute = raw && typeof raw["writing_no"] === "string" ? (raw["writing_no"] as string) : "";
                                          const ssnLast4Raw = personalSsnLast4 !== "-" ? personalSsnLast4 : "";
                                          const ssnLast4ForRoute = ssnLast4Raw.length > 4 ? ssnLast4Raw.slice(-4) : ssnLast4Raw;

                                          const deal = {
                                            dealId: dealIdForRoute,
                                            policyNumber: p.policyNumber,
                                            callCenter: p.callCenter,
                                            carrier: p.carrier,
                                            clientName: p.clientName,
                                            phoneNumber: phoneNumberForRoute,
                                          };

                                          const leadInfo = {
                                            dob: personalDob !== "-" ? personalDob : "",
                                            ghlStage: selectedDeal?.ghl_stage ?? "",
                                            agentName: agentNameForRoute,
                                            writingNumber: writingNumberForRoute,
                                            ssnLast4: ssnLast4ForRoute,
                                            address: personalAddress1 !== "-" ? personalAddress1 : "",
                                          };

                                          const handleCancel = () => {
                                            setExpandedWorkflowKey(null);
                                            setActiveWorkflowType(null);
                                          };

                                          if (activeWorkflowType === "new_sale") {
                                            return (
                                              <NewSaleWorkflow
                                                leadId={leadIdForRoute}
                                                dealId={dealIdForRoute}
                                                policyNumber={p.policyNumber}
                                                callCenter={p.callCenter}
                                                retentionAgent={retentionAgent}
                                                onCancel={handleCancel}
                                              />
                                            );
                                          }

                                          if (activeWorkflowType === "fixed_payment") {
                                            return (
                                              <FixedPaymentWorkflow
                                                deal={deal}
                                                leadInfo={leadInfo}
                                                lead={lead}
                                                retentionAgent={retentionAgent}
                                                onCancel={handleCancel}
                                              />
                                            );
                                          }

                                          if (activeWorkflowType === "carrier_requirements") {
                                            return (
                                              <CarrierRequirementsWorkflow
                                                deal={deal}
                                                leadInfo={leadInfo}
                                                lead={lead}
                                                retentionAgent={retentionAgent}
                                                onCancel={handleCancel}
                                              />
                                            );
                                          }

                                          return null;
                                        })()}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      </div>
                    </TabsContent>

                    <TabsContent value="daily" className="pt-2">
                      <div className="rounded-md border p-4 min-w-0">
                        <div className="text-sm font-medium">Daily Deal Flow & Notes</div>
                        <Separator className="my-3" />

                    {dailyFlowLoading ? (
                      <div className="text-sm text-muted-foreground">Loading daily deal flow...</div>
                    ) : dailyFlowError ? (
                      <div className="text-sm text-red-600">{dailyFlowError}</div>
                    ) : dailyFlowRows.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No daily deal flow records found.</div>
                    ) : (
                      <div className="space-y-2">
                        {dailyFlowRows.map((row, idx) => {
                          const rowId = String(row["id"] ?? idx);
                          const isExpanded = expandedDealFlowRows.has(rowId);
                          const note = pickRowValue(row, ["notes", "note", "lead_notes"]);
                          const noteText = typeof note === "string" ? note.trim() : "";
                          const hasNotes = noteText.length > 0;

                          const toggleExpand = () => {
                            setExpandedDealFlowRows((prev) => {
                              const next = new Set(prev);
                              if (next.has(rowId)) {
                                next.delete(rowId);
                              } else {
                                next.add(rowId);
                              }
                              return next;
                            });
                          };

                          return (
                            <div key={rowId} className="rounded-md border bg-card">
                              <div
                                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={toggleExpand}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5">
                                    {hasNotes ? (
                                      isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      )
                                    ) : (
                                      <div className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                                      <div>
                                        <div className="text-xs text-muted-foreground">Date</div>
                                        <div className="font-medium">{formatValue(row["date"])}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Lead Vendor</div>
                                        <div className="font-medium">{formatValue(pickRowValue(row, ["lead_vendor"]))}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Agent</div>
                                        <div className="font-medium">{formatValue(pickRowValue(row, ["agent"]))}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Status</div>
                                        <div className="font-medium">{formatValue(pickRowValue(row, ["status"]))}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Carrier</div>
                                        <div className="font-medium">{formatValue(pickRowValue(row, ["carrier"]))}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Product Type</div>
                                        <div className="font-medium">{formatValue(pickRowValue(row, ["product_type"]))}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Monthly Premium</div>
                                        <div className="font-medium">{formatCurrency(pickRowValue(row, ["monthly_premium"]))}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Face Amount</div>
                                        <div className="font-medium">{formatCurrency(pickRowValue(row, ["face_amount"]))}</div>
                                      </div>
                                    </div>
                                    {hasNotes && !isExpanded && (
                                      <div className="mt-2 text-xs text-muted-foreground italic truncate">
                                        {noteText}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {hasNotes && isExpanded && (
                                <div className="px-3 pb-3">
                                  <div className="ml-7 rounded-md border bg-muted/30 p-3">
                                    <div className="text-xs font-semibold text-muted-foreground mb-2">Notes</div>
                                    <div className="text-sm text-foreground whitespace-pre-wrap">{noteText}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                      </div>
                    </TabsContent>

                  </Tabs>
                </div>

                <Card className="h-fit lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:flex lg:flex-col">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base font-semibold">Verification Panel</CardTitle>
                      <div className="text-xs rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                        {selectedPolicyView?.callCenter ?? "—"}
                      </div>
                    </div>
                    <CardDescription>
                      {selectedPolicyView
                        ? `Selected policy: ${selectedPolicyView.policyNumber ?? "—"}`
                        : "Select a policy to view verification."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="text-muted-foreground">Client Name</div>
                      <div className="font-semibold text-foreground text-right">
                        {selectedPolicyView?.clientName ?? "—"}
                      </div>

                      <div className="text-muted-foreground">Carrier</div>
                      <div className="font-semibold text-foreground text-right">
                        {selectedPolicyView?.carrier ?? "—"}
                      </div>

                      <div className="text-muted-foreground">Policy Number</div>
                      <div className="font-semibold text-foreground text-right">
                        {selectedPolicyView?.policyNumber ?? "—"}
                      </div>

                      <div className="text-muted-foreground">Agent</div>
                      <div className="font-semibold text-foreground text-right">
                        {selectedPolicyView?.agentName ?? "—"}
                      </div>
                    </div>

                    <Separator />

                    {verificationLoading ? (
                      <div className="text-sm text-muted-foreground">Loading verification...</div>
                    ) : verificationError ? (
                      <div className="text-sm text-red-600">{verificationError}</div>
                    ) : verificationItems.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No verification fields yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {verificationItems.map((item) => {
                          const itemId = typeof item.id === "string" ? item.id : null;
                          if (!itemId) return null;
                          const fieldName = typeof item.field_name === "string" ? item.field_name : "";
                          const checked = !!item.is_verified;
                          const value = verificationInputValues[itemId] ?? "";

                          return (
                            <div key={itemId} className="rounded-lg border bg-card px-3 py-2 space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-medium text-foreground truncate" title={fieldName}>
                                  {titleizeKey(fieldName || "Field")}
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                  <div className="text-[11px] text-muted-foreground">
                                    {checked ? "Verified" : "Pending"}
                                  </div>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      void toggleVerificationItem(itemId, Boolean(v));
                                    }}
                                  />
                                </div>
                              </div>

                              <Input
                                value={value}
                                onChange={(e) => {
                                  void updateVerificationItemValue(itemId, e.target.value);
                                }}
                                className="text-xs"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export type DealGroup = { id: string; title: string };

export const DEAL_GROUPS: DealGroup[] = [
  { id: "topics", title: "Pending / Submitted" },
  { id: "group_mkrtrbry", title: "Incomplete/Closed as Incomplete" },
  { id: "closed", title: "Issued Not Paid" },
  { id: "group_mkrnbe1n", title: "Pending Lapse" },
  { id: "group_mkqjtt5t", title: "DNC" },
  { id: "group_mknk1k9f", title: "Issued Paid" },
  { id: "group_mknk5erx", title: "Charged Back" },
  { id: "group_mkpe61ez", title: "DQ" },
  { id: "group_mknk4n43", title: "Past ChargeBack Period" },
  { id: "group_mkpkvn4f", title: "Needs to be resold" },
  { id: "group_mkpt4gvj", title: "CANNOT BE FOUND IN CARRIER" },
];

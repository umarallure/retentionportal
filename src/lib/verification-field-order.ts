const VERIFICATION_FIELD_ORDER = [
  "lead_vendor",
  "customer_full_name",
  "street_address",
  "beneficiary_information",
  "phone_number",
  "date_of_birth",
  "age",
  "sent_to_underwriting",
  "send_to_underwriting",
  "sent_to_uw",
  "sent_to_underwriting_flag",
  "social_security",
  "driver_license",
  "existing_coverage",
  "height",
  "weight",
  "doctors_name",
  "tobacco_use",
  "health_conditions",
  "medications",
  "carrier",
  "monthly_premium",
  "coverage_amount",
  "draft_date",
  "institution_name",
  "beneficiary_routing",
  "beneficiary_account",
  "account_type",
  "birth_state",
  "email",
  "applied_to_life_insurance_last_two_years",
  "product_type",
  "first_draft",
  "additional_notes",
  "la_notes",
  "call_dropped",
] as const;

const verificationFieldOrderIndex = new Map<string, number>(
  VERIFICATION_FIELD_ORDER.map((fieldName, index) => [fieldName, index]),
);

export function sortVerificationItems<T extends Record<string, unknown>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const fieldA = typeof a.field_name === "string" ? a.field_name : "";
    const fieldB = typeof b.field_name === "string" ? b.field_name : "";
    const orderA = verificationFieldOrderIndex.get(fieldA) ?? Number.MAX_SAFE_INTEGER;
    const orderB = verificationFieldOrderIndex.get(fieldB) ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) return orderA - orderB;

    const createdA = typeof a.created_at === "string" ? Date.parse(a.created_at) : NaN;
    const createdB = typeof b.created_at === "string" ? Date.parse(b.created_at) : NaN;
    const safeCreatedA = Number.isFinite(createdA) ? createdA : Number.MAX_SAFE_INTEGER;
    const safeCreatedB = Number.isFinite(createdB) ? createdB : Number.MAX_SAFE_INTEGER;

    if (safeCreatedA !== safeCreatedB) return safeCreatedA - safeCreatedB;
    return fieldA.localeCompare(fieldB);
  });
}

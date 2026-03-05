import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type InputAgent = {
  profileId?: string;
  displayName?: string;
  vicidialUser: string;
  campaignId: string;
  listId: string | number;
  webformBaseUrl?: string;
};

type InputShape = {
  agents: InputAgent[];
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type MappingOutput = Record<
  string,
  {
    campaignId: string;
    listId: string | number;
    vicidialUser: string;
    webformBaseUrl?: string;
  }
>;

function assertEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getArg(name: string, fallback?: string) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const inputPath = path.resolve(
    process.cwd(),
    getArg("--input", "data/vicidial-agent-manual-input.json")!,
  );
  const outputPath = path.resolve(
    process.cwd(),
    getArg("--output", "src/config/vicidial-agent-mapping.local.json")!,
  );

  const raw = await readFile(inputPath, "utf8");
  const input = JSON.parse(raw) as InputShape;
  if (!Array.isArray(input.agents) || input.agents.length === 0) {
    throw new Error("Input must include a non-empty agents[] array");
  }

  const supabase = createClient(
    assertEnv("NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  const displayNames = input.agents
    .map((a) => (typeof a.displayName === "string" ? a.displayName.trim() : ""))
    .filter((v) => v.length > 0);

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("display_name", displayNames.length ? displayNames : [""]);

  if (error) throw new Error(`Failed loading profiles: ${error.message}`);

  const byDisplayName = new Map<string, ProfileRow[]>();
  for (const row of (profiles ?? []) as ProfileRow[]) {
    const key = normalize(row.display_name ?? "");
    if (!key) continue;
    const list = byDisplayName.get(key) ?? [];
    list.push(row);
    byDisplayName.set(key, list);
  }

  const mapping: MappingOutput = {};

  for (const agent of input.agents) {
    if (!agent.vicidialUser?.trim()) throw new Error("Each agent requires vicidialUser");
    if (!agent.campaignId?.trim()) throw new Error(`Agent ${agent.vicidialUser} missing campaignId`);
    if (agent.listId == null || `${agent.listId}`.trim() === "") {
      throw new Error(`Agent ${agent.vicidialUser} missing listId`);
    }

    let profileId = agent.profileId?.trim() ?? "";
    if (!profileId) {
      const displayName = agent.displayName?.trim() ?? "";
      if (!displayName) {
        throw new Error(`Agent ${agent.vicidialUser} requires profileId or displayName`);
      }
      const matches = byDisplayName.get(normalize(displayName)) ?? [];
      if (matches.length === 0) {
        throw new Error(`No profile found for displayName "${displayName}"`);
      }
      if (matches.length > 1) {
        throw new Error(`Multiple profiles found for displayName "${displayName}". Use profileId in input.`);
      }
      profileId = matches[0]!.id;
    }

    mapping[profileId] = {
      campaignId: agent.campaignId.trim(),
      listId: agent.listId,
      vicidialUser: agent.vicidialUser.trim(),
      ...(agent.webformBaseUrl?.trim() ? { webformBaseUrl: agent.webformBaseUrl.trim() } : {}),
    };
  }

  await writeFile(outputPath, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
  console.log(`[mapping] wrote ${Object.keys(mapping).length} entries -> ${outputPath}`);
}

main().catch((error) => {
  console.error("[mapping] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

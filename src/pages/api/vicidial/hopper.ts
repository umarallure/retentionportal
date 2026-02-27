import type { NextApiRequest, NextApiResponse } from "next";
import mysql from "mysql2/promise";
import { callVicidialNonAgentApi, type VicidialParams } from "@/lib/vicidial";

type HopperRow = {
  hopper_order: string;
  priority: string;
  lead_id: string;
  list_id: string;
  phone_number: string;
  status: string;
  last_call_time: string;
  first_name?: string;
  last_name?: string;
};

type HopperResponse =
  | {
      ok: true;
      rows: HopperRow[];
      raw: string;
    }
  | {
      ok: false;
      error: string;
      details?: unknown;
      raw?: string;
    };

export default async function handler(req: NextApiRequest, res: NextApiResponse<HopperResponse>) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { campaign_id } = (req.body ?? {}) as { campaign_id?: string };

  if (!campaign_id) {
    return res.status(400).json({
      ok: false,
      error: "campaign_id is required",
    });
  }

  try {
    const params: VicidialParams = {
      campaign_id,
      stage: "pipe",
      header: "YES",
    };

    const result = await callVicidialNonAgentApi("hopper_list", params);
    const raw = result.raw.trim();

    if (/^ERROR:/i.test(raw)) {
      return res.status(200).json({
        ok: false,
        error: raw.split("\n")[0]?.trim() ?? "VICIdial hopper_list error",
        raw,
      });
    }

    if (!raw) {
      return res.status(200).json({
        ok: true,
        rows: [],
        raw,
      });
    }

    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return res.status(200).json({
        ok: true,
        rows: [],
        raw,
      });
    }

    const header = lines[0].split("|").map((h) => h.trim());
    const dataLines = lines.slice(1);

    const getIndex = (name: string): number => header.indexOf(name);
    const idxHopperOrder = getIndex("hopper_order");
    const idxPriority = getIndex("priority");
    const idxLeadId = getIndex("lead_id");
    const idxListId = getIndex("list_id");
    const idxPhoneNumber = getIndex("phone_number");
    const idxStatus = getIndex("status");
    const idxLastCallTime = getIndex("last_call_time");

    const baseRows: HopperRow[] = dataLines.map((line) => {
      const cols = line.split("|");
      const safeGet = (idx: number): string => (idx >= 0 && idx < cols.length ? cols[idx] ?? "" : "");

      return {
        hopper_order: safeGet(idxHopperOrder),
        priority: safeGet(idxPriority),
        lead_id: safeGet(idxLeadId),
        list_id: safeGet(idxListId),
        phone_number: safeGet(idxPhoneNumber),
        status: safeGet(idxStatus),
        last_call_time: safeGet(idxLastCallTime),
      };
    });

    // Enrich with names from vicidial_list when DB credentials are available
    let rows: HopperRow[] = baseRows;
    const dbHost = process.env.VICIDIAL_DB_HOST;
    const dbUser = process.env.VICIDIAL_DB_USER;
    const dbPass = process.env.VICIDIAL_DB_PASS;
    const dbName = process.env.VICIDIAL_DB_NAME;
    const dbPort = Number(process.env.VICIDIAL_DB_PORT ?? "3306");

    if (dbHost && dbUser && dbName && rows.length > 0) {
      try {
        const conn = await mysql.createConnection({
          host: dbHost,
          user: dbUser,
          password: dbPass ?? undefined,
          database: dbName,
          port: dbPort,
        });

        const leadIds = Array.from(
          new Set(
            rows
              .map((r) => r.lead_id)
              .filter((id): id is string => Boolean(id && id.trim())),
          ),
        );

        if (leadIds.length > 0) {
          const [nameRows] = await conn.query(
            `SELECT lead_id, first_name, last_name FROM vicidial_list WHERE lead_id IN (${leadIds
              .map(() => "?")
              .join(",")})`,
            leadIds,
          );

          const nameMap = new Map<string, { first_name?: string; last_name?: string }>();
          for (const row of nameRows as Array<Record<string, unknown>>) {
            const id = row.lead_id != null ? String(row.lead_id) : "";
            if (!id) continue;
            nameMap.set(id, {
              first_name: row.first_name != null ? String(row.first_name) : undefined,
              last_name: row.last_name != null ? String(row.last_name) : undefined,
            });
          }

          rows = rows.map((r) => {
            const match = nameMap.get(r.lead_id);
            return match
              ? {
                  ...r,
                  first_name: match.first_name,
                  last_name: match.last_name,
                }
              : r;
          });
        }

        await conn.end();
      } catch {
        // If DB lookup fails, still return base hopper data
        rows = baseRows;
      }
    }

    return res.status(200).json({
      ok: true,
      rows,
      raw,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "VICIdial hopper_list request failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}


import { storage } from "../storage";
import type {
  Connector,
  ConnectorMapping,
  SyncRun,
  ConnectorType,
} from "@shared/schema";
import { fetchConnectorData, type ApiClientConfig } from "./api-client";
import { applyMappings, extractSourceId } from "./transforms";

export interface SyncOptions {
  runId?: string;
  batchSize?: number;
  maxPages?: number;
  dryRun?: boolean;
}

export interface SyncResult {
  runId: string;
  connectorId: string;
  status: "success" | "failed";
  recordsIn: number;
  recordsOut: number;
  errors: SyncError[];
  unmappedFields: string[];
  durationMs: number;
  pages: number;
}

interface SyncError {
  type: "fetch" | "transform" | "upsert" | "general";
  message: string;
  recordIndex?: number;
  sourceId?: string;
}

function getTargetTable(
  connectorType: ConnectorType
): "leads" | "payments" | "enrollments" {
  switch (connectorType) {
    case "crm":
      return "leads";
    case "finance":
      return "payments";
    case "academic":
      return "enrollments";
    default:
      return "leads";
  }
}

async function upsertNormalizedRecord(
  table: "leads" | "payments" | "enrollments",
  record: {
    sourceConnectorId: string;
    sourceId: string;
    payload: Record<string, unknown>;
    schoolId?: string | null;
  }
) {
  const data = {
    sourceConnectorId: record.sourceConnectorId,
    sourceId: record.sourceId,
    payload: record.payload,
    schoolId: record.schoolId ?? null,
  };

  switch (table) {
    case "leads":
      return storage.upsertLead(data);
    case "payments":
      return storage.upsertPayment(data);
    case "enrollments":
      return storage.upsertEnrollment(data);
  }
}

async function storeRawResponse(
  connectorId: string,
  rawResponse: string,
  pageIndex: number
): Promise<void> {
  const fileName = `sync_${connectorId}_page_${pageIndex}_${Date.now()}.json`;
  const bucketPath = `raw/${connectorId}/${fileName}`;

  await storage.createRawIngestFile({
    connectorId,
    bucketPath,
    fileName,
    fileSize: Buffer.byteLength(rawResponse, "utf-8"),
    processed: false,
  });
}

export async function runConnector(
  connectorId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: SyncError[] = [];
  const allUnmappedFields = new Set<string>();
  let recordsIn = 0;
  let recordsOut = 0;
  let pages = 0;

  const connector = await storage.getConnector(connectorId);
  if (!connector) {
    throw new Error(`Connector ${connectorId} not found`);
  }
  if (!connector.isActive) {
    throw new Error(`Connector ${connectorId} is not active`);
  }

  const mappings = await storage.getConnectorMappings(connectorId);
  if (mappings.length === 0) {
    throw new Error(
      `No mappings configured for connector ${connectorId}. Configure field mappings before running sync.`
    );
  }

  let syncRun: SyncRun;
  if (options.runId) {
    const existing = await storage.getSyncRun(options.runId);
    if (!existing) {
      throw new Error(`Sync run ${options.runId} not found`);
    }
    syncRun = existing;
    await storage.updateSyncRun(syncRun.id, {
      status: "running",
      startedAt: new Date(),
    });
  } else {
    syncRun = await storage.createSyncRun({
      connectorId,
      status: "running",
      startedAt: new Date(),
    });
  }

  const config = connector.config as unknown as ApiClientConfig;
  const targetTable = getTargetTable(connector.type as ConnectorType);
  const configAny = config as unknown as Record<string, unknown>;
  const sourceIdField = (configAny.sourceIdField as string) || "id";
  const defaultSchoolId = (configAny.schoolId as string) || null;
  const maxPages = options.maxPages || 100;

  try {
    let cursor: string | undefined;
    let offset = 0;
    let page = 1;
    let hasMore = true;

    if (options.batchSize) {
      const updatedConfig = { ...(connector.config as Record<string, unknown>), pageSize: options.batchSize };
      (connector as any).config = updatedConfig;
    }

    while (hasMore && pages < maxPages) {
      pages++;

      let fetchResult;
      try {
        fetchResult = await fetchConnectorData(connector, {
          cursor,
          offset,
          page,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ type: "fetch", message: `Page ${pages}: ${msg}` });
        break;
      }

      recordsIn += fetchResult.totalFetched;

      await storeRawResponse(connectorId, fetchResult.rawResponse, pages);

      for (let i = 0; i < fetchResult.data.length; i++) {
        const rawRecord = fetchResult.data[i];
        const sourceId = extractSourceId(rawRecord, sourceIdField);

        if (!sourceId) {
          errors.push({
            type: "transform",
            message: `Record ${i} on page ${pages} has no source ID (field: ${sourceIdField})`,
            recordIndex: i,
          });
          continue;
        }

        const transformResult = applyMappings(rawRecord, mappings);

        for (const field of transformResult.unmappedFields) {
          allUnmappedFields.add(field);
        }

        if (transformResult.errors.length > 0) {
          for (const errMsg of transformResult.errors) {
            errors.push({
              type: "transform",
              message: errMsg,
              recordIndex: i,
              sourceId,
            });
          }
        }

        const schoolId =
          (transformResult.payload.school_id as string) || defaultSchoolId;

        if (options.dryRun) {
          recordsOut++;
          continue;
        }

        try {
          await upsertNormalizedRecord(targetTable, {
            sourceConnectorId: connectorId,
            sourceId,
            payload: transformResult.payload,
            schoolId,
          });
          recordsOut++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({
            type: "upsert",
            message: `Failed to upsert ${sourceId}: ${msg}`,
            sourceId,
          });
        }
      }

      await storage.updateSyncRun(syncRun.id, {
        recordsIn,
        recordsOut,
        error:
          errors.length > 0
            ? {
                count: errors.length,
                latest: errors.slice(-5).map((e) => e.message),
              }
            : undefined,
      });

      hasMore = fetchResult.hasMore;
      cursor = fetchResult.nextCursor;

      if (config.paginationType === "offset") {
        offset += fetchResult.totalFetched;
      } else if (config.paginationType === "page") {
        page++;
      }
    }

    const finalStatus = errors.some((e) => e.type === "fetch") ? "failed" : "success";

    await storage.updateSyncRun(syncRun.id, {
      status: finalStatus,
      finishedAt: new Date(),
      recordsIn,
      recordsOut,
      error:
        errors.length > 0
          ? {
              count: errors.length,
              errors: errors.slice(0, 50),
              unmappedFields: Array.from(allUnmappedFields),
            }
          : undefined,
    });

    const result: SyncResult = {
      runId: syncRun.id,
      connectorId,
      status: finalStatus as "success" | "failed",
      recordsIn,
      recordsOut,
      errors,
      unmappedFields: Array.from(allUnmappedFields),
      durationMs: Date.now() - startTime,
      pages,
    };

    console.log(
      `[sync] Connector ${connector.name} (${connectorId}): ${finalStatus} - ` +
        `${recordsIn} in, ${recordsOut} out, ${errors.length} errors, ` +
        `${pages} pages, ${result.durationMs}ms`
    );

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ type: "general", message: msg });

    await storage.updateSyncRun(syncRun.id, {
      status: "failed",
      finishedAt: new Date(),
      recordsIn,
      recordsOut,
      error: {
        count: errors.length,
        errors: errors.slice(0, 50),
        unmappedFields: Array.from(allUnmappedFields),
        fatalError: msg,
      },
    });

    return {
      runId: syncRun.id,
      connectorId,
      status: "failed",
      recordsIn,
      recordsOut,
      errors,
      unmappedFields: Array.from(allUnmappedFields),
      durationMs: Date.now() - startTime,
      pages,
    };
  }
}

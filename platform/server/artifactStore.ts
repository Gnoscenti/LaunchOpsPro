/**
 * Atlas Orchestrator — Artifact Store v1
 *
 * Persists structured agent outputs as durable artifacts.
 * Each artifact is stored as JSON in S3 with metadata tracked in the DB.
 * Artifacts survive page refreshes, session boundaries, and can be
 * retrieved for comparison, re-use, or feeding into future workflow runs.
 *
 * Architecture:
 *   Agent Output → artifactStore.save() → S3 (JSON bytes) + DB (metadata row)
 *   Retrieval   → artifactStore.get()  → DB metadata + S3 presigned URL
 *
 * Future extensions:
 *   - Artifact versioning (compare outputs across runs)
 *   - Artifact search (full-text search across stored outputs)
 *   - Artifact sharing (cross-user artifact references)
 *   - Vector embeddings for semantic retrieval
 */

import crypto from "crypto";
import { storagePut, storageGet } from "./storage";
import * as db from "./db";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ArtifactMetadata {
  executionId: number;
  stepId: number;
  agentId: string;
  artifactType: string;
  /** S3 key for the stored artifact */
  storageKey: string;
  /** Public URL for the artifact */
  url: string;
  /** Size in bytes */
  sizeBytes: number;
  /** SHA-256 hash of the content */
  contentHash: string;
  /** Timestamp */
  createdAt: number;
}

export interface SaveArtifactInput {
  executionId: number;
  stepId: number;
  agentId: string;
  label: string;
  artifactType: string;
  output: Record<string, unknown>;
  userId: number;
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Save an agent's output as a persistent artifact.
 * Stores the JSON content in S3 and logs metadata to the execution log.
 */
export async function saveArtifact(input: SaveArtifactInput): Promise<ArtifactMetadata> {
  const {
    executionId,
    stepId,
    agentId,
    label,
    artifactType,
    output,
    userId,
  } = input;

  // Serialize the output
  const content = JSON.stringify(output, null, 2);
  const contentBuffer = Buffer.from(content, "utf-8");
  const contentHash = crypto
    .createHash("sha256")
    .update(content)
    .digest("hex");

  // Build a unique, non-enumerable S3 key
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const safeAgentId = agentId.replace(/[^a-zA-Z0-9-]/g, "_");
  const storageKey = `artifacts/${userId}/${executionId}/${safeAgentId}-${timestamp}-${randomSuffix}.json`;

  try {
    // Upload to S3
    const { url } = await storagePut(storageKey, contentBuffer, "application/json");

    const metadata: ArtifactMetadata = {
      executionId,
      stepId,
      agentId,
      artifactType,
      storageKey,
      url,
      sizeBytes: contentBuffer.length,
      contentHash,
      createdAt: timestamp,
    };

    // Log the artifact creation in the execution log
    await db.appendLog({
      executionId,
      stepId,
      level: "info",
      message: `Artifact saved: ${label} (${artifactType}) — ${formatBytes(contentBuffer.length)}`,
      metadata: {
        artifactType,
        storageKey,
        url,
        contentHash: contentHash.slice(0, 16),
        sizeBytes: contentBuffer.length,
      },
    });

    return metadata;
  } catch (error) {
    // Log the failure but don't crash the execution
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await db.appendLog({
      executionId,
      stepId,
      level: "warn",
      message: `Failed to save artifact for ${label}: ${errorMsg}`,
    });

    // Return a metadata object with empty URL so the execution can continue
    return {
      executionId,
      stepId,
      agentId,
      artifactType,
      storageKey: "",
      url: "",
      sizeBytes: contentBuffer.length,
      contentHash,
      createdAt: timestamp,
    };
  }
}

/**
 * Retrieve an artifact's download URL by its storage key.
 */
export async function getArtifactUrl(storageKey: string): Promise<string | null> {
  if (!storageKey) return null;
  try {
    const { url } = await storageGet(storageKey);
    return url;
  } catch {
    return null;
  }
}

/**
 * Build an artifact summary for a completed execution.
 * Returns a list of all artifacts produced during the run.
 */
export async function listExecutionArtifacts(
  executionId: number
): Promise<Array<{ agentId: string; artifactType: string; url: string; storageKey: string }>> {
  // Query the execution logs for artifact entries
  const logs = await db.listLogs(executionId, 500);
  const artifacts: Array<{ agentId: string; artifactType: string; url: string; storageKey: string }> = [];

  for (const log of logs) {
    const meta = log.metadata as Record<string, unknown> | null;
    if (meta && meta.artifactType && meta.url) {
      artifacts.push({
        agentId: (meta.agentId as string) ?? "unknown",
        artifactType: meta.artifactType as string,
        url: meta.url as string,
        storageKey: (meta.storageKey as string) ?? "",
      });
    }
  }

  return artifacts;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

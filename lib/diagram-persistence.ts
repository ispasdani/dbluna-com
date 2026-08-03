import { ConvexError } from "convex/values";
import { convex } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DiagramData, Relationship } from "@/store/useCanvasStore";
import type { Camera } from "@/store/useEditorStore";

// The Convex-facing half of the local/cloud persistence seam. Local
// persistence is already handled by the existing Zustand `persist` +
// debounced-storage.ts — this file only covers the cloud side.

export type CloudDiagramPayload = Pick<
  DiagramData,
  "name" | "tables" | "notes" | "areas" | "relationships" | "enums" | "tableGroups" | "project"
> & { camera: Camera };

export type CloudFailureReason = "not-pro" | "unauthorized" | "network" | "unknown";

export type CloudPullResult =
  | {
      ok: true;
      data: Omit<DiagramData, "storage" | "cloudId" | "lastSyncedAt">;
      camera: Camera;
      remoteUpdatedAt: number;
    }
  | { ok: false; reason: "not-found" | CloudFailureReason };

export type CloudPushResult =
  | { ok: true; remoteUpdatedAt: number }
  | { ok: false; reason: CloudFailureReason };

export type CloudCreateResult =
  | { ok: true; cloudId: string; remoteUpdatedAt: number }
  | { ok: false; reason: CloudFailureReason };

// Classifies a thrown ConvexError by message content (matches the exact
// strings guards.ts throws) so the UI can tell "your Pro lapsed" apart from
// "Convex is unreachable" without re-implementing guard logic client-side.
// Non-ConvexError throws (network failures, or a plain Error like
// AuthRequired — Convex redacts non-ConvexError messages before they reach
// the client) fall back to a network/unknown guess.
function classifyError(err: unknown): CloudFailureReason {
  if (err instanceof ConvexError) {
    const message = typeof err.data === "string" ? err.data : String(err.message ?? "");
    if (message.includes("Upgrade to Pro")) return "not-pro";
    if (message.includes("access") || message.includes("Sign in") || message.includes("not found")) {
      return "unauthorized";
    }
    return "unknown";
  }
  if (err instanceof Error && /network|fetch|timeout|offline/i.test(err.message)) return "network";
  return "unknown";
}

function toCloudId(id: string): Id<"diagrams"> {
  return id as Id<"diagrams">;
}

export async function pullCloudDiagram(cloudId: string): Promise<CloudPullResult> {
  try {
    const doc = await convex.query(api.diagrams.get, { diagramId: toCloudId(cloudId) });
    if (!doc) return { ok: false, reason: "not-found" };
    const { camera, ...rest } = doc;
    return {
      ok: true,
      data: {
        name: rest.name,
        updatedAt: rest.updatedAt,
        tables: rest.tables,
        notes: rest.notes,
        areas: rest.areas,
        // Convex's validator uses plain v.string() for these fields (avoids
        // duplicating the full literal-union type server-side); the data
        // always originates from client pushes that already conform to the
        // narrower client type, so this cast is safe.
        relationships: rest.relationships as Relationship[],
        enums: rest.enums ?? [],
        tableGroups: rest.tableGroups ?? [],
        project: rest.project ?? null,
        // Convex never stores these — they're local view prefs, not document
        // data (see the plan's schema-alignment note). Placeholders only to
        // satisfy DiagramData's shape; the caller (use-cloud-reconciliation)
        // MUST override these three with the diagram's existing local values
        // before writing this back in, never with what's returned here.
        background: "grid",
        snapToGrid: false,
        isFocusModeEnabled: true,
      },
      camera,
      remoteUpdatedAt: rest.updatedAt,
    };
  } catch (err) {
    return { ok: false, reason: classifyError(err) };
  }
}

export async function pushCloudDiagram(
  cloudId: string,
  payload: CloudDiagramPayload
): Promise<CloudPushResult> {
  try {
    const result = await convex.mutation(api.diagrams.update, {
      diagramId: toCloudId(cloudId),
      name: payload.name,
      tables: payload.tables,
      notes: payload.notes,
      areas: payload.areas,
      relationships: payload.relationships,
      enums: payload.enums,
      tableGroups: payload.tableGroups,
      project: payload.project ?? undefined,
      camera: payload.camera,
    });
    return { ok: true, remoteUpdatedAt: result.updatedAt };
  } catch (err) {
    return { ok: false, reason: classifyError(err) };
  }
}

export async function createCloudDiagram(
  name: string,
  payload: CloudDiagramPayload
): Promise<CloudCreateResult> {
  try {
    const result = await convex.mutation(api.diagrams.create, {
      name,
      initialData: {
        tables: payload.tables,
        relationships: payload.relationships,
        areas: payload.areas,
        notes: payload.notes,
        enums: payload.enums,
        tableGroups: payload.tableGroups,
        project: payload.project ?? undefined,
        camera: payload.camera,
      },
    });
    return { ok: true, cloudId: result.diagramId, remoteUpdatedAt: result.updatedAt };
  } catch (err) {
    return { ok: false, reason: classifyError(err) };
  }
}

export async function softDeleteCloudDiagram(cloudId: string): Promise<{ ok: boolean }> {
  try {
    await convex.mutation(api.diagrams.deleteDiagram, { diagramId: toCloudId(cloudId) });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function listCloudDiagrams(): Promise<Array<{ cloudId: string; name: string; updatedAt: number }>> {
  try {
    const docs = await convex.query(api.diagrams.list, {});
    return docs
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map((d) => ({ cloudId: d._id, name: d.name, updatedAt: d.updatedAt }));
  } catch {
    return [];
  }
}

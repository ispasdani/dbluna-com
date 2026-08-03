import { ConvexReactClient } from "convex/react";

// Shared singleton so plain async helpers (lib/diagram-persistence.ts) can call
// convex.query(...)/convex.mutation(...) directly outside of React, without
// threading a client through every call site.
export const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

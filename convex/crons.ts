import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "clean up stale diagram presence",
  { minutes: 10 },
  internal.diagramPresence.cleanupStale
);

export default crons;

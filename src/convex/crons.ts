import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Apply daily interest to bank accounts (every 24 hours)
crons.interval(
  "apply daily interest",
  { hours: 24 },
  internal.bank.applyDailyInterestInternal,
  {}
);

// Apply market events (expire old events)
crons.interval(
  "apply market events",
  { hours: 1 },
  internal.realEstate.applyMarketEventsInternal,
  {}
);

export default crons;
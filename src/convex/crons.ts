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

// Apply real estate market events (every 6 hours)
crons.interval(
  "apply market events",
  { hours: 6 },
  internal.realEstate.applyMarketEvents,
  {}
);

export default crons;
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run interest accrual every 24 hours
crons.interval("apply bank interest", { hours: 24 }, internal.bank.applyDailyInterestInternal, {});

// Run market events application every 6 hours
crons.interval("apply real estate market events", { hours: 6 }, internal.realEstate.applyMarketEvents, {});

export default crons;
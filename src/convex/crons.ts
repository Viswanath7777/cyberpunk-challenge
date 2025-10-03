import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run interest accrual every 24 hours
crons.interval("apply bank interest", { hours: 24 }, internal.bank.applyDailyInterestInternal, {});

export default crons;

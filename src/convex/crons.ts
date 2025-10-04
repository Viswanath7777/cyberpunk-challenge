import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run bank interest every 24 hours
crons.interval("apply bank interest", { hours: 24 }, internal.bank.applyDailyInterestInternal, {});

// Run real estate market events every 8 hours
crons.interval("real estate market events", { hours: 8 }, internal.realEstate.applyMarketEvents, {});

export default crons;
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { BET_EVENT_STATUS } from "./schema";

// Admin: Create a new betting event
export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    // Change options to include odds
    options: v.array(v.object({ label: v.string(), odds: v.number() })),
    durationHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    // Allow any authenticated user to create events (remove admin-only restriction)
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (args.options.length < 2) {
      throw new Error("Provide at least two options");
    }
    // Validate odds > 0
    for (const opt of args.options) {
      if (!(opt.odds > 0)) {
        throw new Error(`Invalid odds for "${opt.label}". Must be > 0`);
      }
    }

    const closesAt = args.durationHours
      ? Date.now() + args.durationHours * 60 * 60 * 1000
      : undefined;

    const eventId = await ctx.db.insert("bettingEvents", {
      title: args.title,
      description: args.description,
      options: args.options,
      status: BET_EVENT_STATUS.OPEN,
      createdBy: user._id,
      closesAt,
    });
    return eventId;
  },
});

// Public: List open events
export const listOpenEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("bettingEvents")
      .withIndex("by_status", (q) => q.eq("status", BET_EVENT_STATUS.OPEN))
      .collect();
  },
});

// Public: Get current user's bets
export const getMyBets = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("bets")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Public: Place a bet (one bet per event per user)
export const placeBet = mutation({
  args: {
    eventId: v.id("bettingEvents"),
    option: v.string(), // label
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    if (args.amount <= 0) {
      throw new Error("Bet amount must be greater than 0");
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    if (event.status !== BET_EVENT_STATUS.OPEN) {
      throw new Error("Event is not open for betting");
    }
    if (event.closesAt && Date.now() > event.closesAt) {
      throw new Error("Event betting period has ended");
    }
    const opt = event.options.find((o) => o.label === args.option);
    if (!opt) {
      throw new Error("Invalid option");
    }

    // Enforce single bet per event per user
    const existing = await ctx.db
      .query("bets")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id),
      )
      .first();
    if (existing) {
      throw new Error("You already placed a bet on this event");
    }

    const credits = user.credits ?? 1000;
    if (credits < args.amount) {
      throw new Error("Insufficient credits");
    }

    // Deduct credits
    await ctx.db.patch(user._id, {
      credits: credits - args.amount,
    });

    const betId = await ctx.db.insert("bets", {
      eventId: args.eventId,
      userId: user._id,
      option: args.option, // store label
      amount: args.amount,
      placedAt: Date.now(),
    });

    return betId;
  },
});

// Admin or Creator: Close an event (stop betting)
export const closeEvent = mutation({
  args: { eventId: v.id("bettingEvents") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const isAdmin = user.role === "admin";
    const isCreator = event.createdBy === user._id;
    if (!isAdmin && !isCreator) {
      throw new Error("Only the event creator or an admin can close events");
    }

    if (event.status !== BET_EVENT_STATUS.OPEN) return { success: true };
    await ctx.db.patch(args.eventId, { status: BET_EVENT_STATUS.CLOSED });
    return { success: true };
  },
});

// Admin or Creator: Resolve an event, pay out winners by fixed odds
export const resolveEvent = mutation({
  args: {
    eventId: v.id("bettingEvents"),
    winningOption: v.string(), // label
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const isAdmin = user.role === "admin";
    const isCreator = event.createdBy === user._id;
    if (!isAdmin && !isCreator) {
      throw new Error("Only the event creator or an admin can resolve events");
    }

    const winning = event.options.find((o) => o.label === args.winningOption);
    if (!winning) {
      throw new Error("Invalid winning option");
    }
    if (event.status === BET_EVENT_STATUS.RESOLVED) {
      return { success: true };
    }

    // Collect all winning bets for this event
    const allBets = await ctx.db
      .query("bets")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const winners = allBets.filter((b) => b.option === args.winningOption);

    // Payout = amount * odds (floored)
    for (const bet of winners) {
      const u = await ctx.db.get(bet.userId);
      if (!u) continue;
      const payout = Math.floor(bet.amount * winning.odds);
      const currentCredits = u.credits ?? 1000;
      await ctx.db.patch(u._id, { credits: currentCredits + payout });
    }

    // Mark event resolved
    await ctx.db.patch(args.eventId, {
      status: BET_EVENT_STATUS.RESOLVED,
      resolvedOption: args.winningOption,
    });

    return {
      success: true,
      winners: winners.length,
    };
  },
});

// Admin: List all events
export const listAllEvents = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") {
      throw new Error("Only admins can view all events");
    }
    return await ctx.db.query("bettingEvents").collect();
  },
});

// Public: List events created by current user
export const listMyEvents = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("bettingEvents")
      .withIndex("by_created_by", (q) => q.eq("createdBy", user._id))
      .collect();
  },
});

// Add: Allow a user to cancel their own bet on an open event and refund credits
export const cancelBet = mutation({
  args: {
    eventId: v.id("bettingEvents"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    if (event.status !== BET_EVENT_STATUS.OPEN) {
      throw new Error("Cannot cancel; event is not open");
    }
    if (event.closesAt && Date.now() > event.closesAt) {
      throw new Error("Cannot cancel; betting period has ended");
    }

    // Find the user's bet for this event
    const bet = await ctx.db
      .query("bets")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id),
      )
      .first();

    if (!bet) {
      throw new Error("No bet to cancel for this event");
    }

    // Refund credits
    const currentCredits = user.credits ?? 1000;
    await ctx.db.patch(user._id, {
      credits: currentCredits + bet.amount,
    });

    // Delete the bet
    await ctx.db.delete(bet._id);

    return { success: true };
  },
});

// Add: Count bets for a list of events using the by_event index
export const countBetsForEvents = query({
  args: { eventIds: v.array(v.id("bettingEvents")) },
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};
    for (const eventId of args.eventIds) {
      const bets = await ctx.db
        .query("bets")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect();
      counts[eventId] = bets.length;
    }
    return counts;
  },
});
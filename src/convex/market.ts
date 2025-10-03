import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

import { Id } from "./_generated/dataModel";

type MarketDoc = {
  _id: Id<"realEstateMarket">;
  _creationTime: number;
  currentValue: number;
  lastUpdated: number; // ms
  history: Array<{ t: number; v: number }>;
  events: Array<{ t: number; type: string; impact: number; description: string }>;
};

const clampHistory = (arr: Array<{ t: number; v: number }>, max = 720): Array<{ t: number; v: number }> => {
  if (arr.length <= max) return arr;
  return arr.slice(arr.length - max);
};

const clampEvents = (
  arr: Array<{ t: number; type: string; impact: number; description: string }>,
  max = 200
): Array<{ t: number; type: string; impact: number; description: string }> => {
  if (arr.length <= max) return arr;
  return arr.slice(arr.length - max);
};

export const getMarket = query({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("realEstateMarket").first();
    return existing as MarketDoc | null;
  },
});

export const syncMarket = mutation({
  args: {},
  handler: async (ctx) => {
    let doc = await ctx.db.query("realEstateMarket").first();

    const now = Date.now();

    if (!doc) {
      const initialValue = 1000; // base index
      const _id = await ctx.db.insert("realEstateMarket", {
        currentValue: initialValue,
        lastUpdated: now,
        history: [{ t: now, v: initialValue }],
        events: [],
      });
      doc = (await ctx.db.get(_id)) as MarketDoc | null;
    }

    if (!doc) {
      throw new Error("Failed to initialize market");
    }

    // Determine how many minutes have passed since last update
    const minutesElapsed = Math.floor((now - doc.lastUpdated) / 60000);
    if (minutesElapsed <= 0) {
      // Nothing to do, already up to date
      return { updated: false, market: doc };
    }

    // Parameters for a gentle upward drift with noise
    const driftPerMinute = 0.0002; // ~0.02%/min drift
    const noiseScale = 0.0035; // random variation per minute

    // Event chance & impact
    const eventChancePerMinute = 0.01; // 1% chance per minute for an event
    let value = doc.currentValue;
    let history = [...doc.history];
    let events = [...doc.events];
    let lastT = doc.lastUpdated;

    for (let i = 1; i <= minutesElapsed; i++) {
      const t = doc.lastUpdated + i * 60000;
      // Random noise around zero
      const noise = (Math.random() - 0.5) * 2 * noiseScale;
      const growth = driftPerMinute + noise;
      value = Math.max(100, value * (1 + growth)); // prevent going below a floor

      // Occasional random events
      if (Math.random() < eventChancePerMinute) {
        // 50/50 boom/bust, or neutral news with smaller impact
        const r = Math.random();
        let type: "boom" | "bust" | "news";
        let impact: number;
        if (r < 0.45) {
          type = "boom";
          impact = 0.02 + Math.random() * 0.08; // +2% to +10%
          value = value * (1 + impact);
        } else if (r < 0.9) {
          type = "bust";
          impact = 0.02 + Math.random() * 0.08; // -2% to -10%
          value = value * (1 - impact);
        } else {
          type = "news";
          impact = 0.005 + Math.random() * 0.01; // +/-0.5% to 1.5%
          // randomly up or down for news
          value = value * (1 + (Math.random() < 0.5 ? -impact : impact));
        }

        const description =
          type === "boom"
            ? "Development surge boosts property demand"
            : type === "bust"
            ? "Regulatory uncertainty cools the market"
            : "Mixed signals from local market indicators";

        events.push({ t, type: type as "boom" | "bust" | "news", impact, description });
        events = clampEvents(events);
      }

      history.push({ t, v: Math.round(value) });
      lastT = t;
      history = clampHistory(history);
    }

    // Patch the document
    await ctx.db.patch((doc as any)._id, {
      currentValue: Math.round(value),
      lastUpdated: lastT,
      history,
      events,
    });

    const updated = (await ctx.db.get((doc as any)._id)) as MarketDoc;
    return { updated: true, market: updated };
  },
});

export const getHolding = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();
    if (!user) return null;

    const holding = await ctx.db
      .query("realEstateHoldings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique()
      .catch(() => null);

    return holding ?? null;
  },
});

export const buyProperty = mutation({
  args: {
    amount: v.number(), // credits to spend
  },
  handler: async (ctx, args) => {
    const { amount } = args;
    if (!(amount > 0)) throw new Error("Amount must be greater than 0");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();
    if (!user) throw new Error("User not found");

    const market = await ctx.db.query("realEstateMarket").first();
    if (!market) throw new Error("Market not initialized");
    const price = market.currentValue;
    if (price <= 0) throw new Error("Invalid market price");

    const credits = user.credits ?? 0;
    if (credits < amount) throw new Error("Insufficient credits");

    const unitsToAdd = amount / price;

    // Deduct credits
    await ctx.db.patch(user._id, { credits: credits - Math.floor(amount) });

    // Upsert holding
    const now = Date.now();
    const existing = await ctx.db
      .query("realEstateHoldings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique()
      .catch(() => null);

    if (!existing) {
      await ctx.db.insert("realEstateHoldings", {
        userId: user._id,
        units: unitsToAdd,
        totalCost: amount,
        lastUpdated: now,
      });
    } else {
      await ctx.db.patch(existing._id, {
        units: existing.units + unitsToAdd,
        totalCost: existing.totalCost + amount,
        lastUpdated: now,
      });
    }

    return { ok: true };
  },
});

export const sellProperty = mutation({
  args: {
    units: v.number(), // units to sell
  },
  handler: async (ctx, args) => {
    const { units } = args;
    if (!(units > 0)) throw new Error("Units must be greater than 0");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();
    if (!user) throw new Error("User not found");

    const holding = await ctx.db
      .query("realEstateHoldings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique()
      .catch(() => null);

    if (!holding || holding.units <= 0) throw new Error("No holdings to sell");
    if (units > holding.units) throw new Error("Cannot sell more than you hold");

    const market = await ctx.db.query("realEstateMarket").first();
    if (!market) throw new Error("Market not initialized");
    const price = market.currentValue;
    if (price <= 0) throw new Error("Invalid market price");

    const proceeds = Math.floor(units * price);

    // Credit proceeds
    const credits = user.credits ?? 0;
    await ctx.db.patch(user._id, { credits: credits + proceeds });

    // Adjust holding
    const remainingUnits = holding.units - units;
    if (remainingUnits <= 1e-9) {
      // Close position
      await ctx.db.delete(holding._id);
    } else {
      // Adjust totalCost proportionally to remaining units
      const newTotalCost = holding.totalCost * (remainingUnits / holding.units);
      await ctx.db.patch(holding._id, {
        units: remainingUnits,
        totalCost: newTotalCost,
        lastUpdated: Date.now(),
      });
    }

    return { ok: true, proceeds };
  },
});
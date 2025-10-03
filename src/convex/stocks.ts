import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// List all stock tickers
export const listTickers = query({
  args: {},
  handler: async (ctx) => {
    const tickers = await ctx.db.query("stockTickers").collect();
    return tickers.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      price: t.price,
      history: t.history.slice(-100), // Last 100 points
    }));
  },
});

// Get user's stock holdings
export const getHoldings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const holdings = await ctx.db
      .query("stockHoldings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const enriched = await Promise.all(
      holdings.map(async (h) => {
        const ticker = await ctx.db
          .query("stockTickers")
          .withIndex("by_symbol", (q) => q.eq("symbol", h.symbol))
          .first();

        const currentPrice = ticker?.price ?? 0;
        const marketValue = h.shares * currentPrice;
        const totalCost = h.shares * h.avgCost;
        const pnl = marketValue - totalCost;

        return {
          symbol: h.symbol,
          shares: h.shares,
          avgCost: h.avgCost,
          currentPrice,
          marketValue,
          pnl,
        };
      })
    );

    return enriched;
  },
});

// Sync market prices (random walk simulation)
export const syncMarket = mutation({
  args: {},
  handler: async (ctx) => {
    const tickers = await ctx.db.query("stockTickers").collect();
    const now = Date.now();

    for (const ticker of tickers) {
      // Geometric Brownian motion: dS = mu*S*dt + sigma*S*dW
      const mu = 0.0001; // drift
      const sigma = 0.02; // volatility
      const dt = 1;
      const dW = (Math.random() - 0.5) * 2; // random shock

      let newPrice = ticker.price * (1 + mu * dt + sigma * Math.sqrt(dt) * dW);
      newPrice = Math.max(0.1, newPrice); // floor at 0.1

      const newHistory = [...ticker.history, { t: now, v: newPrice }];
      // Keep last 500 points
      const trimmedHistory = newHistory.slice(-500);

      await ctx.db.patch(ticker._id, {
        price: newPrice,
        history: trimmedHistory,
      });
    }

    return { success: true };
  },
});

// Buy stock
export const buy = mutation({
  args: {
    symbol: v.string(),
    shares: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (args.shares <= 0) {
      throw new Error("Shares must be positive");
    }

    const ticker = await ctx.db
      .query("stockTickers")
      .withIndex("by_symbol", (q) => q.eq("symbol", args.symbol))
      .first();

    if (!ticker) {
      throw new Error("Stock not found");
    }

    const cost = args.shares * ticker.price;
    const currentCredits = user.credits ?? 0;

    if (currentCredits < cost) {
      throw new Error("Insufficient credits");
    }

    // Deduct credits
    await ctx.db.patch(user._id, {
      credits: currentCredits - cost,
    });

    // Update or create holding
    const holding = await ctx.db
      .query("stockHoldings")
      .withIndex("by_user_and_symbol", (q) =>
        q.eq("userId", user._id).eq("symbol", args.symbol)
      )
      .first();

    if (holding) {
      const newShares = holding.shares + args.shares;
      const newAvgCost = (holding.shares * holding.avgCost + cost) / newShares;
      await ctx.db.patch(holding._id, {
        shares: newShares,
        avgCost: newAvgCost,
      });
    } else {
      await ctx.db.insert("stockHoldings", {
        userId: user._id,
        symbol: args.symbol,
        shares: args.shares,
        avgCost: ticker.price,
      });
    }

    return { success: true };
  },
});

// Sell stock
export const sell = mutation({
  args: {
    symbol: v.string(),
    shares: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (args.shares <= 0) {
      throw new Error("Shares must be positive");
    }

    const holding = await ctx.db
      .query("stockHoldings")
      .withIndex("by_user_and_symbol", (q) =>
        q.eq("userId", user._id).eq("symbol", args.symbol)
      )
      .first();

    if (!holding || holding.shares < args.shares) {
      throw new Error("Insufficient shares");
    }

    const ticker = await ctx.db
      .query("stockTickers")
      .withIndex("by_symbol", (q) => q.eq("symbol", args.symbol))
      .first();

    if (!ticker) {
      throw new Error("Stock not found");
    }

    const proceeds = args.shares * ticker.price;

    // Credit user
    const currentCredits = user.credits ?? 0;
    await ctx.db.patch(user._id, {
      credits: currentCredits + proceeds,
    });

    // Update holding
    const remainingShares = holding.shares - args.shares;
    if (remainingShares === 0) {
      await ctx.db.delete(holding._id);
    } else {
      await ctx.db.patch(holding._id, {
        shares: remainingShares,
      });
    }

    return { success: true };
  },
});

// Seed initial tickers
export const seedTickers = mutation({
  args: {},
  handler: async (ctx) => {
    const symbols = [
      { symbol: "CYBR", name: "CyberCorp" },
      { symbol: "NEON", name: "Neon Industries" },
      { symbol: "GRID", name: "GridTech" },
      { symbol: "BYTE", name: "ByteSystems" },
      { symbol: "SYNTH", name: "SynthWare" },
    ];

    for (const { symbol, name } of symbols) {
      const existing = await ctx.db
        .query("stockTickers")
        .withIndex("by_symbol", (q) => q.eq("symbol", symbol))
        .first();

      if (!existing) {
        const basePrice = 50 + Math.random() * 150; // 50-200
        const history = [];
        const now = Date.now();

        // Generate 50 historical points
        let price = basePrice;
        for (let i = 50; i >= 0; i--) {
          const t = now - i * 3600000; // hourly
          history.push({ t, v: price });
          price *= 1 + (Math.random() - 0.5) * 0.05;
          price = Math.max(0.1, price);
        }

        await ctx.db.insert("stockTickers", {
          symbol,
          name,
          price: history[history.length - 1].v,
          history,
        });
      }
    }

    return { success: true };
  },
});

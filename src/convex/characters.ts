import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Initialize character for new user
export const initializeCharacter = mutation({
  args: {
    characterName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Update user with character data
    await ctx.db.patch(user._id, {
      characterName: args.characterName,
      level: 1,
      xp: 0,
      weeklyXp: 0,
      badges: [],
      credits: 1000, // Starting currency
    });

    return { success: true };
  },
});

// Get character data
export const getCharacter = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      name: user.name,
      characterName: user.characterName,
      level: user.level || 1,
      xp: user.xp || 0,
      weeklyXp: user.weeklyXp || 0,
      badges: user.badges || [],
      credits: user.credits ?? 1000,
    };
  },
});

// Add XP to user (called when submission is approved)
export const addXp = mutation({
  args: {
    userId: v.id("users"),
    xpAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const currentXp = user.xp || 0;
    const currentWeeklyXp = user.weeklyXp || 0;
    const currentLevel = user.level || 1;

    const newXp = currentXp + args.xpAmount;
    const newWeeklyXp = currentWeeklyXp + args.xpAmount;
    const newLevel = Math.floor(newXp / 100) + 1;

    await ctx.db.patch(args.userId, {
      xp: newXp,
      weeklyXp: newWeeklyXp,
      level: newLevel,
    });

    return {
      leveledUp: newLevel > currentLevel,
      newLevel,
      newXp,
    };
  },
});

// Get leaderboard
export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("characterName"), undefined))
      .collect();

    return users
      .map((user) => ({
        _id: user._id,
        name: user.name || "Anonymous",
        characterName: user.characterName || "Unknown",
        credits: user.credits ?? 0,
      }))
      .sort((a, b) => b.credits - a.credits);
  },
});

// Reset weekly XP (to be called weekly)
export const resetWeeklyXp = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("characterName"), undefined))
      .collect();

    // Remove weekly reset of XP and badges — only stipend remains
    for (const user of users) {
      const currentCredits = user.credits ?? 0;
      await ctx.db.patch(user._id, {
        credits: currentCredits + 200,
      });
    }

    return { success: true, stipendGiven: users.length };
  },
});
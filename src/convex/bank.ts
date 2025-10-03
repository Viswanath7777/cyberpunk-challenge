import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Get user's bank account
export const getBankAccount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db
      .query("bankAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return account ? { balance: account.balance } : { balance: 0 };
  },
});

// Deposit credits into bank
export const deposit = mutation({
  args: {
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const currentCredits = user.credits ?? 0;
    if (currentCredits < args.amount) {
      throw new Error("Insufficient credits");
    }

    // Deduct from user credits
    await ctx.db.patch(user._id, {
      credits: currentCredits - args.amount,
    });

    // Add to bank account
    const account = await ctx.db
      .query("bankAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (account) {
      await ctx.db.patch(account._id, {
        balance: account.balance + args.amount,
      });
    } else {
      await ctx.db.insert("bankAccounts", {
        userId: user._id,
        balance: args.amount,
      });
    }

    return { success: true };
  },
});

// Withdraw credits from bank
export const withdraw = mutation({
  args: {
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const account = await ctx.db
      .query("bankAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const bankBalance = account?.balance ?? 0;
    if (bankBalance < args.amount) {
      throw new Error("Insufficient bank balance");
    }

    // Deduct from bank
    if (account) {
      await ctx.db.patch(account._id, {
        balance: bankBalance - args.amount,
      });
    }

    // Add to user credits
    const currentCredits = user.credits ?? 0;
    await ctx.db.patch(user._id, {
      credits: currentCredits + args.amount,
    });

    return { success: true };
  },
});

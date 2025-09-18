import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { LOAN_STATUS } from "./schema";

// Borrower (must have 0 credits): create a loan request
export const createLoanRequest = mutation({
  args: {
    amount: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");

    const myCredits = me.credits ?? 0;
    if (myCredits > 0) {
      throw new Error("Loan requests are allowed only when you have 0 credits");
    }
    if (!(args.amount > 0)) {
      throw new Error("Amount must be greater than 0");
    }

    // Prevent multiple pending requests for same borrower
    const existing = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", me._id))
      .collect();
    const hasPending = existing.some((l) => l.status === LOAN_STATUS.PENDING);
    if (hasPending) {
      throw new Error("You already have a pending loan request");
    }

    const loanId = await ctx.db.insert("loans", {
      borrowerId: me._id,
      amount: Math.floor(args.amount),
      status: LOAN_STATUS.PENDING,
      note: args.note,
      requestedAt: Date.now(),
    });
    return loanId;
  },
});

// Public: list pending loan requests not made by me (to fund)
export const listLoanRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const pending = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", LOAN_STATUS.PENDING))
      .collect();

    // Exclude my own requests
    return pending.filter((l) => l.borrowerId !== me._id);
  },
});

// Borrower: list my loan requests
export const myLoanRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    return await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", me._id))
      .collect();
  },
});

// Lender: fund a pending request (with consent)
export const fundLoan = mutation({
  args: {
    loanId: v.id("loans"),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");

    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");
    if (loan.status !== LOAN_STATUS.PENDING) {
      throw new Error("Loan is not pending");
    }
    if (loan.borrowerId === me._id) {
      throw new Error("You cannot fund your own loan");
    }

    const lender = me;
    const borrower = await ctx.db.get(loan.borrowerId);
    if (!borrower) throw new Error("Borrower not found");

    const lenderCredits = lender.credits ?? 0;
    if (lenderCredits < loan.amount) {
      throw new Error("Insufficient credits to fund this loan");
    }

    // Transfer credits
    await ctx.db.patch(lender._id, { credits: lenderCredits - loan.amount });
    const borrowerCredits = borrower.credits ?? 0;
    await ctx.db.patch(borrower._id, { credits: borrowerCredits + loan.amount });

    // Mark as accepted
    await ctx.db.patch(args.loanId, {
      status: LOAN_STATUS.ACCEPTED,
      lenderId: lender._id,
      fulfilledAt: Date.now(),
    });

    return { success: true };
  },
});

// Borrower: cancel a pending request
export const cancelLoanRequest = mutation({
  args: {
    loanId: v.id("loans"),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");

    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");
    if (loan.borrowerId !== me._id) {
      throw new Error("You can only cancel your own loan request");
    }
    if (loan.status !== LOAN_STATUS.PENDING) {
      throw new Error("Only pending requests can be canceled");
    }

    await ctx.db.patch(args.loanId, { status: LOAN_STATUS.CANCELED });
    return { success: true };
  },
});

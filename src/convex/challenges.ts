import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { CHALLENGE_STATUS, SUBMISSION_STATUS } from "./schema";
import { api } from "./_generated/api";

// Create a new challenge (admin only)
export const createChallenge = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    xpReward: v.number(),
    type: v.union(v.literal("daily"), v.literal("weekly"), v.literal("one-time")),
    durationHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    // Allow any authenticated user to create challenges
    if (!user) {
      throw new Error("Not authenticated");
    }

    const expiresAt = args.durationHours 
      ? Date.now() + (args.durationHours * 60 * 60 * 1000)
      : undefined;

    const challengeId = await ctx.db.insert("challenges", {
      title: args.title,
      description: args.description,
      xpReward: args.xpReward,
      type: args.type,
      status: CHALLENGE_STATUS.ACTIVE,
      createdBy: user._id,
      expiresAt,
    });

    return challengeId;
  },
});

// Get all active challenges
export const getActiveChallenges = query({
  args: {},
  handler: async (ctx) => {
    const challenges = await ctx.db
      .query("challenges")
      .withIndex("by_status", (q) => q.eq("status", CHALLENGE_STATUS.ACTIVE))
      .collect();

    const user = await getCurrentUser(ctx);
    if (!user) return challenges;

    // Check if user has already submitted for each challenge
    const challengesWithSubmissions = await Promise.all(
      challenges.map(async (challenge) => {
        const submission = await ctx.db
          .query("submissions")
          .withIndex("by_challenge_and_user", (q) => 
            q.eq("challengeId", challenge._id).eq("userId", user._id)
          )
          .first();

        return {
          ...challenge,
          userSubmission: submission,
        };
      })
    );

    return challengesWithSubmissions;
  },
});

// Get all challenges (admin view)
export const getAllChallenges = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") {
      throw new Error("Only admins can view all challenges");
    }

    return await ctx.db.query("challenges").collect();
  },
});

// Submit proof for a challenge
export const submitProof = mutation({
  args: {
    challengeId: v.id("challenges"),
    proofText: v.optional(v.string()),
    proofImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check if challenge exists and is active
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge || challenge.status !== CHALLENGE_STATUS.ACTIVE) {
      throw new Error("Challenge not found or not active");
    }

    // Check if user already submitted
    const existingSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_challenge_and_user", (q) => 
        q.eq("challengeId", args.challengeId).eq("userId", user._id)
      )
      .first();

    if (existingSubmission) {
      throw new Error("You have already submitted for this challenge");
    }

    const submissionId = await ctx.db.insert("submissions", {
      challengeId: args.challengeId,
      userId: user._id,
      proofText: args.proofText,
      proofImageUrl: args.proofImageUrl,
      status: SUBMISSION_STATUS.PENDING,
      submittedAt: Date.now(),
    });

    return submissionId;
  },
});

// Get pending submissions (admin only)
export const getPendingSubmissions = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") {
      throw new Error("Only admins can view submissions");
    }

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", SUBMISSION_STATUS.PENDING))
      .collect();

    // Get challenge and user data for each submission
    const submissionsWithData = await Promise.all(
      submissions.map(async (submission) => {
        const challenge = await ctx.db.get(submission.challengeId);
        const submitter = await ctx.db.get(submission.userId);
        
        return {
          ...submission,
          challenge,
          submitter,
        };
      })
    );

    return submissionsWithData;
  },
});

// Approve or reject submission (admin only)
export const reviewSubmission = mutation({
  args: {
    submissionId: v.id("submissions"),
    approved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") {
      throw new Error("Only admins can review submissions");
    }

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    const newStatus = args.approved ? SUBMISSION_STATUS.APPROVED : SUBMISSION_STATUS.REJECTED;

    await ctx.db.patch(args.submissionId, {
      status: newStatus,
      reviewedAt: Date.now(),
      reviewedBy: user._id,
    });

    // If approved, award CREDITS to user (using xpReward as credit amount)
    if (args.approved) {
      const challenge = await ctx.db.get(submission.challengeId);
      if (challenge) {
        const targetUser = await ctx.db.get(submission.userId);
        if (targetUser) {
          const currentCredits = targetUser.credits ?? 0;
          const creditReward = Math.floor(challenge.xpReward) || 0;
          await ctx.db.patch(targetUser._id, { credits: currentCredits + creditReward });
        }
      }
    }

    return { success: true };
  },
});

// New: list challenges I created
export const listMyChallenges = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("challenges")
      .withIndex("by_created_by", (q) => q.eq("createdBy", user._id))
      .collect();
  },
});

// New: creator/admin can view submissions for a challenge
export const getSubmissionsForChallenge = query({
  args: {
    // Make challengeId optional to avoid validation errors when not selected
    challengeId: v.optional(v.id("challenges")),
  },
  handler: async (ctx, args) => {
    // If no challenge selected, return empty list
    if (!args.challengeId) {
      return [];
    }
    // Narrow optional arg to a definite Id for TypeScript
    const challengeId = args.challengeId;

    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const challenge = await ctx.db.get(challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    const isCreator = challenge.createdBy === user._id;
    const isAdmin = user.role === "admin";
    if (!isCreator && !isAdmin) {
      throw new Error("Only the creator or an admin can view submissions for this challenge");
    }

    const subs = await ctx.db
      .query("submissions")
      .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
      .collect();

    const withSubmitters = await Promise.all(
      subs.map(async (s) => {
        const submitter = await ctx.db.get(s.userId);
        return {
          ...s,
          submitter: submitter
            ? { _id: submitter._id, name: submitter.name ?? "Anonymous", characterName: submitter.characterName ?? "Unknown" }
            : null,
        };
      })
    );

    return withSubmitters;
  },
});
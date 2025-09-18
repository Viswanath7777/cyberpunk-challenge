import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// Challenge status enum
export const CHALLENGE_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  EXPIRED: "expired",
} as const;

export const challengeStatusValidator = v.union(
  v.literal(CHALLENGE_STATUS.ACTIVE),
  v.literal(CHALLENGE_STATUS.COMPLETED),
  v.literal(CHALLENGE_STATUS.EXPIRED),
);

// Submission status enum
export const SUBMISSION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const submissionStatusValidator = v.union(
  v.literal(SUBMISSION_STATUS.PENDING),
  v.literal(SUBMISSION_STATUS.APPROVED),
  v.literal(SUBMISSION_STATUS.REJECTED),
);

export const BET_EVENT_STATUS = {
  OPEN: "open",
  CLOSED: "closed",
  RESOLVED: "resolved",
} as const;

export const betEventStatusValidator = v.union(
  v.literal(BET_EVENT_STATUS.OPEN),
  v.literal(BET_EVENT_STATUS.CLOSED),
  v.literal(BET_EVENT_STATUS.RESOLVED),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      
      // Character data
      characterName: v.optional(v.string()),
      level: v.optional(v.number()),
      xp: v.optional(v.number()),
      weeklyXp: v.optional(v.number()), // XP earned this week for badges
      badges: v.optional(v.array(v.string())), // Array of badge names
      credits: v.optional(v.number()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Challenges table
    challenges: defineTable({
      title: v.string(),
      description: v.string(),
      xpReward: v.number(),
      type: v.union(v.literal("daily"), v.literal("weekly")),
      status: challengeStatusValidator,
      createdBy: v.id("users"), // Admin who created it
      expiresAt: v.optional(v.number()), // Timestamp when challenge expires
    }).index("by_status", ["status"])
      .index("by_type", ["type"])
      .index("by_created_by", ["createdBy"]),

    // Challenge submissions table
    submissions: defineTable({
      challengeId: v.id("challenges"),
      userId: v.id("users"),
      proofText: v.optional(v.string()),
      proofImageUrl: v.optional(v.string()),
      status: submissionStatusValidator,
      submittedAt: v.number(),
      reviewedAt: v.optional(v.number()),
      reviewedBy: v.optional(v.id("users")), // Admin who reviewed
    }).index("by_challenge", ["challengeId"])
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_challenge_and_user", ["challengeId", "userId"]),

    // Betting events table
    bettingEvents: defineTable({
      title: v.string(),
      description: v.optional(v.string()),
      options: v.array(v.string()),
      status: betEventStatusValidator,
      createdBy: v.id("users"),
      closesAt: v.optional(v.number()),
      resolvedOption: v.optional(v.string()),
    })
      .index("by_status", ["status"])
      .index("by_created_by", ["createdBy"]),

    // Bets table
    bets: defineTable({
      eventId: v.id("bettingEvents"),
      userId: v.id("users"),
      option: v.string(),
      amount: v.number(),
      placedAt: v.number(),
    })
      .index("by_event", ["eventId"])
      .index("by_user", ["userId"])
      .index("by_event_and_user", ["eventId", "userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
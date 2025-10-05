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

export const LOAN_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELED: "canceled",
} as const;

export const loanStatusValidator = v.union(
  v.literal(LOAN_STATUS.PENDING),
  v.literal(LOAN_STATUS.ACCEPTED),
  v.literal(LOAN_STATUS.REJECTED),
  v.literal(LOAN_STATUS.CANCELED),
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
      type: v.union(v.literal("daily"), v.literal("weekly"), v.literal("one-time")),
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
      // Change options to include fixed odds per option
      options: v.array(v.object({ label: v.string(), odds: v.number() })),
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

    // Loans table
    loans: defineTable({
      borrowerId: v.id("users"),
      lenderId: v.optional(v.id("users")),
      amount: v.number(),
      status: loanStatusValidator,
      note: v.optional(v.string()),
      requestedAt: v.number(),
      fulfilledAt: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_borrower", ["borrowerId"])
      .index("by_lender", ["lenderId"]),

    // Casino games table
    casinoGames: defineTable({
      userId: v.id("users"),
      gameType: v.union(v.literal("blackjack"), v.literal("slots"), v.literal("highlow"), v.literal("roulette"), v.literal("horseRacing")),
      betAmount: v.number(),
      payout: v.number(),
      status: v.union(v.literal("in_progress"), v.literal("completed")),
      gameData: v.any(),
      result: v.optional(v.string()),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_user_and_status", ["userId", "status"]),

    // Multiplayer High-Low games table
    multiplayerHighLow: defineTable({
      player1Id: v.id("users"),
      player2Id: v.optional(v.id("users")),
      betAmount: v.number(),
      status: v.union(
        v.literal("waiting"),
        v.literal("in_progress"),
        v.literal("completed")
      ),
      currentTurn: v.optional(v.union(v.literal("player1"), v.literal("player2"))),
      deck: v.array(v.object({ rank: v.string(), suit: v.string() })),
      currentCard: v.object({ rank: v.string(), suit: v.string() }),
      player1Data: v.object({
        streak: v.number(),
        multiplier: v.number(),
        cashedOut: v.boolean(),
      }),
      player2Data: v.optional(v.object({
        streak: v.number(),
        multiplier: v.number(),
        cashedOut: v.boolean(),
      })),
      winnerId: v.optional(v.id("users")),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_player1", ["player1Id"])
      .index("by_player2", ["player2Id"]),

    // Bank accounts table
    bankAccounts: defineTable({
      userId: v.id("users"),
      balance: v.number(),
      lastInterestAt: v.optional(v.number()),
    }).index("by_user", ["userId"]),

    // Stock tickers table
    stockTickers: defineTable({
      symbol: v.string(),
      name: v.string(),
      price: v.number(),
      history: v.array(v.object({ t: v.number(), v: v.number() })),
    }).index("by_symbol", ["symbol"]),

    // Stock holdings table
    stockHoldings: defineTable({
      userId: v.id("users"),
      symbol: v.string(),
      shares: v.number(),
      avgCost: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_and_symbol", ["userId", "symbol"]),

    // Metrics table to store app-wide simple key/value metrics (e.g., last total credits)
    metrics: defineTable({
      key: v.string(),
      value: v.number(),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // Properties table
    properties: defineTable({
      name: v.string(),
      location: v.string(),
      bedrooms: v.number(),
      bathrooms: v.number(),
      sqft: v.number(),
      amenities: v.array(v.string()),
      basePrice: v.number(),
      currentPrice: v.number(),
      status: v.union(v.literal("available"), v.literal("sold")),
      ownerId: v.optional(v.id("users")),
      ownerName: v.optional(v.string()),
      listedForSale: v.boolean(),
      salePrice: v.optional(v.number()),
    }).index("by_status", ["status"])
      .index("by_owner", ["ownerId"])
      .index("by_location", ["location"])
      .index("by_listed", ["listedForSale"]),

    // Real estate events table
    realEstateEvents: defineTable({
      eventType: v.string(),
      affectedArea: v.string(),
      description: v.string(),
      priceImpact: v.number(),
      triggeredAt: v.number(),
      expiresAt: v.number(),
      status: v.union(v.literal("active"), v.literal("expired")),
    }).index("by_status", ["status"])
      .index("by_area", ["affectedArea"]),

    // Property transactions table
    propertyTransactions: defineTable({
      propertyId: v.id("properties"),
      buyerId: v.optional(v.id("users")),
      sellerId: v.optional(v.id("users")),
      price: v.number(),
      transactionType: v.union(
        v.literal("market_purchase"),
        v.literal("player_to_player"),
        v.literal("bank_sale")
      ),
      timestamp: v.number(),
    }).index("by_buyer", ["buyerId"])
      .index("by_seller", ["sellerId"])
      .index("by_property", ["propertyId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
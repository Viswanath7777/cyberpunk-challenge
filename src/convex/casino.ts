import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Blackjack card values
const CARD_VALUES: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  "J": 10, "Q": 10, "K": 10, "A": 11
};

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

// Slots symbols and their payouts
const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "⭐", "💎", "7️⃣"];
const SLOT_PAYOUTS: Record<string, number> = {
  "7️⃣": 10,
  "💎": 7,
  "⭐": 5,
  "🍊": 3,
  "🍋": 2,
  "🍒": 1.5,
};

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffleDeck(deck: any[]) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculateHandValue(hand: any[]) {
  let value = 0;
  let aces = 0;
  
  for (const card of hand) {
    const cardValue = CARD_VALUES[card.rank];
    value += cardValue;
    if (card.rank === "A") aces++;
  }
  
  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
}

// Start a new blackjack game
export const startBlackjack = mutation({
  args: { betAmount: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    if (args.betAmount <= 0) throw new Error("Bet must be greater than 0");
    
    const credits = user.credits ?? 1000;
    if (credits < args.betAmount) throw new Error("Insufficient credits");
    
    // Deduct bet
    await ctx.db.patch(user._id, { credits: credits - args.betAmount });
    
    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    
    // Deal initial cards
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];
    
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(dealerHand);
    
    // Check for immediate blackjack
    let status = "in_progress";
    let result = undefined;
    let payout = 0;
    
    if (playerValue === 21) {
      status = "completed";
      if (dealerValue === 21) {
        result = "push";
        payout = args.betAmount; // Return bet
      } else {
        result = "win";
        payout = Math.floor(args.betAmount * 2.5); // Blackjack pays 3:2
      }
      await ctx.db.patch(user._id, { credits: credits - args.betAmount + payout });
    }
    
    const gameId = await ctx.db.insert("casinoGames", {
      userId: user._id,
      gameType: "blackjack",
      betAmount: args.betAmount,
      payout,
      status: status as "in_progress" | "completed",
      gameData: {
        deck,
        playerHand,
        dealerHand,
        playerValue,
        dealerValue,
      },
      result,
      startedAt: Date.now(),
      completedAt: status === "completed" ? Date.now() : undefined,
    });
    
    return { gameId, playerHand, dealerHand: [dealerHand[0]], playerValue, dealerValue: CARD_VALUES[dealerHand[0].rank], status, result, payout };
  },
});

// Blackjack hit
export const blackjackHit = mutation({
  args: { gameId: v.id("casinoGames") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.userId !== user._id) throw new Error("Not your game");
    if (game.status !== "in_progress") throw new Error("Game already completed");
    
    const { deck, playerHand, dealerHand } = game.gameData;
    
    // Deal card to player
    const newCard = deck.pop();
    playerHand.push(newCard);
    const playerValue = calculateHandValue(playerHand);
    
    let status: "in_progress" | "completed" = game.status;
    let result = game.result;
    let payout = 0;
    
    // Check for bust
    if (playerValue > 21) {
      status = "completed";
      result = "loss";
      payout = 0;
    }
    
    await ctx.db.patch(args.gameId, {
      gameData: { deck, playerHand, dealerHand, playerValue, dealerValue: calculateHandValue(dealerHand) },
      status,
      result,
      payout,
      completedAt: status === "completed" ? Date.now() : undefined,
    });
    
    return { playerHand, playerValue, status, result, payout };
  },
});

// Blackjack stand
export const blackjackStand = mutation({
  args: { gameId: v.id("casinoGames") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.userId !== user._id) throw new Error("Not your game");
    if (game.status !== "in_progress") throw new Error("Game already completed");
    
    const { deck, playerHand, dealerHand } = game.gameData;
    const playerValue = calculateHandValue(playerHand);
    
    // Dealer plays
    while (calculateHandValue(dealerHand) < 17) {
      dealerHand.push(deck.pop());
    }
    
    const dealerValue = calculateHandValue(dealerHand);
    
    let result: string;
    let payout = 0;
    
    if (dealerValue > 21 || playerValue > dealerValue) {
      result = "win";
      payout = game.betAmount * 2;
    } else if (playerValue === dealerValue) {
      result = "push";
      payout = game.betAmount;
    } else {
      result = "loss";
      payout = 0;
    }
    
    // Update credits
    const currentCredits = user.credits ?? 1000;
    await ctx.db.patch(user._id, { credits: currentCredits + payout });
    
    await ctx.db.patch(args.gameId, {
      gameData: { deck, playerHand, dealerHand, playerValue, dealerValue },
      status: "completed",
      result,
      payout,
      completedAt: Date.now(),
    });
    
    return { dealerHand, dealerValue, result, payout };
  },
});

// Blackjack double down
export const blackjackDouble = mutation({
  args: { gameId: v.id("casinoGames") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.userId !== user._id) throw new Error("Not your game");
    if (game.status !== "in_progress") throw new Error("Game already completed");
    if (game.gameData.playerHand.length !== 2) throw new Error("Can only double on first two cards");
    
    const credits = user.credits ?? 1000;
    if (credits < game.betAmount) throw new Error("Insufficient credits to double");
    
    // Deduct additional bet
    await ctx.db.patch(user._id, { credits: credits - game.betAmount });
    
    const { deck, playerHand, dealerHand } = game.gameData;
    
    // Deal one card to player
    playerHand.push(deck.pop());
    const playerValue = calculateHandValue(playerHand);
    
    let result: string;
    let payout = 0;
    
    if (playerValue > 21) {
      result = "loss";
      payout = 0;
    } else {
      // Dealer plays
      while (calculateHandValue(dealerHand) < 17) {
        dealerHand.push(deck.pop());
      }
      
      const dealerValue = calculateHandValue(dealerHand);
      
      if (dealerValue > 21 || playerValue > dealerValue) {
        result = "win";
        payout = game.betAmount * 4; // Double bet, double payout
      } else if (playerValue === dealerValue) {
        result = "push";
        payout = game.betAmount * 2; // Return doubled bet
      } else {
        result = "loss";
        payout = 0;
      }
    }
    
    // Update credits
    const currentCredits = user.credits ?? 1000;
    await ctx.db.patch(user._id, { credits: currentCredits - game.betAmount + payout });
    
    await ctx.db.patch(args.gameId, {
      betAmount: game.betAmount * 2,
      gameData: { deck, playerHand, dealerHand, playerValue, dealerValue: calculateHandValue(dealerHand) },
      status: "completed",
      result,
      payout,
      completedAt: Date.now(),
    });
    
    return { playerHand, playerValue, dealerHand, dealerValue: calculateHandValue(dealerHand), result, payout };
  },
});

// Spin slots
export const spinSlots = mutation({
  args: { betAmount: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    if (args.betAmount <= 0) throw new Error("Bet must be greater than 0");
    
    const credits = user.credits ?? 1000;
    if (credits < args.betAmount) throw new Error("Insufficient credits");
    
    // Deduct bet
    await ctx.db.patch(user._id, { credits: credits - args.betAmount });
    
    // Spin reels
    const reels = [
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ];
    
    // Check for win
    let result: string;
    let payout = 0;
    
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      result = "win";
      const multiplier = SLOT_PAYOUTS[reels[0]] || 1;
      payout = Math.floor(args.betAmount * multiplier);
    } else {
      result = "loss";
      payout = 0;
    }
    
    // Update credits
    const currentCredits = user.credits ?? 1000;
    await ctx.db.patch(user._id, { credits: currentCredits - args.betAmount + payout });
    
    const gameId = await ctx.db.insert("casinoGames", {
      userId: user._id,
      gameType: "slots",
      betAmount: args.betAmount,
      payout,
      status: "completed",
      gameData: { reels },
      result,
      startedAt: Date.now(),
      completedAt: Date.now(),
    });
    
    return { gameId, reels, result, payout };
  },
});

// Get game history
export const getGameHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    
    const games = await ctx.db
      .query("casinoGames")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit ?? 20);
    
    return games;
  },
});

// Get active blackjack game
export const getActiveBlackjack = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    
    const game = await ctx.db
      .query("casinoGames")
      .withIndex("by_user_and_status", (q) => 
        q.eq("userId", user._id).eq("status", "in_progress")
      )
      .filter((q) => q.eq(q.field("gameType"), "blackjack"))
      .first();
    
    return game;
  },
});

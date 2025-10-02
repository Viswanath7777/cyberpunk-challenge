import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Card values for ranking (Ace=1, 2-9=face, 10=10, J=11, Q=12, K=13)
const CARD_RANKS: Record<string, number> = {
  "A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, 
  "10": 10, "J": 11, "Q": 12, "K": 13
};

// Blackjack card values (for calculating hand totals)
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

// Roulette numbers and colors
const ROULETTE_NUMBERS = [
  { number: 0, color: "green" },
  { number: 1, color: "red" }, { number: 2, color: "black" }, { number: 3, color: "red" },
  { number: 4, color: "black" }, { number: 5, color: "red" }, { number: 6, color: "black" },
  { number: 7, color: "red" }, { number: 8, color: "black" }, { number: 9, color: "red" },
  { number: 10, color: "black" }, { number: 11, color: "black" }, { number: 12, color: "red" },
  { number: 13, color: "black" }, { number: 14, color: "red" }, { number: 15, color: "black" },
  { number: 16, color: "red" }, { number: 17, color: "black" }, { number: 18, color: "red" },
  { number: 19, color: "red" }, { number: 20, color: "black" }, { number: 21, color: "red" },
  { number: 22, color: "black" }, { number: 23, color: "red" }, { number: 24, color: "black" },
  { number: 25, color: "red" }, { number: 26, color: "black" }, { number: 27, color: "red" },
  { number: 28, color: "black" }, { number: 29, color: "black" }, { number: 30, color: "red" },
  { number: 31, color: "black" }, { number: 32, color: "red" }, { number: 33, color: "black" },
  { number: 34, color: "red" }, { number: 35, color: "black" }, { number: 36, color: "red" },
];

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
    
    const isAdmin = user.role === "admin";
    const actualBetAmount = isAdmin && args.betAmount === 0 ? 0 : args.betAmount;
    
    if (!isAdmin && actualBetAmount <= 0) throw new Error("Bet must be greater than 0");
    
    const credits = user.credits ?? 1000;
    if (!isAdmin && credits < actualBetAmount) throw new Error("Insufficient credits");
    
    // Deduct bet (skip for admin with 0 bet)
    if (!(isAdmin && actualBetAmount === 0)) {
      await ctx.db.patch(user._id, { credits: credits - actualBetAmount });
    }
    
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
    
    // Admin always gets blackjack win if they have 21
    if (playerValue === 21) {
      status = "completed";
      if (isAdmin || dealerValue !== 21) {
        result = "win";
        payout = Math.floor(actualBetAmount * 2.5); // Blackjack pays 3:2
      } else {
        result = "push";
        payout = actualBetAmount; // Return bet
      }
      await ctx.db.patch(user._id, { credits: credits - actualBetAmount + payout });
    }
    
    const gameId = await ctx.db.insert("casinoGames", {
      userId: user._id,
      gameType: "blackjack",
      betAmount: actualBetAmount,
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
    
    const isAdmin = user.role === "admin";
    const { deck, playerHand, dealerHand } = game.gameData;
    
    // Deal card to player
    const newCard = deck.pop();
    playerHand.push(newCard);
    const playerValue = calculateHandValue(playerHand);
    
    let status: "in_progress" | "completed" = game.status;
    let result = game.result;
    let payout = 0;
    
    // Admin never busts
    if (!isAdmin && playerValue > 21) {
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
    
    const isAdmin = user.role === "admin";
    const { deck, playerHand, dealerHand } = game.gameData;
    const playerValue = calculateHandValue(playerHand);
    
    // Dealer plays
    while (calculateHandValue(dealerHand) < 17) {
      dealerHand.push(deck.pop());
    }
    
    const dealerValue = calculateHandValue(dealerHand);
    
    let result: string;
    let payout = 0;
    
    // Admin always wins
    if (isAdmin) {
      result = "win";
      payout = game.betAmount * 2;
    } else if (dealerValue > 21 || playerValue > dealerValue) {
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
    
    const isAdmin = user.role === "admin";
    const credits = user.credits ?? 1000;
    
    if (!isAdmin && credits < game.betAmount) throw new Error("Insufficient credits to double");
    
    // Deduct additional bet (skip for admin with 0 bet)
    if (!(isAdmin && game.betAmount === 0)) {
      await ctx.db.patch(user._id, { credits: credits - game.betAmount });
    }
    
    const { deck, playerHand, dealerHand } = game.gameData;
    
    // Deal one card to player
    playerHand.push(deck.pop());
    const playerValue = calculateHandValue(playerHand);
    
    let result: string;
    let payout = 0;
    
    // Admin never busts and always wins
    if (isAdmin) {
      result = "win";
      payout = game.betAmount * 4;
    } else if (playerValue > 21) {
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

// High-Low game: Start a new game
export const startHighLow = mutation({
  args: { betAmount: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const isAdmin = user.role === "admin";
    const actualBetAmount = isAdmin && args.betAmount === 0 ? 0 : args.betAmount;
    
    if (!isAdmin && actualBetAmount <= 0) throw new Error("Bet must be greater than 0");
    
    const credits = user.credits ?? 1000;
    if (!isAdmin && credits < actualBetAmount) throw new Error("Insufficient credits");
    
    // Deduct bet (skip for admin with 0 bet)
    if (!(isAdmin && actualBetAmount === 0)) {
      await ctx.db.patch(user._id, { credits: credits - actualBetAmount });
    }
    
    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    
    // Draw first card
    const currentCard = deck.pop();
    
    const gameId = await ctx.db.insert("casinoGames", {
      userId: user._id,
      gameType: "highlow",
      betAmount: actualBetAmount,
      payout: 0,
      status: "in_progress",
      gameData: {
        deck,
        currentCard,
        streak: 0,
        multiplier: 1,
      },
      startedAt: Date.now(),
    });
    
    return { gameId, currentCard, streak: 0, multiplier: 1 };
  },
});

// High-Low: Make a guess (higher or lower)
export const highLowGuess = mutation({
  args: { 
    gameId: v.id("casinoGames"),
    guess: v.union(v.literal("higher"), v.literal("lower"))
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.userId !== user._id) throw new Error("Not your game");
    if (game.status !== "in_progress") throw new Error("Game already completed");
    
    const isAdmin = user.role === "admin";
    const { deck, currentCard, streak, multiplier } = game.gameData;
    
    if (deck.length === 0) {
      // No more cards, cash out
      const payout = Math.floor(game.betAmount * multiplier);
      const currentCredits = user.credits ?? 1000;
      await ctx.db.patch(user._id, { credits: currentCredits + payout });
      
      await ctx.db.patch(args.gameId, {
        status: "completed",
        result: "win",
        payout,
        completedAt: Date.now(),
      });
      
      return { 
        correct: true, 
        nextCard: null, 
        streak, 
        multiplier, 
        gameOver: true, 
        result: "win",
        payout 
      };
    }
    
    // Draw next card
    const nextCard = deck.pop();
    
    const currentRank = CARD_RANKS[currentCard.rank];
    const nextRank = CARD_RANKS[nextCard.rank];
    
    let correct = false;
    
    // Admin always guesses correctly
    if (isAdmin) {
      correct = true;
    } else {
      if (args.guess === "higher") {
        correct = nextRank > currentRank;
      } else {
        correct = nextRank < currentRank;
      }
    }
    
    if (correct) {
      // Correct guess - increase streak and multiplier
      const newStreak = streak + 1;
      const newMultiplier = 1 + (newStreak * 0.2); // +20% per correct guess
      
      await ctx.db.patch(args.gameId, {
        gameData: {
          deck,
          currentCard: nextCard,
          streak: newStreak,
          multiplier: newMultiplier,
        },
      });
      
      return { 
        correct: true, 
        nextCard, 
        streak: newStreak, 
        multiplier: newMultiplier,
        gameOver: false 
      };
    } else {
      // Wrong guess - game over, lose bet
      await ctx.db.patch(args.gameId, {
        status: "completed",
        result: "loss",
        payout: 0,
        gameData: {
          deck,
          currentCard: nextCard,
          streak,
          multiplier,
        },
        completedAt: Date.now(),
      });
      
      return { 
        correct: false, 
        nextCard, 
        streak, 
        multiplier,
        gameOver: true,
        result: "loss",
        payout: 0
      };
    }
  },
});

// High-Low: Cash out current winnings
export const highLowCashOut = mutation({
  args: { gameId: v.id("casinoGames") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.userId !== user._id) throw new Error("Not your game");
    if (game.status !== "in_progress") throw new Error("Game already completed");
    
    const { multiplier } = game.gameData;
    const payout = Math.floor(game.betAmount * multiplier);
    
    // Add winnings to credits
    const currentCredits = user.credits ?? 1000;
    await ctx.db.patch(user._id, { credits: currentCredits + payout });
    
    await ctx.db.patch(args.gameId, {
      status: "completed",
      result: "win",
      payout,
      completedAt: Date.now(),
    });
    
    return { payout, multiplier };
  },
});

// Spin slots
export const spinSlots = mutation({
  args: { betAmount: v.number() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const isAdmin = user.role === "admin";
    const actualBetAmount = isAdmin && args.betAmount === 0 ? 0 : args.betAmount;
    
    if (!isAdmin && actualBetAmount <= 0) throw new Error("Bet must be greater than 0");
    
    const credits = user.credits ?? 1000;
    if (!isAdmin && credits < actualBetAmount) throw new Error("Insufficient credits");
    
    // Deduct bet (skip for admin with 0 bet)
    if (!(isAdmin && actualBetAmount === 0)) {
      await ctx.db.patch(user._id, { credits: credits - actualBetAmount });
    }
    
    // Spin reels - admin always gets 7️⃣7️⃣7️⃣ (highest payout)
    let reels;
    if (isAdmin) {
      reels = ["7️⃣", "7️⃣", "7️⃣"];
    } else {
      reels = [
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      ];
    }
    
    // Check for win
    let result: string;
    let payout = 0;
    
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      result = "win";
      const multiplier = SLOT_PAYOUTS[reels[0]] || 1;
      payout = Math.floor(actualBetAmount * multiplier);
    } else {
      result = "loss";
      payout = 0;
    }
    
    // Update credits
    const currentCredits = user.credits ?? 1000;
    await ctx.db.patch(user._id, { credits: currentCredits - actualBetAmount + payout });
    
    const gameId = await ctx.db.insert("casinoGames", {
      userId: user._id,
      gameType: "slots",
      betAmount: actualBetAmount,
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

// Roulette: Spin the wheel
export const spinRoulette = mutation({
  args: { 
    betAmount: v.number(),
    betType: v.string(), // "number", "red", "black", "even", "odd", "1-18", "19-36", "dozen1", "dozen2", "dozen3"
    betValue: v.optional(v.number()), // specific number if betting on a number
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const isAdmin = user.role === "admin";
    const actualBetAmount = isAdmin && args.betAmount === 0 ? 0 : args.betAmount;
    
    if (!isAdmin && actualBetAmount <= 0) throw new Error("Bet must be greater than 0");
    
    const credits = user.credits ?? 1000;
    if (!isAdmin && credits < actualBetAmount) throw new Error("Insufficient credits");
    
    // Deduct bet (skip for admin with 0 bet)
    if (!(isAdmin && actualBetAmount === 0)) {
      await ctx.db.patch(user._id, { credits: credits - actualBetAmount });
    }
    
    // Spin the wheel - admin always wins their bet
    let winningNumber;
    if (isAdmin) {
      // Admin wins: match their bet type
      if (args.betType === "number" && args.betValue !== undefined) {
        winningNumber = args.betValue;
      } else if (args.betType === "red") {
        winningNumber = 1; // red number
      } else if (args.betType === "black") {
        winningNumber = 2; // black number
      } else if (args.betType === "even") {
        winningNumber = 2;
      } else if (args.betType === "odd") {
        winningNumber = 1;
      } else if (args.betType === "1-18") {
        winningNumber = 10;
      } else if (args.betType === "19-36") {
        winningNumber = 25;
      } else if (args.betType === "dozen1") {
        winningNumber = 5;
      } else if (args.betType === "dozen2") {
        winningNumber = 15;
      } else if (args.betType === "dozen3") {
        winningNumber = 30;
      } else {
        winningNumber = 1;
      }
    } else {
      winningNumber = Math.floor(Math.random() * 37); // 0-36
    }
    
    const winningSlot = ROULETTE_NUMBERS.find(n => n.number === winningNumber)!;
    
    // Check if bet wins
    let isWin = false;
    let multiplier = 0;
    
    if (args.betType === "number" && args.betValue === winningNumber) {
      isWin = true;
      multiplier = 35; // 35:1 payout
    } else if (args.betType === "red" && winningSlot.color === "red") {
      isWin = true;
      multiplier = 2; // 1:1 payout
    } else if (args.betType === "black" && winningSlot.color === "black") {
      isWin = true;
      multiplier = 2;
    } else if (args.betType === "even" && winningNumber > 0 && winningNumber % 2 === 0) {
      isWin = true;
      multiplier = 2;
    } else if (args.betType === "odd" && winningNumber % 2 === 1) {
      isWin = true;
      multiplier = 2;
    } else if (args.betType === "1-18" && winningNumber >= 1 && winningNumber <= 18) {
      isWin = true;
      multiplier = 2;
    } else if (args.betType === "19-36" && winningNumber >= 19 && winningNumber <= 36) {
      isWin = true;
      multiplier = 2;
    } else if (args.betType === "dozen1" && winningNumber >= 1 && winningNumber <= 12) {
      isWin = true;
      multiplier = 3; // 2:1 payout
    } else if (args.betType === "dozen2" && winningNumber >= 13 && winningNumber <= 24) {
      isWin = true;
      multiplier = 3;
    } else if (args.betType === "dozen3" && winningNumber >= 25 && winningNumber <= 36) {
      isWin = true;
      multiplier = 3;
    }
    
    const payout = isWin ? Math.floor(actualBetAmount * multiplier) : 0;
    const result = isWin ? "win" : "loss";
    
    // Update credits
    const currentCredits = user.credits ?? 1000;
    await ctx.db.patch(user._id, { credits: currentCredits - actualBetAmount + payout });
    
    const gameId = await ctx.db.insert("casinoGames", {
      userId: user._id,
      gameType: "roulette",
      betAmount: actualBetAmount,
      payout,
      status: "completed",
      gameData: { 
        winningNumber, 
        winningColor: winningSlot.color,
        betType: args.betType,
        betValue: args.betValue,
      },
      result,
      startedAt: Date.now(),
      completedAt: Date.now(),
    });
    
    return { gameId, winningNumber, winningColor: winningSlot.color, result, payout };
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
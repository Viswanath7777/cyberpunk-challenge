import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const CARD_RANKS: Record<string, number> = {
  "A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, 
  "10": 10, "J": 11, "Q": 12, "K": 13
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

// Create or join a multiplayer game
export const createOrJoinGame = mutation({
  args: { 
    betAmount: v.number(),
    adminMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const isAdmin = user.role === "admin";
    const adminCheat = isAdmin && args.adminMode === true;
    const actualBetAmount = adminCheat && args.betAmount === 0 ? 0 : args.betAmount;
    
    if (!adminCheat && actualBetAmount <= 0) throw new Error("Bet must be greater than 0");
    
    const credits = user.credits ?? 1000;
    if (!adminCheat && credits < actualBetAmount) throw new Error("Insufficient credits");
    
    // Check for existing waiting games with same bet amount
    const waitingGame = await ctx.db
      .query("multiplayerHighLow")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .filter((q) => q.eq(q.field("betAmount"), actualBetAmount))
      .first();
    
    if (waitingGame && waitingGame.player1Id !== user._id) {
      // Join existing game - only deduct credits if not cheating zero
      if (!(adminCheat && actualBetAmount === 0)) {
        await ctx.db.patch(user._id, { credits: credits - actualBetAmount });
      }
      
      await ctx.db.patch(waitingGame._id, {
        player2Id: user._id,
        status: "in_progress",
        currentTurn: "player1",
        player2Data: {
          streak: 0,
          multiplier: 1,
          cashedOut: false,
        },
      });
      
      return { gameId: waitingGame._id, joined: true };
    } else {
      // Create new game - only deduct credits if not cheating zero
      if (!(adminCheat && actualBetAmount === 0)) {
        await ctx.db.patch(user._id, { credits: credits - actualBetAmount });
      }
      
      const deck = shuffleDeck(createDeck());
      const currentCard = deck.pop()!;
      
      const gameId = await ctx.db.insert("multiplayerHighLow", {
        player1Id: user._id,
        betAmount: actualBetAmount,
        status: "waiting",
        deck,
        currentCard,
        player1Data: {
          streak: 0,
          multiplier: 1,
          cashedOut: false,
        },
        createdAt: Date.now(),
      });
      
      return { gameId, joined: false };
    }
  },
});

// List available games to join
export const listWaitingGames = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    
    const games = await ctx.db
      .query("multiplayerHighLow")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .filter((q) => q.neq(q.field("player1Id"), user._id))
      .take(10);
    
    return games;
  },
});

// Get current game state
export const getGameState = query({
  args: { gameId: v.id("multiplayerHighLow") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;
    
    // Get player names
    const player1 = await ctx.db.get(game.player1Id);
    const player2 = game.player2Id ? await ctx.db.get(game.player2Id) : null;
    
    return {
      ...game,
      player1Name: player1?.characterName ?? "Player 1",
      player2Name: player2?.characterName ?? "Player 2",
      isPlayer1: user._id === game.player1Id,
      isPlayer2: user._id === game.player2Id,
    };
  },
});

// Make a guess in multiplayer game
export const makeGuess = mutation({
  args: {
    gameId: v.id("multiplayerHighLow"),
    guess: v.union(v.literal("higher"), v.literal("lower")),
    adminMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "in_progress") throw new Error("Game not in progress");
    
    const isPlayer1 = user._id === game.player1Id;
    const isPlayer2 = user._id === game.player2Id;
    
    if (!isPlayer1 && !isPlayer2) throw new Error("Not a player in this game");
    
    const currentPlayer = isPlayer1 ? "player1" : "player2";
    if (game.currentTurn !== currentPlayer) throw new Error("Not your turn");
    
    const { deck, currentCard } = game;
    
    if (deck.length === 0) {
      throw new Error("No more cards");
    }
    
    const nextCard = deck[deck.length - 1];
    const newDeck = deck.slice(0, -1);
    
    const currentRank = CARD_RANKS[currentCard.rank];
    const nextRank = CARD_RANKS[nextCard.rank];
    
    const isAdmin = user.role === "admin";
    const adminCheat = isAdmin && args.adminMode === true;
    let correct = false;

    if (adminCheat) {
      correct = true;
    } else {
      if (args.guess === "higher") {
        correct = nextRank > currentRank;
      } else {
        correct = nextRank < currentRank;
      }
    }
    
    const playerData = isPlayer1 ? game.player1Data : game.player2Data!;
    
    if (correct) {
      // Correct guess - increase streak and multiplier
      const newStreak = playerData.streak + 1;
      const newMultiplier = 1 + (newStreak * 0.2);
      
      const updatedPlayerData = {
        streak: newStreak,
        multiplier: newMultiplier,
        cashedOut: false,
      };
      
      await ctx.db.patch(args.gameId, {
        deck: newDeck,
        currentCard: nextCard,
        currentTurn: isPlayer1 ? "player2" : "player1",
        ...(isPlayer1 
          ? { player1Data: updatedPlayerData }
          : { player2Data: updatedPlayerData }
        ),
      });
      
      return { correct: true as const, nextCard, streak: newStreak, multiplier: newMultiplier };
    } else {
      // Wrong guess - player busts
      const updatedPlayerData = {
        ...playerData,
        cashedOut: true,
      };
      
      await ctx.db.patch(args.gameId, {
        deck: newDeck,
        currentCard: nextCard,
        ...(isPlayer1 
          ? { player1Data: updatedPlayerData }
          : { player2Data: updatedPlayerData }
        ),
      });
      
      // Check if game should end
      await checkGameEnd(ctx, args.gameId);
      
      return { correct: false as const, nextCard, streak: 0, multiplier: 0 };
    }
  },
});

// Cash out in multiplayer game
export const cashOut = mutation({
  args: { gameId: v.id("multiplayerHighLow") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "in_progress") throw new Error("Game not in progress");
    
    const isPlayer1 = user._id === game.player1Id;
    const isPlayer2 = user._id === game.player2Id;
    
    if (!isPlayer1 && !isPlayer2) throw new Error("Not a player in this game");
    
    const playerData = isPlayer1 ? game.player1Data : game.player2Data!;
    
    const updatedPlayerData = {
      ...playerData,
      cashedOut: true,
    };
    
    await ctx.db.patch(args.gameId, {
      ...(isPlayer1 
        ? { player1Data: updatedPlayerData }
        : { player2Data: updatedPlayerData }
      ),
    });
    
    // Check if game should end
    await checkGameEnd(ctx, args.gameId);
    
    return { multiplier: playerData.multiplier };
  },
});

// Helper function to check if game should end and distribute winnings
async function checkGameEnd(ctx: any, gameId: any) {
  const game = await ctx.db.get(gameId);
  if (!game || !game.player2Data) return;
  
  const p1CashedOut = game.player1Data.cashedOut;
  const p2CashedOut = game.player2Data.cashedOut;
  
  if (p1CashedOut && p2CashedOut) {
    // Both cashed out - higher multiplier wins
    const p1Mult = game.player1Data.multiplier;
    const p2Mult = game.player2Data.multiplier;
    
    let winnerId;
    let p1Payout = 0;
    let p2Payout = 0;
    
    if (p1Mult > p2Mult) {
      winnerId = game.player1Id;
      p1Payout = Math.floor(game.betAmount * p1Mult) + game.betAmount;
    } else if (p2Mult > p1Mult) {
      winnerId = game.player2Id;
      p2Payout = Math.floor(game.betAmount * p2Mult) + game.betAmount;
    } else {
      // Tie - return bets
      p1Payout = game.betAmount;
      p2Payout = game.betAmount;
    }
    
    // Update credits
    const player1 = await ctx.db.get(game.player1Id);
    const player2 = await ctx.db.get(game.player2Id);
    
    if (player1) {
      await ctx.db.patch(game.player1Id, {
        credits: (player1.credits ?? 1000) + p1Payout,
      });
    }
    
    if (player2) {
      await ctx.db.patch(game.player2Id, {
        credits: (player2.credits ?? 1000) + p2Payout,
      });
    }
    
    await ctx.db.patch(gameId, {
      status: "completed",
      winnerId,
      completedAt: Date.now(),
    });
  }
}

// Leave/cancel a waiting game
export const leaveGame = mutation({
  args: { gameId: v.id("multiplayerHighLow") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    
    if (game.player1Id !== user._id) throw new Error("Not your game");
    if (game.status !== "waiting") throw new Error("Can only leave waiting games");
    
    // Refund bet
    const credits = user.credits ?? 1000;
    await ctx.db.patch(user._id, { credits: credits + game.betAmount });
    
    // Delete game
    await ctx.db.delete(args.gameId);
  },
});
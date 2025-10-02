import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Trophy, Zap } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface MultiplayerHighLowProps {
  credits: number;
}

export function MultiplayerHighLow({ credits }: MultiplayerHighLowProps) {
  const [betAmount, setBetAmount] = useState(50);
  const [currentGameId, setCurrentGameId] = useState<Id<"multiplayerHighLow"> | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);

  const createOrJoin = useMutation(api.multiplayerHighLow.createOrJoinGame);
  const makeGuess = useMutation(api.multiplayerHighLow.makeGuess);
  const cashOut = useMutation(api.multiplayerHighLow.cashOut);
  const leaveGame = useMutation(api.multiplayerHighLow.leaveGame);
  
  const gameState = useQuery(
    api.multiplayerHighLow.getGameState,
    currentGameId ? { gameId: currentGameId } : "skip"
  );

  const handleStartGame = async () => {
    if (betAmount <= 0 || betAmount > credits) {
      toast.error("Invalid bet amount");
      return;
    }

    try {
      const result = await createOrJoin({ betAmount });
      setCurrentGameId(result.gameId);
      
      if (result.joined) {
        toast.success("Joined game! Get ready!");
      } else {
        setIsWaiting(true);
        toast.success("Waiting for opponent...");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start game");
    }
  };

  const handleGuess = async (guess: "higher" | "lower") => {
    if (!currentGameId) return;

    try {
      const result = await makeGuess({ gameId: currentGameId, guess });
      
      if (result.correct) {
        toast.success(`Correct! Streak: ${result.streak} | ${result.multiplier.toFixed(1)}x`);
      } else {
        toast.error("Wrong! You busted!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to make guess");
    }
  };

  const handleCashOut = async () => {
    if (!currentGameId) return;

    try {
      const result = await cashOut({ gameId: currentGameId });
      toast.success(`Cashed out at ${result.multiplier.toFixed(1)}x!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cash out");
    }
  };

  const handleLeave = async () => {
    if (!currentGameId) return;

    try {
      await leaveGame({ gameId: currentGameId });
      setCurrentGameId(null);
      setIsWaiting(false);
      toast.success("Left game and refunded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave");
    }
  };

  const resetGame = () => {
    setCurrentGameId(null);
    setIsWaiting(false);
  };

  // Check if game just started
  if (gameState && isWaiting && gameState.status === "in_progress") {
    setIsWaiting(false);
    toast.success("Opponent joined! Game starting!");
  }

  // Check if game completed
  if (gameState && gameState.status === "completed") {
    const isWinner = gameState.winnerId === (gameState.isPlayer1 ? gameState.player1Id : gameState.player2Id);
    
    return (
      <Card className="bg-gray-900/50 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-purple-400 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Multiplayer High-Low
          </CardTitle>
          <CardDescription className="text-gray-400">Game Over!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">
              {isWinner ? "🏆" : gameState.winnerId ? "😔" : "🤝"}
            </div>
            <div className="text-2xl font-bold text-cyan-400 mb-2">
              {isWinner ? "You Won!" : gameState.winnerId ? "You Lost!" : "Tie!"}
            </div>
            <div className="text-sm text-gray-400 space-y-1">
              <div>{gameState.player1Name}: {gameState.player1Data.multiplier.toFixed(1)}x</div>
              <div>{gameState.player2Name}: {gameState.player2Data?.multiplier.toFixed(1)}x</div>
            </div>
          </div>
          <Button
            onClick={resetGame}
            className="w-full bg-purple-500/20 border border-purple-500 text-purple-400 hover:bg-purple-500/30"
          >
            Play Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Waiting for opponent
  if (isWaiting && gameState) {
    return (
      <Card className="bg-gray-900/50 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-purple-400 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Multiplayer High-Low
          </CardTitle>
          <CardDescription className="text-gray-400">Waiting for opponent...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="text-4xl mb-4"
            >
              ⏳
            </motion.div>
            <div className="text-cyan-400 mb-2">Bet: {gameState.betAmount} CR</div>
            <div className="text-sm text-gray-400">Waiting for another player to join...</div>
          </div>
          <Button
            onClick={handleLeave}
            variant="outline"
            className="w-full border-red-500 text-red-500 hover:bg-red-500/10"
          >
            Cancel & Refund
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active game
  if (gameState && gameState.status === "in_progress") {
    const myData = gameState.isPlayer1 ? gameState.player1Data : gameState.player2Data!;
    const opponentData = gameState.isPlayer1 ? gameState.player2Data! : gameState.player1Data;
    const isMyTurn = (gameState.isPlayer1 && gameState.currentTurn === "player1") ||
                     (gameState.isPlayer2 && gameState.currentTurn === "player2");
    const myName = gameState.isPlayer1 ? gameState.player1Name : gameState.player2Name;
    const opponentName = gameState.isPlayer1 ? gameState.player2Name : gameState.player1Name;

    return (
      <Card className="bg-gray-900/50 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-purple-400 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Multiplayer High-Low
          </CardTitle>
          <CardDescription className="text-gray-400">
            {isMyTurn ? "Your Turn!" : `${opponentName}'s Turn`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Player Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-3 rounded border ${isMyTurn ? 'border-cyan-400 bg-cyan-400/10' : 'border-gray-700 bg-gray-800/30'}`}>
              <div className="text-xs text-gray-400">You ({myName})</div>
              <div className="text-lg font-bold text-cyan-400">{myData.multiplier.toFixed(1)}x</div>
              <div className="text-xs text-gray-400">Streak: {myData.streak}</div>
              {myData.cashedOut && <div className="text-xs text-yellow-400">Cashed Out</div>}
            </div>
            <div className={`p-3 rounded border ${!isMyTurn ? 'border-pink-400 bg-pink-400/10' : 'border-gray-700 bg-gray-800/30'}`}>
              <div className="text-xs text-gray-400">{opponentName}</div>
              <div className="text-lg font-bold text-pink-400">{opponentData.multiplier.toFixed(1)}x</div>
              <div className="text-xs text-gray-400">Streak: {opponentData.streak}</div>
              {opponentData.cashedOut && <div className="text-xs text-yellow-400">Cashed Out</div>}
            </div>
          </div>

          {/* Current Card */}
          <div className="flex justify-center py-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${gameState.currentCard.rank}-${gameState.currentCard.suit}`}
                initial={{ rotateY: 90, scale: 0.8 }}
                animate={{ rotateY: 0, scale: 1 }}
                exit={{ rotateY: -90, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="w-24 h-32 bg-white rounded-lg shadow-lg flex items-center justify-center text-4xl"
              >
                <div className={gameState.currentCard.suit === "♥" || gameState.currentCard.suit === "♦" ? "text-red-500" : "text-black"}>
                  {gameState.currentCard.rank}
                  {gameState.currentCard.suit}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          {!myData.cashedOut && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleGuess("higher")}
                disabled={!isMyTurn}
                className="bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
              >
                ⬆️ Higher
              </Button>
              <Button
                onClick={() => handleGuess("lower")}
                disabled={!isMyTurn}
                className="bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
              >
                ⬇️ Lower
              </Button>
            </div>
          )}

          {!myData.cashedOut && (
            <Button
              onClick={handleCashOut}
              disabled={!isMyTurn || myData.streak === 0}
              className="w-full bg-yellow-500/20 border border-yellow-500 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
            >
              💰 Cash Out ({myData.multiplier.toFixed(1)}x)
            </Button>
          )}

          <div className="text-xs text-center text-gray-500">
            Bet: {gameState.betAmount} CR • Cards left: {gameState.deck.length}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Initial state - start game
  return (
    <Card className="bg-gray-900/50 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-purple-400 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Multiplayer High-Low
        </CardTitle>
        <CardDescription className="text-gray-400">
          Compete against another player! Higher multiplier wins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Bet Amount</label>
          <Input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
            min={1}
            max={credits}
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <Button
          onClick={handleStartGame}
          disabled={betAmount <= 0 || betAmount > credits}
          className="w-full bg-purple-500/20 border border-purple-500 text-purple-400 hover:bg-purple-500/30"
        >
          <Users className="w-4 h-4 mr-2" />
          Find Opponent
        </Button>

        <div className="text-xs text-center text-gray-500">
          Available Credits: {credits} CR
        </div>
      </CardContent>
    </Card>
  );
}

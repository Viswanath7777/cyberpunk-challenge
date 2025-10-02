import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowUp, ArrowDown, DollarSign } from "lucide-react";

export function HighLow({ credits }: { credits: number }) {
  const [betAmount, setBetAmount] = useState(50);
  const [gameId, setGameId] = useState<Id<"casinoGames"> | null>(null);
  const [currentCard, setCurrentCard] = useState<any>(null);
  const [nextCard, setNextCard] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [gameStatus, setGameStatus] = useState<"idle" | "playing" | "completed">("idle");
  const [showResult, setShowResult] = useState(false);

  const startGame = useMutation(api.casino.startHighLow);
  const makeGuess = useMutation(api.casino.highLowGuess);
  const cashOut = useMutation(api.casino.highLowCashOut);

  const handleStart = async () => {
    if (betAmount <= 0 || betAmount > credits) {
      toast.error("Invalid bet amount");
      return;
    }

    try {
      const result = await startGame({ betAmount });
      setGameId(result.gameId);
      setCurrentCard(result.currentCard);
      setStreak(result.streak);
      setMultiplier(result.multiplier);
      setGameStatus("playing");
      setNextCard(null);
      setShowResult(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start game");
    }
  };

  const handleGuess = async (guess: "higher" | "lower") => {
    if (!gameId) return;
    
    try {
      const result = await makeGuess({ gameId, guess });
      setNextCard(result.nextCard);
      setShowResult(true);
      
      setTimeout(() => {
        if (result.correct && !result.gameOver) {
          setCurrentCard(result.nextCard);
          setStreak(result.streak);
          setMultiplier(result.multiplier);
          setNextCard(null);
          setShowResult(false);
          toast.success(`Correct! Streak: ${result.streak} | ${result.multiplier.toFixed(1)}x`);
        } else if (result.gameOver) {
          setGameStatus("completed");
          if (result.result === "win") {
            toast.success(`Cashed out ${result.payout} CR!`);
          } else {
            toast.error("Wrong! You lose");
          }
        }
      }, 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to make guess");
    }
  };

  const handleCashOut = async () => {
    if (!gameId) return;
    
    try {
      const result = await cashOut({ gameId });
      setGameStatus("completed");
      toast.success(`Cashed out ${result.payout} CR! (${result.multiplier.toFixed(1)}x)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cash out");
    }
  };

  const handleNewGame = () => {
    setGameId(null);
    setCurrentCard(null);
    setNextCard(null);
    setStreak(0);
    setMultiplier(1);
    setGameStatus("idle");
    setShowResult(false);
  };

  const renderCard = (card: any, label: string) => {
    if (!card) return null;
    
    return (
      <motion.div
        initial={{ scale: 0, rotateY: 180 }}
        animate={{ scale: 1, rotateY: 0 }}
        className="flex flex-col items-center gap-2"
      >
        <div className="text-xs text-gray-400 uppercase">{label}</div>
        <div
          className={`w-24 h-36 rounded-lg border-2 flex items-center justify-center text-4xl font-bold ${
            card.suit === "♥" || card.suit === "♦"
              ? "bg-gray-900 border-red-500 text-red-500"
              : "bg-gray-900 border-cyan-400 text-cyan-400"
          }`}
        >
          {card.rank}
          <span className="text-2xl ml-1">{card.suit}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <Card className="bg-gray-900/50 border-cyan-400/30">
      <CardHeader>
        <CardTitle className="text-cyan-400 text-2xl">🎴 High-Low 🎴</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {gameStatus === "idle" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={credits}
                value={betAmount}
                onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
                className="bg-gray-800 border-gray-600 text-white w-32"
                placeholder="Bet amount"
              />
              <Button
                onClick={handleStart}
                disabled={betAmount <= 0 || betAmount > credits}
                className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
              >
                Start Game
              </Button>
            </div>
            <div className="text-sm text-gray-400">
              Guess if the next card is higher or lower • Build your streak for bigger multipliers!
            </div>
          </div>
        )}

        {gameStatus === "playing" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="flex justify-around p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-center">
                <div className="text-xs text-gray-400">Streak</div>
                <div className="text-2xl font-bold text-yellow-400">{streak}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Multiplier</div>
                <div className="text-2xl font-bold text-green-400">{multiplier.toFixed(1)}x</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Potential Win</div>
                <div className="text-2xl font-bold text-cyan-400">{Math.floor(betAmount * multiplier)} CR</div>
              </div>
            </div>

            {/* Cards */}
            <div className="flex justify-center items-center gap-8">
              {renderCard(currentCard, "Current Card")}
              
              <AnimatePresence>
                {showResult && nextCard && (
                  <motion.div
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 50, opacity: 0 }}
                  >
                    {renderCard(nextCard, "Next Card")}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action buttons */}
            {!showResult && (
              <div className="space-y-3">
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => handleGuess("higher")}
                    className="flex-1 bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30 h-16 text-lg"
                  >
                    <ArrowUp className="w-6 h-6 mr-2" />
                    Higher
                  </Button>
                  <Button
                    onClick={() => handleGuess("lower")}
                    className="flex-1 bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 h-16 text-lg"
                  >
                    <ArrowDown className="w-6 h-6 mr-2" />
                    Lower
                  </Button>
                </div>
                
                {streak > 0 && (
                  <Button
                    onClick={handleCashOut}
                    className="w-full bg-yellow-400/20 border border-yellow-400 text-yellow-400 hover:bg-yellow-400/30"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Cash Out ({Math.floor(betAmount * multiplier)} CR)
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {gameStatus === "completed" && (
          <div className="space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-2xl font-bold text-center p-4 rounded-lg border-2 text-cyan-400 border-cyan-400 bg-cyan-400/10"
            >
              Game Over
            </motion.div>
            <div className="text-center text-gray-400">
              Final Streak: <span className="text-yellow-400 font-bold">{streak}</span>
            </div>
            <Button
              onClick={handleNewGame}
              className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
            >
              New Game
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

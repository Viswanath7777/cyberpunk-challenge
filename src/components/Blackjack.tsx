import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function Blackjack({ credits }: { credits: number }) {
  const [betAmount, setBetAmount] = useState(50);
  const [gameId, setGameId] = useState<Id<"casinoGames"> | null>(null);
  const [playerHand, setPlayerHand] = useState<any[]>([]);
  const [dealerHand, setDealerHand] = useState<any[]>([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [gameStatus, setGameStatus] = useState<"idle" | "playing" | "completed">("idle");
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);

  const startGame = useMutation(api.casino.startBlackjack);
  const hit = useMutation(api.casino.blackjackHit);
  const stand = useMutation(api.casino.blackjackStand);
  const doubleDown = useMutation(api.casino.blackjackDouble);

  // Get user to check admin status
  const user = useQuery(api.users.currentUser);
  const isAdmin = user?.role === "admin";

  const handleStart = async () => {
    // Admin can play with 0 bet when admin mode is enabled
    if (!isAdmin && (betAmount <= 0 || betAmount > credits)) {
      toast.error("Invalid bet amount");
      return;
    }

    if (isAdmin && !adminModeEnabled && (betAmount <= 0 || betAmount > credits)) {
      toast.error("Invalid bet amount");
      return;
    }

    try {
      const result = await startGame({ betAmount: isAdmin && adminModeEnabled && betAmount === 0 ? 0 : betAmount });
      setGameId(result.gameId);
      setPlayerHand(result.playerHand);
      setDealerHand(result.dealerHand);
      setPlayerValue(result.playerValue);
      setDealerValue(result.dealerValue);
      setGameStatus(result.status === "completed" ? "completed" : "playing");
      setGameResult(result.result || null);
      
      if (result.status === "completed") {
        if (result.result === "win") {
          toast.success(`Blackjack! Won ${result.payout} CR`);
        } else if (result.result === "push") {
          toast.info("Push! Bet returned");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start game");
    }
  };

  const handleHit = async () => {
    if (!gameId) return;
    try {
      const result = await hit({ gameId });
      setPlayerHand(result.playerHand);
      setPlayerValue(result.playerValue);
      
      if (result.status === "completed") {
        setGameStatus("completed");
        setGameResult(result.result || null);
        toast.error("Bust! You lose");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to hit");
    }
  };

  const handleStand = async () => {
    if (!gameId) return;
    try {
      const result = await stand({ gameId });
      setDealerHand(result.dealerHand);
      setDealerValue(result.dealerValue);
      setGameStatus("completed");
      setGameResult(result.result);
      
      if (result.result === "win") {
        toast.success(`You win ${result.payout} CR!`);
      } else if (result.result === "push") {
        toast.info("Push! Bet returned");
      } else {
        toast.error("Dealer wins");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to stand");
    }
  };

  const handleDouble = async () => {
    if (!gameId) return;
    try {
      const result = await doubleDown({ gameId });
      setPlayerHand(result.playerHand);
      setPlayerValue(result.playerValue);
      setDealerHand(result.dealerHand);
      setDealerValue(result.dealerValue);
      setGameStatus("completed");
      setGameResult(result.result);
      
      if (result.result === "win") {
        toast.success(`You win ${result.payout} CR!`);
      } else if (result.result === "push") {
        toast.info("Push! Bet returned");
      } else {
        toast.error("Dealer wins");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to double down");
    }
  };

  const handleNewGame = () => {
    setGameId(null);
    setPlayerHand([]);
    setDealerHand([]);
    setPlayerValue(0);
    setDealerValue(0);
    setGameStatus("idle");
    setGameResult(null);
  };

  const renderCard = (card: any, index: number, hidden = false) => (
    <motion.div
      key={`${card.rank}-${card.suit}-${index}`}
      initial={{ scale: 0, rotateY: 180 }}
      animate={{ scale: 1, rotateY: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`w-16 h-24 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${
        hidden
          ? "bg-gradient-to-br from-cyan-500 to-pink-500 border-cyan-400"
          : card.suit === "♥" || card.suit === "♦"
          ? "bg-gray-900 border-red-500 text-red-500"
          : "bg-gray-900 border-cyan-400 text-cyan-400"
      }`}
    >
      {hidden ? "?" : `${card.rank}${card.suit}`}
    </motion.div>
  );

  return (
    <Card className="bg-gray-900/50 border-cyan-400/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-cyan-400 text-2xl">
            ♠️ Blackjack ♥️
          </CardTitle>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-mode-blackjack" className="text-xs text-pink-400">
                Admin Mode
              </Label>
              <Switch
                id="admin-mode-blackjack"
                checked={adminModeEnabled}
                onCheckedChange={setAdminModeEnabled}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {gameStatus === "idle" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={isAdmin && adminModeEnabled ? 0 : 1}
                max={credits}
                value={betAmount}
                onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
                className="bg-gray-800 border-gray-600 text-white w-32"
                placeholder="Bet amount"
              />
              <Button
                onClick={handleStart}
                disabled={isAdmin && adminModeEnabled ? false : (betAmount <= 0 || betAmount > credits)}
                className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
              >
                Deal Cards
              </Button>
            </div>
            <div className="text-sm text-gray-400">
              Blackjack pays 3:2 • Dealer stands on 17
              {isAdmin && adminModeEnabled && <span className="ml-2 text-pink-400">• Admin mode active</span>}
            </div>
          </div>
        )}

        {gameStatus !== "idle" && (
          <div className="space-y-6">
            {/* Dealer's hand */}
            <div className="space-y-2">
              <div className="text-pink-400 font-bold">
                Dealer {gameStatus === "completed" && `(${dealerValue})`}
              </div>
              <div className="flex gap-2">
                <AnimatePresence>
                  {dealerHand.map((card, i) => 
                    renderCard(card, i, gameStatus === "playing" && i === 1)
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Player's hand */}
            <div className="space-y-2">
              <div className="text-cyan-400 font-bold">You ({playerValue})</div>
              <div className="flex gap-2">
                <AnimatePresence>
                  {playerHand.map((card, i) => renderCard(card, i))}
                </AnimatePresence>
              </div>
            </div>

            {/* Action buttons */}
            {gameStatus === "playing" && (
              <div className="flex gap-2">
                <Button
                  onClick={handleHit}
                  className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                >
                  Hit
                </Button>
                <Button
                  onClick={handleStand}
                  className="bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30"
                >
                  Stand
                </Button>
                {playerHand.length === 2 && credits >= betAmount && (
                  <Button
                    onClick={handleDouble}
                    className="bg-yellow-400/20 border border-yellow-400 text-yellow-400 hover:bg-yellow-400/30"
                  >
                    Double Down
                  </Button>
                )}
              </div>
            )}

            {gameStatus === "completed" && (
              <div className="space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`text-2xl font-bold text-center p-4 rounded-lg border-2 ${
                    gameResult === "win"
                      ? "text-green-400 border-green-400 bg-green-400/10"
                      : gameResult === "push"
                      ? "text-yellow-400 border-yellow-400 bg-yellow-400/10"
                      : "text-red-400 border-red-400 bg-red-400/10"
                  }`}
                >
                  {gameResult === "win" && "YOU WIN!"}
                  {gameResult === "push" && "PUSH"}
                  {gameResult === "loss" && "DEALER WINS"}
                </motion.div>
                <Button
                  onClick={handleNewGame}
                  className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                >
                  New Game
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type BetType = "number" | "red" | "black" | "even" | "odd" | "1-18" | "19-36" | "dozen1" | "dozen2" | "dozen3";

export function Roulette({ credits }: { credits: number }) {
  const [betAmount, setBetAmount] = useState(25);
  const [selectedBet, setSelectedBet] = useState<{ type: BetType; value?: number } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [winningColor, setWinningColor] = useState<string | null>(null);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);

  const spin = useMutation(api.casino.spinRoulette);
  const user = useQuery(api.users.currentUser);
  const isAdmin = user?.role === "admin";

  const handleSpin = async () => {
    if (!selectedBet) {
      toast.error("Please select a bet first");
      return;
    }

    if (!isAdmin && (betAmount <= 0 || betAmount > credits)) {
      toast.error("Invalid bet amount");
      return;
    }

    if (isAdmin && !adminModeEnabled && (betAmount <= 0 || betAmount > credits)) {
      toast.error("Invalid bet amount");
      return;
    }

    setSpinning(true);
    setWinningNumber(null);
    setWinningColor(null);

    // Animate spinning
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const result = await spin({
        betAmount: isAdmin && adminModeEnabled && betAmount === 0 ? 0 : betAmount,
        betType: selectedBet.type,
        betValue: selectedBet.value,
        adminMode: isAdmin ? adminModeEnabled : undefined,
      });

      setWinningNumber(result.winningNumber);
      setWinningColor(result.winningColor);

      if (result.result === "win") {
        toast.success(`🎉 ${result.winningNumber} ${result.winningColor}! You win ${result.payout} CR!`);
      } else {
        toast.error(`${result.winningNumber} ${result.winningColor}. Better luck next time!`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to spin");
    } finally {
      setSpinning(false);
    }
  };

  const renderBetButton = (type: BetType, label: string, value?: number) => {
    const isSelected = selectedBet?.type === type && selectedBet?.value === value;
    return (
      <Button
        onClick={() => setSelectedBet({ type, value })}
        disabled={spinning}
        className={`${
          isSelected
            ? "bg-yellow-400/30 border-2 border-yellow-400 text-yellow-400"
            : "bg-gray-800/50 border border-gray-600 text-gray-300 hover:bg-gray-700/50"
        }`}
      >
        {label}
      </Button>
    );
  };

  return (
    <Card className="bg-gray-900/50 border-green-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-green-400 text-2xl">
            🎰 Roulette 🎰
          </CardTitle>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-mode-roulette" className="text-xs text-pink-400">
                Admin Mode
              </Label>
              <Switch
                id="admin-mode-roulette"
                checked={adminModeEnabled}
                onCheckedChange={setAdminModeEnabled}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Roulette wheel display */}
        <div className="bg-black/50 rounded-full w-64 h-64 mx-auto border-4 border-green-500/50 flex items-center justify-center relative overflow-hidden">
          <AnimatePresence>
            {spinning && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-8 border-t-yellow-400 border-r-red-500 border-b-green-400 border-l-cyan-400 rounded-full"
              />
            )}
          </AnimatePresence>
          
          {winningNumber !== null && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <div
                className={`text-6xl font-bold ${
                  winningColor === "red"
                    ? "text-red-500"
                    : winningColor === "black"
                    ? "text-white"
                    : "text-green-400"
                }`}
              >
                {winningNumber}
              </div>
              <div className="text-sm text-gray-400 uppercase">{winningColor}</div>
            </motion.div>
          )}
          
          {!spinning && winningNumber === null && (
            <div className="text-4xl text-gray-500">?</div>
          )}
        </div>

        {/* Bet amount input */}
        <div className="flex items-center gap-4 justify-center">
          <Input
            type="number"
            min={isAdmin && adminModeEnabled ? 0 : 1}
            max={credits}
            value={betAmount}
            onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
            disabled={spinning}
            className="bg-gray-800 border-gray-600 text-white w-32"
            placeholder="Bet amount"
          />
          <Button
            onClick={handleSpin}
            disabled={spinning || !selectedBet || (isAdmin && adminModeEnabled ? false : (betAmount <= 0 || betAmount > credits))}
            className="bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30 px-8"
          >
            {spinning ? "SPINNING..." : "SPIN"}
          </Button>
        </div>

        {/* Betting options */}
        <div className="space-y-3">
          <div className="text-sm text-gray-400 font-bold">Select Your Bet:</div>
          
          {/* Color bets */}
          <div className="grid grid-cols-2 gap-2">
            {renderBetButton("red", "🔴 Red (2x)")}
            {renderBetButton("black", "⚫ Black (2x)")}
          </div>

          {/* Even/Odd bets */}
          <div className="grid grid-cols-2 gap-2">
            {renderBetButton("even", "Even (2x)")}
            {renderBetButton("odd", "Odd (2x)")}
          </div>

          {/* Range bets */}
          <div className="grid grid-cols-2 gap-2">
            {renderBetButton("1-18", "1-18 (2x)")}
            {renderBetButton("19-36", "19-36 (2x)")}
          </div>

          {/* Dozen bets */}
          <div className="grid grid-cols-3 gap-2">
            {renderBetButton("dozen1", "1st 12 (3x)")}
            {renderBetButton("dozen2", "2nd 12 (3x)")}
            {renderBetButton("dozen3", "3rd 12 (3x)")}
          </div>

          {/* Number grid (simplified - just a few numbers) */}
          <div className="text-xs text-gray-500 text-center">
            Or bet on a specific number (35x payout):
          </div>
          <div className="grid grid-cols-6 gap-1">
            {[0, 1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 36].map((num) => (
              <Button
                key={num}
                onClick={() => setSelectedBet({ type: "number", value: num })}
                disabled={spinning}
                className={`text-xs h-8 ${
                  selectedBet?.type === "number" && selectedBet?.value === num
                    ? "bg-yellow-400/30 border-2 border-yellow-400 text-yellow-400"
                    : num === 0
                    ? "bg-green-600/50 border border-green-500 text-green-300"
                    : "bg-gray-800/50 border border-gray-600 text-gray-300"
                }`}
              >
                {num}
              </Button>
            ))}
          </div>
        </div>

        {isAdmin && adminModeEnabled && (
          <div className="text-xs text-pink-400 text-center">
            Admin mode: Always win your selected bet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
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

const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "⭐", "💎", "7️⃣"];

export function Slots({ credits }: { credits: number }) {
  const [betAmount, setBetAmount] = useState(25);
  const [reels, setReels] = useState(["🍒", "🍋", "🍊"]);
  const [spinning, setSpinning] = useState(false);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);

  const spin = useMutation(api.casino.spinSlots);
  const user = useQuery(api.users.currentUser);
  const isAdmin = user?.role === "admin";

  const handleSpin = async () => {
    // Admin can play with 0 bet when admin mode is enabled
    if (!isAdmin && (betAmount <= 0 || betAmount > credits)) {
      toast.error("Invalid bet amount");
      return;
    }

    if (isAdmin && !adminModeEnabled && (betAmount <= 0 || betAmount > credits)) {
      toast.error("Invalid bet amount");
      return;
    }

    setSpinning(true);

    // Animate spinning
    const spinDuration = 2000;
    const spinInterval = 100;
    const spinCount = spinDuration / spinInterval;

    for (let i = 0; i < spinCount; i++) {
      setReels([
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      ]);
      await new Promise((resolve) => setTimeout(resolve, spinInterval));
    }

    try {
      const result = await spin({ betAmount: isAdmin && adminModeEnabled && betAmount === 0 ? 0 : betAmount });
      setReels(result.reels);

      if (result.result === "win") {
        toast.success(`🎉 You win ${result.payout} CR!`);
      } else {
        toast.error("No match. Try again!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to spin");
    } finally {
      setSpinning(false);
    }
  };

  return (
    <Card className="bg-gray-900/50 border-pink-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-pink-400 text-2xl">
            🎰 Cyber Slots 🎰
          </CardTitle>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-mode-slots" className="text-xs text-cyan-400">
                Admin Mode
              </Label>
              <Switch
                id="admin-mode-slots"
                checked={adminModeEnabled}
                onCheckedChange={setAdminModeEnabled}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Slot machine display */}
        <div className="bg-black/50 rounded-lg p-6 border-2 border-pink-500/50">
          <div className="flex justify-center gap-4 mb-6">
            {reels.map((symbol, i) => (
              <motion.div
                key={i}
                animate={spinning ? { y: [0, -20, 0] } : {}}
                transition={{ repeat: spinning ? Infinity : 0, duration: 0.2 }}
                className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border-2 border-cyan-400 flex items-center justify-center text-5xl"
              >
                {symbol}
              </motion.div>
            ))}
          </div>

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
              disabled={spinning || (isAdmin && adminModeEnabled ? false : (betAmount <= 0 || betAmount > credits))}
              className="bg-pink-500/20 border border-pink-500 text-pink-400 hover:bg-pink-500/30 px-8"
            >
              {spinning ? "SPINNING..." : "SPIN"}
            </Button>
          </div>
        </div>

        {/* Payout table */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
          <div className="text-sm text-gray-400 mb-2 font-bold">Payout Table:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl">7️⃣7️⃣7️⃣</span>
              <span className="text-green-400">10x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">💎💎💎</span>
              <span className="text-green-400">7x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⭐⭐⭐</span>
              <span className="text-green-400">5x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🍊🍊🍊</span>
              <span className="text-green-400">3x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🍋🍋🍋</span>
              <span className="text-green-400">2x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🍒🍒🍒</span>
              <span className="text-green-400">1.5x</span>
            </div>
          </div>
          {isAdmin && adminModeEnabled && (
            <div className="mt-2 text-xs text-pink-400 text-center">
              Admin mode: Always get 7️⃣7️⃣7️⃣
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
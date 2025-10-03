import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { toast } from "sonner";

type RaceStep = number[]; // positions for each horse
type RaceResult = {
  gameId: string;
  raceLog: RaceStep[];
  winner: number; // 1-5
  selectedHorse: number;
  payout: number;
  result: "win" | "loss";
};

const HORSES = [1, 2, 3, 4, 5] as const;
const COLORS = ["#22d3ee", "#f43f5e", "#a78bfa", "#f59e0b", "#34d399"] as const;

export function HorseRacing({ credits }: { credits: number }) {
  const [betAmount, setBetAmount] = useState(25);
  const [selectedHorse, setSelectedHorse] = useState<number>(1);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);
  const [racing, setRacing] = useState(false);
  const [raceLog, setRaceLog] = useState<RaceStep[] | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const runRace = useMutation(api.casino.runHorseRace);
  const user = useQuery(api.users.currentUser);
  const isAdmin = user?.role === "admin";

  const maxTrack = 100; // UI width basis

  const currentPositions = useMemo(() => {
    if (!raceLog) return HORSES.map(() => 0);
    return raceLog[Math.min(stepIndex, raceLog.length - 1)];
  }, [raceLog, stepIndex]);

  const handleRun = async () => {
    if (!selectedHorse) {
      toast.error("Pick a horse first");
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

    setRacing(true);
    setRaceLog(null);
    setWinner(null);
    setStepIndex(0);

    try {
      const res: RaceResult = await runRace({
        betAmount: isAdmin && adminModeEnabled && betAmount === 0 ? 0 : betAmount,
        selectedHorse,
        adminMode: isAdmin ? adminModeEnabled : undefined,
      });

      setRaceLog(res.raceLog);
      setWinner(res.winner);

      // Play back animation steps
      let i = 0;
      const interval = setInterval(() => {
        i += 1;
        setStepIndex(i);
        if (!res.raceLog || i >= res.raceLog.length - 1) {
          clearInterval(interval);
          setRacing(false);
          if (res.result === "win") {
            toast.success(`🏆 Horse ${res.winner} wins! You won ${res.payout} CR`);
          } else {
            toast.error(`Horse ${res.winner} wins. Better luck next time!`);
          }
        }
      }, 150);
    } catch (e) {
      setRacing(false);
      toast.error(e instanceof Error ? e.message : "Failed to run race");
    }
  };

  return (
    <Card className="bg-gray-900/50 border-amber-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-amber-400 text-2xl">🐎 Horse Racing 🐎</CardTitle>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-mode-horse" className="text-xs text-pink-400">
                Admin Mode
              </Label>
              <Switch
                id="admin-mode-horse"
                checked={adminModeEnabled}
                onCheckedChange={setAdminModeEnabled}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <div className="text-sm text-gray-400">Choose Your Horse</div>
            <div className="grid grid-cols-5 gap-2">
              {HORSES.map((h, idx) => (
                <Button
                  key={h}
                  onClick={() => setSelectedHorse(h)}
                  className={`h-9 text-xs ${selectedHorse === h
                    ? "bg-yellow-400/30 border-2 border-yellow-400 text-yellow-400"
                    : "bg-gray-800/50 border border-gray-600 text-gray-300 hover:bg-gray-700/50"
                  }`}
                  style={{ borderColor: selectedHorse === h ? undefined : COLORS[idx] }}
                >
                  #{h}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-400">Bet Amount</div>
            <Input
              type="number"
              min={isAdmin && adminModeEnabled ? 0 : 1}
              max={credits}
              value={betAmount}
              onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
              disabled={racing}
              className="bg-gray-800 border-gray-600 text-white"
              placeholder="Bet amount"
            />
            {isAdmin && adminModeEnabled && (
              <div className="text-xs text-pink-400">Admin mode: Can bet 0 and always win.</div>
            )}
          </div>

          <div className="flex md:justify-end">
            <Button
              onClick={handleRun}
              disabled={racing || (isAdmin && adminModeEnabled ? false : (betAmount <= 0 || betAmount > credits))}
              className="bg-amber-500/20 border border-amber-500 text-amber-400 hover:bg-amber-500/30 w-full md:w-auto px-8"
            >
              {racing ? "RACING..." : "RACE"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {HORSES.map((h, idx) => {
            const pos = currentPositions[idx] ?? 0;
            const percent = Math.min(100, Math.max(0, (pos / maxTrack) * 100));
            return (
              <div key={h} className="space-y-1">
                <div className="text-xs text-gray-400 flex justify-between">
                  <span>Horse #{h}</span>
                  {winner && winner === h && !racing && (
                    <span className="text-amber-400">WINNER</span>
                  )}
                </div>
                <div className="w-full h-3 bg-gray-800/70 rounded overflow-hidden border border-gray-700">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.14 }}
                    className="h-full"
                    style={{ backgroundColor: COLORS[idx] }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-gray-500 text-center">
          Pick a horse and run the race. Payout if your horse wins is 5x your bet.
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, Building2 } from "lucide-react";

export function Bank() {
  const character = useQuery(api.characters.getCharacter);
  const bankAccount = useQuery(api.bank.getBankAccount);
  const depositMutation = useMutation(api.bank.deposit);
  const withdrawMutation = useMutation(api.bank.withdraw);

  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);

  const handleDeposit = async () => {
    if (!depositAmount || depositAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    try {
      await depositMutation({ amount: depositAmount });
      toast.success(`Deposited ${depositAmount} CR`);
      setDepositAmount(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deposit");
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || withdrawAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    try {
      await withdrawMutation({ amount: withdrawAmount });
      toast.success(`Withdrew ${withdrawAmount} CR`);
      setWithdrawAmount(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to withdraw");
    }
  };

  return (
    <Card className="bg-gray-900/50 border-cyan-400/30">
      <CardHeader>
        <CardTitle className="text-cyan-400 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Bank
        </CardTitle>
        <CardDescription className="text-gray-400">
          Store your credits securely
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-cyan-300/80">
          Earns 2.5% interest per day automatically on your bank balance.
        </div>

        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-800/40 rounded border border-gray-700">
          <div>
            <div className="text-xs text-gray-500 uppercase">Wallet</div>
            <div className="text-lg font-bold text-green-400 flex items-center gap-1">
              <Coins className="w-4 h-4" />
              {character?.credits ?? 0} CR
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Bank Balance</div>
            <div className="text-lg font-bold text-cyan-400 flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {bankAccount?.balance ?? 0} CR
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="deposit" className="text-cyan-400">Deposit</Label>
            <div className="flex gap-2">
              <Input
                id="deposit"
                type="number"
                min={1}
                value={depositAmount || ""}
                onChange={(e) => setDepositAmount(parseInt(e.target.value) || 0)}
                placeholder="Amount"
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Button
                onClick={handleDeposit}
                disabled={!depositAmount || depositAmount <= 0}
                className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
              >
                Deposit
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="withdraw" className="text-cyan-400">Withdraw</Label>
            <div className="flex gap-2">
              <Input
                id="withdraw"
                type="number"
                min={1}
                value={withdrawAmount || ""}
                onChange={(e) => setWithdrawAmount(parseInt(e.target.value) || 0)}
                placeholder="Amount"
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || withdrawAmount <= 0}
                className="bg-green-400/20 border border-green-400 text-green-400 hover:bg-green-400/30"
              >
                Withdraw
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
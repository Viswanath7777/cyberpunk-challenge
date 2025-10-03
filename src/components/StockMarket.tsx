import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp, RefreshCw } from "lucide-react";

export function StockMarket() {
  const tickers = useQuery(api.stocks.listTickers);
  const holdings = useQuery(api.stocks.getHoldings);
  const syncMarket = useMutation(api.stocks.syncMarket);
  const buyMutation = useMutation(api.stocks.buy);
  const sellMutation = useMutation(api.stocks.sell);
  const seedMarket = useMutation(api.stocks.seedTickers);

  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [buyShares, setBuyShares] = useState<number>(0);
  const [sellShares, setSellShares] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const selectedTicker = tickers?.find((t) => t.symbol === selectedSymbol);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncMarket({});
      toast.success("Market updated");
    } catch (e) {
      toast.error("Failed to sync market");
    } finally {
      setSyncing(false);
    }
  };

  const handleBuy = async () => {
    if (!selectedSymbol || !buyShares || buyShares <= 0) {
      toast.error("Select a stock and enter shares");
      return;
    }

    try {
      await buyMutation({ symbol: selectedSymbol, shares: buyShares });
      toast.success(`Bought ${buyShares} shares of ${selectedSymbol}`);
      setBuyShares(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to buy");
    }
  };

  const handleSell = async () => {
    if (!selectedSymbol || !sellShares || sellShares <= 0) {
      toast.error("Select a stock and enter shares");
      return;
    }

    try {
      await sellMutation({ symbol: selectedSymbol, shares: sellShares });
      toast.success(`Sold ${sellShares} shares of ${selectedSymbol}`);
      setSellShares(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sell");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedMarket({});
      toast.success("Market initialized");
    } catch (e) {
      toast.error("Failed to initialize market");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Card className="bg-gray-900/50 border-green-400/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-green-400 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Stock Market
            </CardTitle>
            <CardDescription className="text-gray-400">
              Invest in cyberpunk corporations
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tickers List */}
        <div className="space-y-2">
          <div className="text-sm text-cyan-400 font-bold">Available Stocks</div>
          <div className="grid gap-2">
            {tickers && tickers.length === 0 ? (
              <div className="p-4 rounded border bg-gray-800/40 border-gray-700 text-center space-y-2">
                <div className="text-sm text-gray-400">
                  No stocks available yet.
                </div>
                <Button
                  size="sm"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                >
                  {seeding ? "Initializing..." : "Initialize Market"}
                </Button>
              </div>
            ) : (
              <>
                {tickers?.map((ticker) => (
                  <button
                    key={ticker.symbol}
                    onClick={() => setSelectedSymbol(ticker.symbol)}
                    className={`p-3 rounded border text-left transition-all ${
                      selectedSymbol === ticker.symbol
                        ? "bg-cyan-400/20 border-cyan-400"
                        : "bg-gray-800/40 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-cyan-400">{ticker.symbol}</div>
                        <div className="text-xs text-gray-500">{ticker.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-bold">{ticker.price.toFixed(2)} CR</div>
                        {ticker.history.length > 1 && (
                          <div className="text-xs text-gray-500">
                            {ticker.history[ticker.history.length - 1].v > ticker.history[0].v ? "📈" : "📉"}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Trading Interface */}
        {selectedTicker && (
          <div className="p-4 bg-gray-800/40 rounded border border-gray-700 space-y-3">
            <div className="text-sm font-bold text-cyan-400">
              Trading: {selectedTicker.symbol} @ {selectedTicker.price.toFixed(2)} CR
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="buy" className="text-green-400">Buy Shares</Label>
                <div className="flex gap-2">
                  <Input
                    id="buy"
                    type="number"
                    min={1}
                    value={buyShares || ""}
                    onChange={(e) => setBuyShares(parseInt(e.target.value) || 0)}
                    placeholder="Shares"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Button
                    onClick={handleBuy}
                    disabled={!buyShares || buyShares <= 0}
                    className="bg-green-400/20 border border-green-400 text-green-400 hover:bg-green-400/30"
                  >
                    Buy
                  </Button>
                </div>
                {buyShares > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Cost: {(buyShares * selectedTicker.price).toFixed(2)} CR
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="sell" className="text-red-400">Sell Shares</Label>
                <div className="flex gap-2">
                  <Input
                    id="sell"
                    type="number"
                    min={1}
                    value={sellShares || ""}
                    onChange={(e) => setSellShares(parseInt(e.target.value) || 0)}
                    placeholder="Shares"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Button
                    onClick={handleSell}
                    disabled={!sellShares || sellShares <= 0}
                    className="bg-red-400/20 border border-red-400 text-red-400 hover:bg-red-400/30"
                  >
                    Sell
                  </Button>
                </div>
                {sellShares > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Proceeds: {(sellShares * selectedTicker.price).toFixed(2)} CR
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Holdings */}
        <div className="space-y-2">
          <div className="text-sm text-purple-400 font-bold">Your Portfolio</div>
          {holdings && holdings.length > 0 ? (
            <div className="space-y-2">
              {holdings.map((h) => (
                <div
                  key={h.symbol}
                  className="p-3 bg-gray-800/40 rounded border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-cyan-400">{h.symbol}</div>
                      <div className="text-xs text-gray-500">
                        {h.shares} shares @ {h.avgCost.toFixed(2)} CR avg
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white">{h.marketValue.toFixed(2)} CR</div>
                      <div
                        className={`text-xs font-bold ${
                          h.pnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {h.pnl >= 0 ? "+" : ""}
                        {h.pnl.toFixed(2)} CR
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              No holdings yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
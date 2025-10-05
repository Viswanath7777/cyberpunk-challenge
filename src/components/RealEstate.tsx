import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";
import { Building2, TrendingUp, TrendingDown, Home } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RealEstate() {
  const properties = useQuery(api.realEstate.listProperties);
  const userProperties = useQuery(api.realEstate.getUserProperties);
  const playerListings = useQuery(api.realEstate.getPlayerListings);
  const marketEvents = useQuery(api.realEstate.getMarketEvents);

  const buyProperty = useMutation(api.realEstate.buyProperty);
  const sellProperty = useMutation(api.realEstate.sellProperty);
  const listForSale = useMutation(api.realEstate.listPropertyForSale);
  const delistProperty = useMutation(api.realEstate.delistProperty);
  const buyFromPlayer = useMutation(api.realEstate.buyFromPlayer);
  const seedProperties = useMutation(api.realEstate.seedProperties);

  const [askingPrices, setAskingPrices] = useState<Record<string, number>>({});

  const handleBuy = async (propertyId: string) => {
    try {
      await buyProperty({ propertyId: propertyId as any });
      toast.success("Property purchased!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to buy property");
    }
  };

  const handleSell = async (propertyId: string) => {
    try {
      await sellProperty({ propertyId: propertyId as any });
      toast.success("Property sold back to market!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sell property");
    }
  };

  const handleListForSale = async (propertyId: string) => {
    const price = askingPrices[propertyId];
    if (!price || price <= 0) {
      toast.error("Enter a valid asking price");
      return;
    }
    try {
      await listForSale({ propertyId: propertyId as any, askingPrice: price });
      toast.success("Property listed for sale!");
      setAskingPrices((prev) => ({ ...prev, [propertyId]: 0 }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to list property");
    }
  };

  const handleDelist = async (propertyId: string) => {
    try {
      await delistProperty({ propertyId: propertyId as any });
      toast.success("Property delisted!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delist property");
    }
  };

  const handleBuyFromPlayer = async (propertyId: string) => {
    try {
      await buyFromPlayer({ propertyId: propertyId as any });
      toast.success("Property purchased from player!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to buy property");
    }
  };

  const handleSeedMarket = async () => {
    try {
      await seedProperties({});
      toast.success("Real estate market initialized with 50 properties!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed market");
    }
  };

  if (!properties || properties.length === 0) {
    return (
      <Card className="bg-gray-900/50 border-cyan-400/30">
        <CardHeader>
          <CardTitle className="text-cyan-400">Real Estate Market</CardTitle>
          <CardDescription className="text-gray-400">
            No properties available. Initialize the market to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSeedMarket}
            className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
          >
            Initialize Real Estate Market (50 Properties)
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/50 border-cyan-400/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Real Estate Market
            </CardTitle>
            <CardDescription className="text-gray-400">
              Buy, sell, and trade Mumbai properties
            </CardDescription>
          </div>
          <Button
            onClick={handleSeedMarket}
            variant="outline"
            size="sm"
            className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
          >
            Re-initialize Market
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="market" className="space-y-4">
          <TabsList className="bg-gray-800/50">
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="player-listings">Player Listings</TabsTrigger>
            <TabsTrigger value="my-properties">My Properties</TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="space-y-3 max-h-[500px] overflow-y-auto">
            {properties
              ?.filter((p) => p.status === "available" && !p.ownerId)
              .map((property) => (
                <div
                  key={property._id}
                  className="p-4 bg-gray-800/40 rounded border border-gray-700 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-cyan-400 font-bold">{property.name}</div>
                      <div className="text-xs text-gray-500">{property.location}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        {property.bedrooms > 0 ? `${property.bedrooms} BR` : "Studio"} • {property.bathrooms} BA • {property.sqft} sqft
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {property.amenities.join(", ")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold text-lg">
                        {property.currentPrice.toLocaleString()} CR
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleBuy(property._id)}
                        className="mt-2 bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                      >
                        Buy
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </TabsContent>

          <TabsContent value="player-listings" className="space-y-3 max-h-[500px] overflow-y-auto">
            {playerListings && playerListings.length > 0 ? (
              playerListings.map((property) => (
                <div
                  key={property._id}
                  className="p-4 bg-gray-800/40 rounded border border-purple-500/30 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-cyan-400 font-bold">{property.name}</div>
                      <div className="text-xs text-purple-400">Seller: {property.ownerName}</div>
                      <div className="text-xs text-gray-500">{property.location}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        {property.bedrooms > 0 ? `${property.bedrooms} BR` : "Studio"} • {property.bathrooms} BA • {property.sqft} sqft
                      </div>
                      <div className="text-xs text-gray-500">
                        Original: {property.originalPrice.toLocaleString()} CR
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold text-lg">
                        {property.askingPrice?.toLocaleString()} CR
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleBuyFromPlayer(property._id)}
                        className="mt-2 bg-purple-500/20 border border-purple-500 text-purple-400 hover:bg-purple-500/30"
                      >
                        Buy from Player
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">No player listings available</div>
            )}
          </TabsContent>

          <TabsContent value="my-properties" className="space-y-4">
            {userProperties && userProperties.properties.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-800/40 rounded border border-green-500/30">
                  <div>
                    <div className="text-xs text-gray-500">Total Value</div>
                    <div className="text-green-400 font-bold">
                      {userProperties.totalValue.toLocaleString()} CR
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Invested</div>
                    <div className="text-cyan-400 font-bold">
                      {userProperties.totalInvested.toLocaleString()} CR
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Profit/Loss</div>
                    <div
                      className={`font-bold flex items-center gap-1 ${
                        userProperties.profitLoss >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {userProperties.profitLoss >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {userProperties.profitLoss.toLocaleString()} CR
                    </div>
                  </div>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {userProperties.properties.map((property) => (
                    <div
                      key={property._id}
                      className="p-4 bg-gray-800/40 rounded border border-green-500/30 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-cyan-400 font-bold">{property.name}</div>
                          <div className="text-xs text-gray-500">{property.location}</div>
                          <div className="text-sm text-gray-400 mt-1">
                            {property.bedrooms > 0 ? `${property.bedrooms} BR` : "Studio"} • {property.bathrooms} BA • {property.sqft} sqft
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-400 font-bold">
                            {property.currentPrice.toLocaleString()} CR
                          </div>
                          <div className="text-xs text-gray-500">
                            Bought: {property.basePrice.toLocaleString()} CR
                          </div>
                          <div
                            className={`text-xs ${
                              property.currentPrice - property.basePrice >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {property.currentPrice - property.basePrice >= 0 ? "+" : ""}
                            {(property.currentPrice - property.basePrice).toLocaleString()} CR
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {property.listedForSale ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelist(property._id)}
                            className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
                          >
                            Delist
                          </Button>
                        ) : (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                className="bg-purple-500/20 border border-purple-500 text-purple-400 hover:bg-purple-500/30"
                              >
                                List for Sale
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-gray-900 border-cyan-400/30">
                              <DialogHeader>
                                <DialogTitle className="text-cyan-400">List Property</DialogTitle>
                                <DialogDescription className="text-gray-400">
                                  Set an asking price for {property.name}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-cyan-400">Asking Price (CR)</Label>
                                  <Input
                                    type="number"
                                    value={askingPrices[property._id] || ""}
                                    onChange={(e) =>
                                      setAskingPrices((prev) => ({
                                        ...prev,
                                        [property._id]: parseInt(e.target.value) || 0,
                                      }))
                                    }
                                    placeholder={property.currentPrice.toString()}
                                    className="bg-gray-800 border-gray-600 text-white"
                                  />
                                </div>
                                <Button
                                  onClick={() => handleListForSale(property._id)}
                                  className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                                >
                                  List Property
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSell(property._id)}
                          className="border-red-500 text-red-500 hover:bg-red-500/10"
                        >
                          Sell to Market
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <div>You don't own any properties yet</div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {marketEvents && marketEvents.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-700">
            <div className="text-sm text-cyan-400 font-bold mb-2">Recent Market Events</div>
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {marketEvents.map((event) => (
                <div
                  key={event._id}
                  className="text-xs p-2 bg-gray-800/30 rounded border border-gray-700"
                >
                  <div className="text-yellow-400">{event.affectedArea}</div>
                  <div className="text-gray-400">{event.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

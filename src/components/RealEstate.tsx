import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, TrendingUp, TrendingDown, Users, Store } from "lucide-react";
import { toast } from "sonner";

export function RealEstate() {
  const properties = useQuery(api.realEstate.listProperties);
  const userProperties = useQuery(api.realEstate.getUserProperties) as
    | { properties: any[]; totalValue: number; totalInvested: number; profitLoss: number }
    | undefined;
  const playerListings = useQuery(api.realEstate.getPlayerListings);
  const marketEvents = useQuery(api.realEstate.getMarketEvents);

  const buyProperty = useMutation(api.realEstate.buyProperty);
  const sellProperty = useMutation(api.realEstate.sellProperty);
  const buyFromPlayer = useMutation(api.realEstate.buyFromPlayer);
  const listForSale = useMutation(api.realEstate.listPropertyForSale);
  const delistProperty = useMutation(api.realEstate.delistProperty);
  const seedProperties = useMutation(api.realEstate.seedProperties);

  const [askingPrices, setAskingPrices] = useState<Record<string, number>>({});

  const handleSeed = async () => {
    try {
      await seedProperties();
      toast.success("Real estate market initialized!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to initialize market");
    }
  };

  const handleBuy = async (propertyId: string) => {
    try {
      await buyProperty({ propertyId: propertyId as any });
      toast.success("Property purchased!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to purchase property");
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

  const handleBuyFromPlayer = async (propertyId: string) => {
    try {
      await buyFromPlayer({ propertyId: propertyId as any });
      toast.success("Property purchased from player!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to purchase");
    }
  };

  const handleListForSale = async (propertyId: string) => {
    const price = askingPrices[propertyId];
    if (!price || price < 1000) {
      toast.error("Enter a valid asking price (min 1000 CR)");
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
      toast.error(e instanceof Error ? e.message : "Failed to delist");
    }
  };

  const availableProperties = properties?.filter((p: any) => p.status === "available") || [];

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
              Buy properties, trade with players, and build your empire
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {(!properties || properties.length === 0) && (
              <Button
                onClick={handleSeed}
                className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
              >
                Initialize Real Estate Market
              </Button>
            )}
            {properties && properties.length > 0 && (
              <Button
                onClick={handleSeed}
                size="sm"
                variant="outline"
                className="border-pink-500 text-pink-500 hover:bg-pink-500/10"
              >
                Re-initialize Market
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="market" className="space-y-4">
          <TabsList className="bg-gray-800/50 border border-gray-700">
            <TabsTrigger value="market" className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-400">
              <Store className="w-4 h-4 mr-2" />
              Market
            </TabsTrigger>
            <TabsTrigger value="players" className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-400">
              <Users className="w-4 h-4 mr-2" />
              Player Listings ({playerListings?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-400">
              <Building2 className="w-4 h-4 mr-2" />
              My Properties ({userProperties?.properties?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Market Properties Tab */}
          <TabsContent value="market" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {availableProperties.map((property: any) => (
                <Card key={property._id} className="bg-gray-800/50 border-gray-700 hover:border-cyan-400/50 transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-cyan-400 text-lg">{property.name}</CardTitle>
                        <CardDescription className="text-gray-400 text-sm">{property.location}</CardDescription>
                      </div>
                      <Badge variant="outline" className="border-green-500 text-green-400">
                        {property.propertyType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-gray-300">{property.description}</div>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.slice(0, 3).map((amenity: string) => (
                        <Badge key={amenity} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>{property.bedrooms} BD • {property.bathrooms} BA</span>
                      <span>{property.sqft} sqft</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                      <div className="text-2xl font-bold text-green-400">{property.currentPrice} CR</div>
                      <Button
                        onClick={() => handleBuy(property._id)}
                        className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                      >
                        Buy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {availableProperties.length === 0 && (
              <div className="text-center py-8 text-gray-400">No properties available on the market</div>
            )}
          </TabsContent>

          {/* Player Listings Tab */}
          <TabsContent value="players" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {(playerListings || []).map((property: any) => {
                const profit = property.askingPrice - property.originalPurchasePrice;
                const profitPercent = ((profit / property.originalPurchasePrice) * 100).toFixed(1);
                
                return (
                  <Card key={property._id} className="bg-gray-800/50 border-pink-500/30 hover:border-pink-500/60 transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-pink-400 text-lg">{property.name}</CardTitle>
                          <CardDescription className="text-gray-400 text-sm">{property.location}</CardDescription>
                          <div className="text-xs text-gray-500 mt-1">Seller: {property.ownerName}</div>
                        </div>
                        <Badge variant="outline" className="border-pink-500 text-pink-400">
                          Player Listing
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-gray-300">{property.description}</div>
                      <div className="flex flex-wrap gap-2">
                        {property.amenities.slice(0, 3).map((amenity: string) => (
                          <Badge key={amenity} variant="secondary" className="text-xs">
                            {amenity}
                          </Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-400">
                          Original: <span className="text-gray-300">{property.originalPurchasePrice} CR</span>
                        </div>
                        <div className="text-gray-400">
                          Market: <span className="text-gray-300">{property.currentPrice} CR</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                        <div>
                          <div className="text-2xl font-bold text-pink-400">{property.askingPrice} CR</div>
                          <div className={`text-xs ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {profit >= 0 ? "+" : ""}{profitPercent}% vs purchase
                          </div>
                        </div>
                        <Button
                          onClick={() => handleBuyFromPlayer(property._id)}
                          className="bg-pink-400/20 border border-pink-400 text-pink-400 hover:bg-pink-400/30"
                        >
                          Buy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {(!playerListings || playerListings.length === 0) && (
              <div className="text-center py-8 text-gray-400">No player listings available</div>
            )}
          </TabsContent>

          {/* My Properties Tab */}
          <TabsContent value="portfolio" className="space-y-4">
            {userProperties && userProperties.properties && userProperties.properties.length > 0 && (
              <Card className="bg-gray-800/30 border-green-500/30">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-gray-400">Portfolio Value</div>
                      <div className="text-xl font-bold text-green-400">{userProperties.totalValue} CR</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Total Invested</div>
                      <div className="text-xl font-bold text-cyan-400">{userProperties.totalInvested} CR</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">P/L</div>
                      <div className={`text-xl font-bold ${userProperties.profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {userProperties.profitLoss >= 0 ? "+" : ""}{userProperties.profitLoss} CR
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {userProperties?.properties?.map((property: any) => {
                const purchasePrice = property.priceHistory.find((h: any) => h.event.includes("Purchased"))?.price || property.basePrice;
                const profitLoss = property.currentPrice - purchasePrice;
                const profitPercent = ((profitLoss / purchasePrice) * 100).toFixed(1);

                return (
                  <Card key={property._id} className="bg-gray-800/50 border-yellow-500/30">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-yellow-400 text-lg">{property.name}</CardTitle>
                          <CardDescription className="text-gray-400 text-sm">{property.location}</CardDescription>
                        </div>
                        {property.listedForSale && (
                          <Badge variant="outline" className="border-pink-500 text-pink-400">
                            Listed: {property.askingPrice} CR
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-400">
                          Purchased: <span className="text-gray-300">{purchasePrice} CR</span>
                        </div>
                        <div className="text-gray-400">
                          Current: <span className="text-gray-300">{property.currentPrice} CR</span>
                        </div>
                        <div className="col-span-2 text-gray-400">
                          P/L: <span className={profitLoss >= 0 ? "text-green-400" : "text-red-400"}>
                            {profitLoss >= 0 ? "+" : ""}{profitLoss} CR ({profitPercent}%)
                          </span>
                        </div>
                      </div>

                      {!property.listedForSale ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Asking price"
                              value={askingPrices[property._id] || ""}
                              onChange={(e) =>
                                setAskingPrices((prev) => ({
                                  ...prev,
                                  [property._id]: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="bg-gray-900 border-gray-700 text-white"
                            />
                            <Button
                              onClick={() => handleListForSale(property._id)}
                              className="bg-pink-400/20 border border-pink-400 text-pink-400 hover:bg-pink-400/30"
                            >
                              List
                            </Button>
                          </div>
                          <Button
                            onClick={() => handleSell(property._id)}
                            variant="outline"
                            className="w-full border-red-500 text-red-500 hover:bg-red-500/10"
                          >
                            Sell to Market
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleDelist(property._id)}
                          variant="outline"
                          className="w-full border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
                        >
                          Delist
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {(!userProperties?.properties || userProperties.properties.length === 0) && (
              <div className="text-center py-8 text-gray-400">You don't own any properties yet</div>
            )}
          </TabsContent>
        </Tabs>

        {/* Market Events */}
        {marketEvents && marketEvents.length > 0 && (
          <Card className="mt-4 bg-gray-800/30 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-purple-400 text-sm">Recent Market Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {marketEvents.slice(0, 5).map((event: any) => (
                <div key={event._id} className="flex items-center justify-between text-sm p-2 bg-gray-900/30 rounded">
                  <div className="flex items-center gap-2">
                    {event.priceImpact > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-gray-300">{event.description}</span>
                  </div>
                  <span className="text-xs text-gray-500">{event.affectedArea}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
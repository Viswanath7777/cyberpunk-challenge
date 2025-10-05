import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, TrendingUp, RefreshCw } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

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

  const [listingPrice, setListingPrice] = useState<Record<string, number>>({});
  const [seeding, setSeeding] = useState(false);

  const handleBuy = async (propertyId: Id<"properties">) => {
    try {
      await buyProperty({ propertyId });
      toast.success("Property purchased successfully!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to buy property");
    }
  };

  const handleSell = async (propertyId: Id<"properties">) => {
    try {
      await sellProperty({ propertyId });
      toast.success("Property sold back to market!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sell property");
    }
  };

  const handleList = async (propertyId: Id<"properties">) => {
    const price = listingPrice[propertyId];
    if (!price || price < 1000) {
      toast.error("Enter a valid asking price (min 1000 CR)");
      return;
    }

    try {
      await listForSale({ propertyId, askingPrice: price });
      toast.success("Property listed for sale!");
      setListingPrice((prev) => ({ ...prev, [propertyId]: 0 }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to list property");
    }
  };

  const handleDelist = async (propertyId: Id<"properties">) => {
    try {
      await delistProperty({ propertyId });
      toast.success("Property delisted!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delist property");
    }
  };

  const handleBuyFromPlayer = async (propertyId: Id<"properties">) => {
    try {
      await buyFromPlayer({ propertyId });
      toast.success("Property purchased from player!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to buy from player");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedProperties({});
      toast.success("Real estate market initialized!");
    } catch (e) {
      toast.error("Failed to initialize market");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Card className="bg-gray-900/50 border-purple-400/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-purple-400 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Real Estate Market
            </CardTitle>
            <CardDescription className="text-gray-400">
              Buy, sell, and trade Mumbai properties
            </CardDescription>
          </div>
          {properties && properties.length === 0 && (
            <Button
              size="sm"
              onClick={handleSeed}
              disabled={seeding}
              className="bg-purple-400/20 border border-purple-400 text-purple-400 hover:bg-purple-400/30"
            >
              {seeding ? "Initializing..." : "Initialize Real Estate Market"}
            </Button>
          )}
          {properties && properties.length > 0 && (
            <Button
              size="sm"
              onClick={handleSeed}
              disabled={seeding}
              className="bg-red-400/20 border border-red-400 text-red-400 hover:bg-red-400/30"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${seeding ? "animate-spin" : ""}`} />
              Re-initialize Market
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Market Events */}
        {marketEvents && marketEvents.length > 0 && (
          <div className="p-3 bg-yellow-400/10 border border-yellow-400/30 rounded">
            <div className="text-sm font-bold text-yellow-400 mb-2">Recent Market Events</div>
            <div className="space-y-1 text-xs text-gray-300">
              {marketEvents.slice(0, 3).map((event: any) => (
                <div key={event._id}>
                  • {event.description} ({event.affectedArea}) - {event.priceImpact > 0 ? "+" : ""}{event.priceImpact.toFixed(1)}%
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="market" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="players">Player Listings</TabsTrigger>
            <TabsTrigger value="portfolio">My Properties</TabsTrigger>
          </TabsList>

          {/* Market Properties Tab */}
          <TabsContent value="market" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {properties?.filter((p: any) => p.status === "available" && !p.ownerId).map((property: any) => {
                return (
                  <Card key={property._id} className="bg-gray-800/50 border-gray-700 hover:border-cyan-400/50 transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-cyan-400 text-lg">{property.name}</CardTitle>
                          <CardDescription className="text-gray-400 text-sm">
                            {property.location}
                          </CardDescription>
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
                          size="sm"
                          onClick={() => handleBuy(property._id)}
                          disabled={!!property.ownerId}
                          className={`${
                            property.ownerId
                              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                              : "bg-green-400/20 border border-green-400 text-green-400 hover:bg-green-400/30"
                          }`}
                        >
                          {property.ownerId ? "Owned" : "Buy"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {(!properties || properties.filter((p: any) => p.status === "available" && !p.ownerId).length === 0) && (
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
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-gray-500">Original Price</div>
                          <div className="text-gray-300">{property.originalPurchasePrice} CR</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Asking Price</div>
                          <div className="text-pink-400 font-bold">{property.askingPrice} CR</div>
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {profit >= 0 ? "+" : ""}{profit} CR ({profitPercent}%)
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleBuyFromPlayer(property._id)}
                        className="w-full bg-pink-400/20 border border-pink-400 text-pink-400 hover:bg-pink-400/30"
                      >
                        Buy from Player
                      </Button>
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
            {userProperties && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-800/40 rounded border border-gray-700">
                <div>
                  <div className="text-xs text-gray-500 uppercase">Total Value</div>
                  <div className="text-lg font-bold text-cyan-400">{userProperties.totalValue} CR</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Invested</div>
                  <div className="text-lg font-bold text-gray-300">{userProperties.totalInvested} CR</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Profit/Loss</div>
                  <div className={`text-lg font-bold ${userProperties.profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {userProperties.profitLoss >= 0 ? "+" : ""}{userProperties.profitLoss} CR
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {userProperties?.properties.map((property: any) => {
                const purchasePrice = property.priceHistory[0]?.price || property.basePrice;
                const profitLoss = property.currentPrice - purchasePrice;
                return (
                  <Card key={property._id} className="bg-gray-800/50 border-purple-500/30">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-purple-400 text-lg">{property.name}</CardTitle>
                          <CardDescription className="text-gray-400 text-sm">{property.location}</CardDescription>
                        </div>
                        <Badge variant="outline" className="border-purple-500 text-purple-400">
                          {property.propertyType}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-gray-500">Purchase Price</div>
                          <div className="text-gray-300">{purchasePrice} CR</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Current Value</div>
                          <div className="text-cyan-400 font-bold">{property.currentPrice} CR</div>
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {profitLoss >= 0 ? "+" : ""}{profitLoss} CR
                      </div>

                      {property.listedForSale ? (
                        <div className="space-y-2">
                          <div className="text-sm text-yellow-400">Listed for {property.askingPrice} CR</div>
                          <Button
                            size="sm"
                            onClick={() => handleDelist(property._id)}
                            className="w-full bg-yellow-400/20 border border-yellow-400 text-yellow-400 hover:bg-yellow-400/30"
                          >
                            Delist
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="Asking price"
                              value={listingPrice[property._id] || ""}
                              onChange={(e) =>
                                setListingPrice((prev) => ({
                                  ...prev,
                                  [property._id]: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="bg-gray-800 border-gray-600 text-white"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleList(property._id)}
                              className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                            >
                              List
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSell(property._id)}
                            className="w-full bg-red-400/20 border border-red-400 text-red-400 hover:bg-red-400/30"
                          >
                            Sell to Market
                          </Button>
                        </div>
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
      </CardContent>
    </Card>
  );
}

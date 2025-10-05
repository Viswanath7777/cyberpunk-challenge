import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Home, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function RealEstate() {
  const marketProperties = useQuery(api.realEstate.getMarketProperties);
  const playerListings = useQuery(api.realEstate.getPlayerListings);
  const myProperties = useQuery(api.realEstate.getMyProperties);
  const activeEvents = useQuery(api.realEstate.getActiveEvents);

  const seedProperties = useMutation(api.realEstate.seedProperties);
  const buyFromMarket = useMutation(api.realEstate.buyFromMarket);
  const buyFromPlayer = useMutation(api.realEstate.buyFromPlayer);
  const listForSale = useMutation(api.realEstate.listForSale);
  const unlistFromSale = useMutation(api.realEstate.unlistFromSale);
  const sellToBank = useMutation(api.realEstate.sellToBank);

  const [listingPrices, setListingPrices] = useState<Record<string, number>>({});
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedMarket = async () => {
    setIsSeeding(true);
    try {
      await seedProperties({});
      toast.success("Market initialized with 50 properties!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to seed market");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleBuyFromMarket = async (propertyId: string) => {
    try {
      await buyFromMarket({ propertyId: propertyId as any });
      toast.success("Property purchased successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to purchase property");
    }
  };

  const handleBuyFromPlayer = async (propertyId: string) => {
    try {
      await buyFromPlayer({ propertyId: propertyId as any });
      toast.success("Property purchased from player!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to purchase property");
    }
  };

  const handleListForSale = async (propertyId: string) => {
    const price = listingPrices[propertyId];
    if (!price || price <= 0) {
      toast.error("Enter a valid sale price");
      return;
    }

    try {
      await listForSale({ propertyId: propertyId as any, salePrice: price });
      toast.success("Property listed for sale!");
      setListingPrices((prev) => {
        const updated = { ...prev };
        delete updated[propertyId];
        return updated;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to list property");
    }
  };

  const handleUnlist = async (propertyId: string) => {
    try {
      await unlistFromSale({ propertyId: propertyId as any });
      toast.success("Property unlisted from sale");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlist property");
    }
  };

  const handleSellToBank = async (propertyId: string) => {
    try {
      const result = await sellToBank({ propertyId: propertyId as any });
      toast.success(`Sold to bank for ${result.amount} credits (80% of market value)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sell property");
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Market Events */}
      {activeEvents && activeEvents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Active Market Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeEvents.map((event) => (
                <div key={event._id} className="p-3 bg-gray-800/50 rounded border border-yellow-500/30">
                  <div className="font-bold text-yellow-400">{event.eventType}</div>
                  <div className="text-sm text-gray-400">{event.description}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Area: {event.affectedArea} • Impact: {event.priceImpact > 0 ? "+" : ""}{event.priceImpact}%
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Initialize Market Button */}
      {marketProperties !== undefined && marketProperties !== null && marketProperties.length === 0 && (
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="p-6 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <h3 className="text-xl font-bold text-purple-400 mb-2">No Properties Available</h3>
            <p className="text-gray-400 mb-4">Initialize the real estate market to get started</p>
            <Button
              onClick={handleSeedMarket}
              disabled={isSeeding}
              className="bg-purple-500/20 border border-purple-500 text-purple-500 hover:bg-purple-500/30"
            >
              {isSeeding ? "Initializing..." : "Initialize Market (50 Properties)"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Property Tabs */}
      <Tabs defaultValue="market" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800/50">
          <TabsTrigger value="market">Market</TabsTrigger>
          <TabsTrigger value="listings">Player Listings</TabsTrigger>
          <TabsTrigger value="owned">My Properties</TabsTrigger>
        </TabsList>

        {/* Market Properties */}
        <TabsContent value="market" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketProperties && marketProperties.length > 0 ? (
              marketProperties.map((property) => (
                <Card key={property._id} className="bg-gray-800/50 border-cyan-400/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400 flex items-center gap-2">
                      <Home className="w-5 h-5" />
                      {property.name}
                    </CardTitle>
                    <CardDescription className="text-gray-400">{property.location}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-gray-300">
                      {property.bedrooms > 0 ? `${property.bedrooms} BR` : "Studio"} • {property.bathrooms} BA • {property.sqft} sqft
                    </div>
                    <div className="text-xs text-gray-500">
                      {property.amenities.join(", ")}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-2xl font-bold text-green-400">
                        {property.currentPrice.toLocaleString()} CR
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleBuyFromMarket(property._id)}
                        className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                      >
                        Buy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-gray-400">
                {marketProperties === undefined || marketProperties === null ? "Loading..." : "No properties available"}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Player Listings */}
        <TabsContent value="listings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playerListings && playerListings.length > 0 ? (
              playerListings.map((property) => (
                <Card key={property._id} className="bg-gray-800/50 border-pink-500/30">
                  <CardHeader>
                    <CardTitle className="text-pink-500 flex items-center gap-2">
                      <Home className="w-5 h-5" />
                      {property.name}
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      {property.location} • Seller: {property.ownerName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-gray-300">
                      {property.bedrooms > 0 ? `${property.bedrooms} BR` : "Studio"} • {property.bathrooms} BA • {property.sqft} sqft
                    </div>
                    <div className="text-xs text-gray-500">
                      {property.amenities.join(", ")}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-2xl font-bold text-green-400">
                        {property.salePrice?.toLocaleString()} CR
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleBuyFromPlayer(property._id)}
                        className="bg-pink-500/20 border border-pink-500 text-pink-500 hover:bg-pink-500/30"
                      >
                        Buy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-gray-400">
                No player listings available
              </div>
            )}
          </div>
        </TabsContent>

        {/* My Properties */}
        <TabsContent value="owned" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myProperties && myProperties.length > 0 ? (
              myProperties.map((property) => (
                <Card key={property._id} className="bg-gray-800/50 border-green-500/30">
                  <CardHeader>
                    <CardTitle className="text-green-500 flex items-center gap-2">
                      <Home className="w-5 h-5" />
                      {property.name}
                    </CardTitle>
                    <CardDescription className="text-gray-400">{property.location}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-gray-300">
                      {property.bedrooms > 0 ? `${property.bedrooms} BR` : "Studio"} • {property.bathrooms} BA • {property.sqft} sqft
                    </div>
                    <div className="text-xs text-gray-500">
                      {property.amenities.join(", ")}
                    </div>
                    <div className="text-sm text-gray-400">
                      Market Value: {property.currentPrice.toLocaleString()} CR
                    </div>
                    {property.listedForSale && (
                      <div className="text-sm text-yellow-400">
                        Listed for: {property.salePrice?.toLocaleString()} CR
                      </div>
                    )}
                    <div className="space-y-2 pt-2">
                      {!property.listedForSale ? (
                        <>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="Sale price"
                              value={listingPrices[property._id] || ""}
                              onChange={(e) =>
                                setListingPrices((prev) => ({
                                  ...prev,
                                  [property._id]: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="bg-gray-800 border-gray-600 text-white"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleListForSale(property._id)}
                              className="bg-green-500/20 border border-green-500 text-green-500 hover:bg-green-500/30"
                            >
                              List
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSellToBank(property._id)}
                            className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
                          >
                            Sell to Bank (80%)
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnlist(property._id)}
                          className="w-full border-red-500 text-red-500 hover:bg-red-500/10"
                        >
                          Unlist
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-gray-400">
                You don't own any properties yet
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
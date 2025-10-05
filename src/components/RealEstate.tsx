import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, Home, Users, TrendingUp, MapPin, Bed, Bath, Maximize, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function RealEstate() {
  const properties = useQuery(api.realEstate.listProperties);
  const myProperties = useQuery(api.realEstate.myProperties);
  const playerListings = useQuery(api.realEstate.playerListings);
  const activeEvents = useQuery(api.realEstate.getActiveEvents);
  
  const buyProperty = useMutation(api.realEstate.buyProperty);
  const listForSale = useMutation(api.realEstate.listPropertyForSale);
  const unlistProperty = useMutation(api.realEstate.unlistProperty);
  const sellToBank = useMutation(api.realEstate.sellToBank);
  const seedProperties = useMutation(api.realEstate.seedProperties);

  const [listingPrices, setListingPrices] = useState<Record<string, number>>({});

  const handleBuy = async (propertyId: string) => {
    try {
      await buyProperty({ propertyId: propertyId as any });
      toast.success("Property purchased successfully!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to buy property");
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to list property");
    }
  };

  const handleUnlist = async (propertyId: string) => {
    try {
      await unlistProperty({ propertyId: propertyId as any });
      toast.success("Property unlisted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unlist");
    }
  };

  const handleSellToBank = async (propertyId: string) => {
    try {
      const result = await sellToBank({ propertyId: propertyId as any });
      toast.success(`Sold to bank for ${result.amount.toLocaleString()} CR`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sell");
    }
  };

  const handleSeedMarket = async () => {
    try {
      await seedProperties({});
      toast.success("Market initialized with 50 properties!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed market");
    }
  };

  const PropertyCard = ({ property, showBuyButton = false, showOwnerActions = false }: any) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 bg-gray-800/50 rounded-lg border border-cyan-400/30 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-cyan-400 font-bold">{property.name}</h3>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-400 mt-1">
            <MapPin className="w-4 h-4" />
            {property.location}
          </div>
        </div>
        <div className="text-right">
          <div className="text-green-400 font-bold text-xl">
            {(property.listedForSale ? property.salePrice : property.currentPrice).toLocaleString()} CR
          </div>
          {property.listedForSale && (
            <Badge variant="outline" className="text-yellow-400 border-yellow-400 mt-1">
              Player Sale
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-4 text-sm text-gray-300">
        <div className="flex items-center gap-1">
          <Bed className="w-4 h-4" />
          {property.bedrooms === 0 ? "Studio" : `${property.bedrooms} BR`}
        </div>
        <div className="flex items-center gap-1">
          <Bath className="w-4 h-4" />
          {property.bathrooms} BA
        </div>
        <div className="flex items-center gap-1">
          <Maximize className="w-4 h-4" />
          {property.sqft} sqft
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {property.amenities?.slice(0, 5).map((amenity: string) => (
          <Badge key={amenity} variant="secondary" className="text-xs bg-gray-700 text-gray-300">
            {amenity}
          </Badge>
        ))}
        {property.amenities?.length > 5 && (
          <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300">
            +{property.amenities.length - 5} more
          </Badge>
        )}
      </div>

      {property.ownerName && (
        <div className="text-sm text-yellow-400">
          Owner: {property.ownerName}
        </div>
      )}

      {showBuyButton && (
        <Button
          onClick={() => handleBuy(property._id)}
          className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
        >
          Buy Property
        </Button>
      )}

      {showOwnerActions && (
        <div className="space-y-2">
          {property.listedForSale ? (
            <Button
              onClick={() => handleUnlist(property._id)}
              variant="outline"
              className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
            >
              Unlist from Sale
            </Button>
          ) : (
            <div className="space-y-2">
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
                  onClick={() => handleListForSale(property._id)}
                  className="bg-green-500/20 border border-green-500 text-green-500 hover:bg-green-500/30"
                >
                  List
                </Button>
              </div>
              <Button
                onClick={() => handleSellToBank(property._id)}
                variant="outline"
                className="w-full border-red-400 text-red-400 hover:bg-red-400/10"
              >
                Sell to Bank (80% value)
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );

  if (properties === null || myProperties === null || playerListings === null) {
    return (
      <div className="text-center py-8 text-gray-400">
        Loading real estate market...
      </div>
    );
  }

  const availableProperties = properties?.filter(
    (p) => p.status === "available" || (p.listedForSale && !p.isOwned)
  );

  return (
    <div className="space-y-6">
      {/* Market Events Banner */}
      {activeEvents && activeEvents.length > 0 && (
        <Card className="bg-purple-900/20 border-purple-500/50">
          <CardHeader>
            <CardTitle className="text-purple-400 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Active Market Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeEvents.map((event) => (
              <div key={event._id} className="p-3 bg-gray-800/50 rounded border border-purple-500/30">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-cyan-400 font-bold">{event.eventType}</div>
                    <div className="text-sm text-gray-400">{event.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Area: {event.affectedArea} • Impact: {event.priceImpact > 0 ? "+" : ""}
                      {event.priceImpact}%
                    </div>
                  </div>
                  <Badge variant="outline" className="text-purple-400 border-purple-400">
                    Active
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Initialize Market Button */}
      {properties && properties.length === 0 && (
        <Card className="bg-gray-900/50 border-cyan-400/30">
          <CardContent className="p-6 text-center space-y-4">
            <Sparkles className="w-12 h-12 text-cyan-400 mx-auto" />
            <div>
              <h3 className="text-xl font-bold text-cyan-400 mb-2">Initialize Real Estate Market</h3>
              <p className="text-gray-400">
                Create 50 Mumbai properties to start trading
              </p>
            </div>
            <Button
              onClick={handleSeedMarket}
              className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
            >
              Initialize Market
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="market" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800/50">
          <TabsTrigger value="market" className="data-[state=active]:bg-cyan-400/20">
            <Home className="w-4 h-4 mr-2" />
            Market ({availableProperties?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="listings" className="data-[state=active]:bg-cyan-400/20">
            <Users className="w-4 h-4 mr-2" />
            Player Listings ({playerListings?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="my-properties" className="data-[state=active]:bg-cyan-400/20">
            <Building2 className="w-4 h-4 mr-2" />
            My Properties ({myProperties?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="market" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableProperties?.map((property) => (
              <PropertyCard
                key={property._id}
                property={property}
                showBuyButton={!property.isOwned}
              />
            ))}
          </div>
          {availableProperties?.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No properties available for purchase
            </div>
          )}
        </TabsContent>

        <TabsContent value="listings" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playerListings?.map((property) => (
              <PropertyCard key={property._id} property={property} showBuyButton />
            ))}
          </div>
          {playerListings?.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No player listings available
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-properties" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myProperties?.map((property) => (
              <PropertyCard key={property._id} property={property} showOwnerActions />
            ))}
          </div>
          {myProperties?.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              You don't own any properties yet
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
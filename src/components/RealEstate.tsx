import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, TrendingUp, TrendingDown, Home, Bed, Bath, Maximize, MapPin, Coins } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export function RealEstate() {
  const properties = useQuery(api.realEstate.listProperties);
  const userProperties = useQuery(api.realEstate.getUserProperties) as 
    | { properties: any[]; totalValue: number; totalInvested: number; profitLoss: number }
    | undefined;
  const marketEvents = useQuery(api.realEstate.getMarketEvents);
  const buyProperty = useMutation(api.realEstate.buyProperty);
  const sellProperty = useMutation(api.realEstate.sellProperty);
  const seedProperties = useMutation(api.realEstate.seedProperties);
  const simulateEvent = useMutation(api.realEstate.simulateMarketEvent);

  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [seeding, setSeeding] = useState(false);

  const handleBuy = async (propertyId: Id<"properties">) => {
    try {
      await buyProperty({ propertyId });
      toast.success("Property purchased successfully!");
      setSelectedProperty(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to buy property");
    }
  };

  const handleSell = async (propertyId: Id<"properties">) => {
    try {
      await sellProperty({ 
        propertyId, 
        askingPrice: sellPrice > 0 ? sellPrice : undefined 
      });
      toast.success("Property sold successfully!");
      setSelectedProperty(null);
      setSellPrice(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sell property");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedProperties({});
      toast.success("Real estate market initialized!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed properties");
    } finally {
      setSeeding(false);
    }
  };

  const handleSimulateEvent = async () => {
    try {
      const event = await simulateEvent({});
      toast.success(`Market event: ${event.description}`);
    } catch (e) {
      toast.error("Failed to simulate event");
    }
  };

  const getPriceChange = (property: any) => {
    if (property.priceHistory.length < 2) return 0;
    const current = property.currentPrice;
    const previous = property.priceHistory[property.priceHistory.length - 2].price;
    return ((current - previous) / previous) * 100;
  };

  if (!properties || properties.length === 0) {
    return (
      <Card className="bg-gray-900/50 border-cyan-400/30">
        <CardContent className="p-8 text-center space-y-4">
          <Building2 className="w-16 h-16 mx-auto text-cyan-400" />
          <div className="text-gray-400">No properties available. Initialize the market.</div>
          <Button
            onClick={handleSeed}
            disabled={seeding}
            className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
          >
            {seeding ? "Initializing..." : "Initialize Real Estate Market"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const availableProperties = properties.filter((p) => p.status === "available");

  return (
    <div className="space-y-6">
      {/* Header with Re-initialize Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-cyan-400">Real Estate Market</h2>
        <Button
          onClick={handleSeed}
          disabled={seeding}
          variant="outline"
          className="bg-cyan-400/10 border-cyan-400 text-cyan-400 hover:bg-cyan-400/20"
        >
          {seeding ? "Re-initializing..." : "Re-initialize Market"}
        </Button>
      </div>

      {/* Market Events Feed */}
      <Card className="bg-gray-900/50 border-yellow-400/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-yellow-400">Market Events</CardTitle>
              <CardDescription className="text-gray-400">Recent events affecting property values</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleSimulateEvent}
              className="bg-yellow-400/20 border border-yellow-400 text-yellow-400 hover:bg-yellow-400/30"
            >
              Simulate Event
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {marketEvents?.slice(0, 5).map((event) => (
            <div key={event._id} className="p-3 bg-gray-800/40 rounded border border-gray-700 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant={event.priceImpact > 0 ? "default" : "destructive"}>
                    {event.affectedArea}
                  </Badge>
                  <span className="text-xs text-gray-500 uppercase">{event.eventType}</span>
                </div>
                <div className="text-sm text-gray-300 mt-1">{event.description}</div>
              </div>
              <div className={`flex items-center gap-1 ${event.priceImpact > 0 ? "text-green-400" : "text-red-400"}`}>
                {event.priceImpact > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm font-bold">{event.priceImpact > 0 ? "+" : ""}{event.priceImpact}%</span>
              </div>
            </div>
          ))}
          {(!marketEvents || marketEvents.length === 0) && (
            <div className="text-center py-4 text-gray-500 text-sm">No recent events</div>
          )}
        </CardContent>
      </Card>

      {/* User Portfolio */}
      {userProperties && userProperties.properties && userProperties.properties.length > 0 && (
        <Card className="bg-gray-900/50 border-green-400/30">
          <CardHeader>
            <CardTitle className="text-green-400">My Properties</CardTitle>
            <CardDescription className="text-gray-400">
              Portfolio Value: <span className="text-green-400 font-bold">{userProperties.totalValue} CR</span>
              {" • "}
              P/L: <span className={userProperties.profitLoss >= 0 ? "text-green-400" : "text-red-400"}>
                {userProperties.profitLoss >= 0 ? "+" : ""}{userProperties.profitLoss} CR
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {userProperties.properties.map((property: any) => {
              const purchasePrice = property.priceHistory.find((h: any) => h.event === "Purchased")?.price || property.basePrice;
              const profit = property.currentPrice - purchasePrice;
              const priceChange = getPriceChange(property);

              return (
                <Card key={property._id} className="bg-gray-800/50 border-gray-700 hover:border-cyan-400/50 transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-cyan-400 text-base">{property.name}</CardTitle>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <MapPin className="w-3 h-3" />
                          {property.location}
                        </div>
                      </div>
                      <Home className="w-5 h-5 text-cyan-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Current Value:</span>
                      <span className="text-green-400 font-bold">{property.currentPrice} CR</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Purchase Price:</span>
                      <span className="text-gray-300">{purchasePrice} CR</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Profit/Loss:</span>
                      <span className={profit >= 0 ? "text-green-400" : "text-red-400"}>
                        {profit >= 0 ? "+" : ""}{profit} CR
                      </span>
                    </div>
                    {priceChange !== 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        {priceChange > 0 ? (
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <span className={priceChange > 0 ? "text-green-400" : "text-red-400"}>
                          {priceChange > 0 ? "+" : ""}{priceChange.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="w-full bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30"
                          onClick={() => {
                            setSelectedProperty(property);
                            setSellPrice(property.currentPrice);
                          }}
                        >
                          Sell Property
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-gray-900 border-cyan-400/30">
                        <DialogHeader>
                          <DialogTitle className="text-cyan-400">Sell {property.name}</DialogTitle>
                          <DialogDescription className="text-gray-400">
                            Set your asking price or sell at current market value
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label className="text-cyan-400">Asking Price (CR)</Label>
                            <Input
                              type="number"
                              value={sellPrice}
                              onChange={(e) => setSellPrice(parseInt(e.target.value) || 0)}
                              className="bg-gray-800 border-gray-600 text-white"
                            />
                            <div className="text-xs text-gray-500 mt-1">
                              Current market value: {property.currentPrice} CR
                            </div>
                          </div>
                          <Button
                            onClick={() => handleSell(property._id)}
                            className="w-full bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30"
                          >
                            Confirm Sale
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Available Properties */}
      <Card className="bg-gray-900/50 border-cyan-400/30">
        <CardHeader>
          <CardTitle className="text-cyan-400">Available Properties</CardTitle>
          <CardDescription className="text-gray-400">Browse and purchase properties across Mumbai</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {availableProperties.map((property) => {
            const priceChange = getPriceChange(property);

            return (
              <Card key={property._id} className="bg-gray-800/50 border-gray-700 hover:border-cyan-400/50 transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-cyan-400 text-base">{property.name}</CardTitle>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <MapPin className="w-3 h-3" />
                        {property.location}
                      </div>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {property.propertyType}
                      </Badge>
                    </div>
                    <Building2 className="w-5 h-5 text-cyan-400" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-bold">{property.currentPrice} CR</span>
                    </div>
                    {priceChange !== 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        {priceChange > 0 ? (
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <span className={priceChange > 0 ? "text-green-400" : "text-red-400"}>
                          {priceChange > 0 ? "+" : ""}{priceChange.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Bed className="w-3 h-3" />
                      {property.bedrooms}
                    </div>
                    <div className="flex items-center gap-1">
                      <Bath className="w-3 h-3" />
                      {property.bathrooms}
                    </div>
                    <div className="flex items-center gap-1">
                      <Maximize className="w-3 h-3" />
                      {property.sqft} sqft
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {property.amenities.slice(0, 3).map((amenity: string) => (
                      <Badge key={amenity} variant="secondary" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                    {property.amenities.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{property.amenities.length - 3}
                      </Badge>
                    )}
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                        onClick={() => setSelectedProperty(property)}
                      >
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-gray-900 border-cyan-400/30 max-h-[80vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle className="text-cyan-400">{property.name}</DialogTitle>
                        <DialogDescription className="text-gray-400">
                          {property.location} • {property.propertyType}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-bold text-cyan-400 mb-2">Description</h4>
                          <p className="text-sm text-gray-300">{property.description}</p>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-cyan-400 mb-2">Details</h4>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Bed className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-300">{property.bedrooms} Beds</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Bath className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-300">{property.bathrooms} Baths</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Maximize className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-300">{property.sqft} sqft</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-cyan-400 mb-2">Amenities</h4>
                          <div className="flex flex-wrap gap-2">
                            {property.amenities.map((amenity: string) => (
                              <Badge key={amenity} variant="secondary">
                                {amenity}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-700">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-gray-400">Price:</span>
                            <span className="text-2xl font-bold text-green-400">{property.currentPrice} CR</span>
                          </div>
                          <Button
                            onClick={() => handleBuy(property._id)}
                            className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                          >
                            Buy Now
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

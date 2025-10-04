import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getCurrentUser } from "./users";

// List all properties with their current status
export const listProperties = query({
  args: {},
  handler: async (ctx) => {
    const properties = await ctx.db.query("properties").collect();
    return properties;
  },
});

// Get detailed property information
export const getPropertyDetails = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    
    // Get recent events affecting this location
    const recentEvents = await ctx.db
      .query("realEstateEvents")
      .withIndex("by_area", (q) => q.eq("affectedArea", property.location))
      .order("desc")
      .take(5);
    
    return { property, recentEvents };
  },
});

// Get properties owned by current user
export const getUserProperties = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    
    const totalValue = properties.reduce((sum, p) => sum + p.currentPrice, 0);
    const totalInvested = properties.reduce((sum, p) => sum + (p.priceHistory[0]?.price || p.basePrice), 0);
    
    return {
      properties,
      totalValue,
      totalInvested,
      profitLoss: totalValue - totalInvested,
    };
  },
});

// New: List property for sale by owner
export const listPropertyForSale = mutation({
  args: {
    propertyId: v.id("properties"),
    askingPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("You don't own this property");
    if (property.listedForSale) throw new Error("Property already listed");
    if (args.askingPrice < 1000) throw new Error("Asking price must be at least 1000 CR");

    await ctx.db.patch(args.propertyId, {
      listedForSale: true,
      askingPrice: args.askingPrice,
      listedAt: Date.now(),
    });
  },
});

// New: Delist property from sale
export const delistProperty = mutation({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("You don't own this property");

    await ctx.db.patch(args.propertyId, {
      listedForSale: false,
      askingPrice: undefined,
      listedAt: undefined,
    });
  },
});

// New: Get all player listings
export const getPlayerListings = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db
      .query("properties")
      .withIndex("by_listed", (q) => q.eq("listedForSale", true))
      .collect();

    const enriched = await Promise.all(
      listings.map(async (property) => {
        const owner = property.ownerId ? await ctx.db.get(property.ownerId) : null;
        const purchaseHistory = await ctx.db
          .query("propertyTransactions")
          .withIndex("by_property", (q) => q.eq("propertyId", property._id))
          .order("desc")
          .take(1);
        
        const originalPurchasePrice = purchaseHistory[0]?.price || property.basePrice;

        return {
          ...property,
          ownerName: owner?.characterName || "Unknown",
          originalPurchasePrice,
        };
      })
    );

    return enriched;
  },
});

// New: Buy property from another player
export const buyFromPlayer = mutation({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (!property.listedForSale) throw new Error("Property not listed for sale");
    if (property.ownerId === user._id) throw new Error("Cannot buy your own property");
    if (!property.askingPrice) throw new Error("No asking price set");
    if (!user.credits || user.credits < property.askingPrice) {
      throw new Error("Insufficient credits");
    }

    const seller = property.ownerId ? await ctx.db.get(property.ownerId) : null;
    if (!seller) throw new Error("Seller not found");

    // Transfer credits
    await ctx.db.patch(user._id, {
      credits: user.credits - property.askingPrice,
    });
    await ctx.db.patch(seller._id, {
      credits: (seller.credits || 0) + property.askingPrice,
    });

    // Transfer property ownership
    await ctx.db.patch(args.propertyId, {
      ownerId: user._id,
      status: "owned",
      purchasedAt: Date.now(),
      listedForSale: false,
      askingPrice: undefined,
      listedAt: undefined,
      priceHistory: [
        ...property.priceHistory,
        {
          price: property.askingPrice,
          timestamp: Date.now(),
          event: `Sold to ${user.characterName}`,
        },
      ],
    });

    // Record transaction
    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      buyerId: user._id,
      sellerId: seller._id,
      price: property.askingPrice,
      transactionDate: Date.now(),
      transactionType: "player_sale",
    });
  },
});

// New: Admin update property price
export const adminUpdatePrice = mutation({
  args: {
    propertyId: v.id("properties"),
    newPrice: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") throw new Error("Admin access required");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (args.newPrice < 1000) throw new Error("Price must be at least 1000 CR");

    await ctx.db.patch(args.propertyId, {
      currentPrice: args.newPrice,
      priceHistory: [
        ...property.priceHistory,
        {
          price: args.newPrice,
          timestamp: Date.now(),
          event: args.reason || "Admin price adjustment",
        },
      ],
    });

    // Create market event
    await ctx.db.insert("realEstateEvents", {
      eventType: "admin_adjustment",
      affectedArea: property.location,
      description: args.reason || `${property.name} price adjusted to ${args.newPrice} CR`,
      priceImpact: ((args.newPrice - property.currentPrice) / property.currentPrice) * 100,
      duration: 0,
      occurredAt: Date.now(),
    });
  },
});

// New: Admin trigger custom market event
export const adminTriggerEvent = mutation({
  args: {
    eventType: v.string(),
    affectedArea: v.string(),
    description: v.string(),
    priceImpact: v.number(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") throw new Error("Admin access required");

    await ctx.db.insert("realEstateEvents", {
      eventType: args.eventType,
      affectedArea: args.affectedArea,
      description: args.description,
      priceImpact: args.priceImpact,
      duration: args.duration,
      occurredAt: Date.now(),
    });

    // Apply the event immediately
    const properties = await ctx.db.query("properties").collect();
    for (const property of properties) {
      if (property.location.includes(args.affectedArea)) {
        const adjustment = 1 + args.priceImpact / 100;
        const newPrice = Math.max(1000, Math.floor(property.currentPrice * adjustment));
        
        await ctx.db.patch(property._id, {
          currentPrice: newPrice,
          priceHistory: [
            ...property.priceHistory,
            {
              price: newPrice,
              timestamp: Date.now(),
              event: args.description,
            },
          ],
        });
      }
    }
  },
});

// New: Get all properties with ownership info (admin)
export const getAllPropertiesAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") throw new Error("Admin access required");

    const properties = await ctx.db.query("properties").collect();
    
    const enriched = await Promise.all(
      properties.map(async (property) => {
        const owner = property.ownerId ? await ctx.db.get(property.ownerId) : null;
        return {
          ...property,
          ownerName: owner?.characterName || "Market",
          ownerEmail: owner?.email || "N/A",
        };
      })
    );

    return enriched;
  },
});

// Buy a property
export const buyProperty = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    if (user.credits === undefined) throw new Error("User credits not initialized");
    
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.status !== "available") throw new Error("Property not available");
    if (user.credits < property.currentPrice) throw new Error("Insufficient credits");
    
    // Deduct credits
    await ctx.db.patch(user._id, {
      credits: user.credits - property.currentPrice,
    });
    
    // Update property ownership
    await ctx.db.patch(args.propertyId, {
      ownerId: user._id,
      status: "owned",
      purchasedAt: Date.now(),
      priceHistory: [
        ...property.priceHistory,
        {
          timestamp: Date.now(),
          price: property.currentPrice,
          event: "Purchased",
        },
      ],
    });
    
    // Record transaction
    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      buyerId: user._id,
      price: property.currentPrice,
      transactionDate: Date.now(),
      transactionType: "market_purchase",
    });
    
    return { success: true };
  },
});

// Sell a property back to market
export const sellProperty = mutation({
  args: { 
    propertyId: v.id("properties"),
    askingPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    if (user.credits === undefined) throw new Error("User credits not initialized");
    
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("You don't own this property");
    
    const salePrice = args.askingPrice || property.currentPrice;
    
    // Return credits to user
    await ctx.db.patch(user._id, {
      credits: user.credits + salePrice,
    });
    
    // Update property to available
    await ctx.db.patch(args.propertyId, {
      ownerId: undefined,
      status: "available",
      currentPrice: salePrice,
      priceHistory: [
        ...property.priceHistory,
        {
          timestamp: Date.now(),
          price: salePrice,
          event: "Sold back to market",
        },
      ],
    });
    
    // Record transaction
    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      sellerId: user._id,
      buyerId: user._id, // Market buyback
      price: salePrice,
      transactionDate: Date.now(),
      transactionType: "market_sale",
    });
    
    return { success: true };
  },
});

// Seed initial properties
export const seedProperties = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all existing properties to allow re-initialization
    const existing = await ctx.db.query("properties").collect();
    for (const prop of existing) {
      await ctx.db.delete(prop._id);
    }
    
    const properties = [
      {
        name: "Bandra Skyline Residency",
        location: "Bandra West",
        propertyType: "Luxury Apartment",
        basePrice: 65000,
        currentPrice: 65000,
        amenities: ["Pool", "Gym", "24/7 Security", "Parking", "Sea View"],
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1800,
        description: "Premium apartment in the heart of Bandra with stunning sea views",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 65000, event: "Initial listing" }],
      },
      {
        name: "Juhu Beach Villa",
        location: "Juhu",
        propertyType: "Villa",
        basePrice: 50000,
        currentPrice: 50000,
        amenities: ["Private Beach Access", "Pool", "Garden", "Parking", "Security"],
        bedrooms: 5,
        bathrooms: 4,
        sqft: 3500,
        description: "Luxurious beachfront villa with private access",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 50000, event: "Initial listing" }],
      },
      {
        name: "Andheri Metro Apartments",
        location: "Andheri East",
        propertyType: "Apartment",
        basePrice: 33000,
        currentPrice: 33000,
        amenities: ["Metro Access", "Parking", "Security", "Gym"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        description: "Convenient apartment near metro station",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 33000, event: "Initial listing" }],
      },
      {
        name: "Powai Lake View Tower",
        location: "Powai",
        propertyType: "Penthouse",
        basePrice: 45000,
        currentPrice: 45000,
        amenities: ["Lake View", "Pool", "Gym", "Clubhouse", "Parking"],
        bedrooms: 4,
        bathrooms: 3,
        sqft: 2500,
        description: "Stunning penthouse overlooking Powai Lake",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 45000, event: "Initial listing" }],
      },
      {
        name: "Worli Sea Link Towers",
        location: "Worli",
        propertyType: "Luxury Apartment",
        basePrice: 43000,
        currentPrice: 43000,
        amenities: ["Sea View", "Pool", "Gym", "Concierge", "Valet Parking"],
        bedrooms: 3,
        bathrooms: 3,
        sqft: 2200,
        description: "Ultra-modern apartment with Sea Link views",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 43000, event: "Initial listing" }],
      },
      {
        name: "Colaba Heritage Mansion",
        location: "Colaba",
        propertyType: "Heritage Building",
        basePrice: 47000,
        currentPrice: 47000,
        amenities: ["Heritage Architecture", "Garden", "Parking", "Security"],
        bedrooms: 4,
        bathrooms: 3,
        sqft: 2800,
        description: "Historic mansion in South Mumbai's prime location",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 47000, event: "Initial listing" }],
      },
      {
        name: "Lower Parel Tech Hub Office",
        location: "Lower Parel",
        propertyType: "Commercial",
        basePrice: 37000,
        currentPrice: 37000,
        amenities: ["Metro Access", "Parking", "24/7 Access", "High-Speed Internet"],
        bedrooms: 0,
        bathrooms: 2,
        sqft: 1500,
        description: "Modern office space in tech district",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 37000, event: "Initial listing" }],
      },
      {
        name: "Thane Creek Residency",
        location: "Thane",
        propertyType: "Apartment",
        basePrice: 31000,
        currentPrice: 31000,
        amenities: ["Parking", "Security", "Gym", "Children's Play Area"],
        bedrooms: 2,
        bathrooms: 1,
        sqft: 950,
        description: "Affordable housing in growing Thane area",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 31000, event: "Initial listing" }],
      },
      {
        name: "Navi Mumbai Smart City Flat",
        location: "Navi Mumbai",
        propertyType: "Apartment",
        basePrice: 32000,
        currentPrice: 32000,
        amenities: ["Smart Home", "Parking", "Security", "Green Spaces"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1100,
        description: "Modern apartment in planned smart city",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 32000, event: "Initial listing" }],
      },
      {
        name: "Bandra East Studio",
        location: "Bandra East",
        propertyType: "Studio",
        basePrice: 55000,
        currentPrice: 55000,
        amenities: ["Compact Living", "Security", "Parking"],
        bedrooms: 1,
        bathrooms: 1,
        sqft: 600,
        description: "Cozy studio for young professionals",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 55000, event: "Initial listing" }],
      },
      {
        name: "Marine Drive Seaview Apartment",
        location: "Marine Drive",
        propertyType: "Luxury Apartment",
        basePrice: 80000,
        currentPrice: 80000,
        amenities: ["Sea View", "Gym", "Valet Parking", "Concierge"],
        bedrooms: 4,
        bathrooms: 3,
        sqft: 2400,
        description: "Iconic Marine Drive location with panoramic sea views",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 80000, event: "Initial listing" }],
      },
      {
        name: "Dadar Central Flat",
        location: "Dadar",
        propertyType: "Apartment",
        basePrice: 48000,
        currentPrice: 48000,
        amenities: ["Central Location", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1100,
        description: "Well-connected apartment in central Mumbai",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 48000, event: "Initial listing" }],
      },
      {
        name: "Goregaon Film City Residence",
        location: "Goregaon",
        propertyType: "Apartment",
        basePrice: 42000,
        currentPrice: 42000,
        amenities: ["Near Film City", "Gym", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1250,
        description: "Modern apartment near Film City studios",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 42000, event: "Initial listing" }],
      },
      {
        name: "Malad West Tower",
        location: "Malad West",
        propertyType: "Apartment",
        basePrice: 39000,
        currentPrice: 39000,
        amenities: ["Mall Access", "Parking", "Security", "Gym"],
        bedrooms: 2,
        bathrooms: 1,
        sqft: 1050,
        description: "Convenient location near Inorbit Mall",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 39000, event: "Initial listing" }],
      },
      {
        name: "Kandivali Garden Homes",
        location: "Kandivali",
        propertyType: "Apartment",
        basePrice: 38000,
        currentPrice: 38000,
        amenities: ["Garden", "Children's Play Area", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1150,
        description: "Family-friendly apartment with green spaces",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 38000, event: "Initial listing" }],
      },
      {
        name: "Borivali National Park View",
        location: "Borivali",
        propertyType: "Apartment",
        basePrice: 41000,
        currentPrice: 41000,
        amenities: ["Park View", "Gym", "Parking", "Security"],
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1400,
        description: "Serene apartment overlooking Sanjay Gandhi National Park",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 41000, event: "Initial listing" }],
      },
      {
        name: "Dahisar Creek Residency",
        location: "Dahisar",
        propertyType: "Apartment",
        basePrice: 36000,
        currentPrice: 36000,
        amenities: ["Creek View", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 1,
        sqft: 980,
        description: "Affordable housing with nature views",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 36000, event: "Initial listing" }],
      },
      {
        name: "Mira Road Budget Homes",
        location: "Mira Road",
        propertyType: "Apartment",
        basePrice: 32000,
        currentPrice: 32000,
        amenities: ["Parking", "Security", "Basic Amenities"],
        bedrooms: 1,
        bathrooms: 1,
        sqft: 750,
        description: "Budget-friendly option in growing suburb",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 32000, event: "Initial listing" }],
      },
      {
        name: "Churchgate Business District Office",
        location: "Churchgate",
        propertyType: "Commercial",
        basePrice: 70000,
        currentPrice: 70000,
        amenities: ["Prime Location", "High-Speed Internet", "24/7 Access", "Parking"],
        bedrooms: 0,
        bathrooms: 2,
        sqft: 1800,
        description: "Premium office space in South Mumbai's business hub",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 70000, event: "Initial listing" }],
      },
      {
        name: "Fort Heritage Building",
        location: "Fort",
        propertyType: "Heritage Building",
        basePrice: 75000,
        currentPrice: 75000,
        amenities: ["Heritage Architecture", "Central Location", "Parking"],
        bedrooms: 3,
        bathrooms: 2,
        sqft: 2200,
        description: "Historic building in Mumbai's financial district",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 75000, event: "Initial listing" }],
      },
      {
        name: "Nariman Point Corporate Tower",
        location: "Nariman Point",
        propertyType: "Commercial",
        basePrice: 85000,
        currentPrice: 85000,
        amenities: ["Sea View", "Premium Office", "Valet Parking", "Conference Rooms"],
        bedrooms: 0,
        bathrooms: 3,
        sqft: 2500,
        description: "Ultra-premium office space with sea views",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 85000, event: "Initial listing" }],
      },
      {
        name: "Cuffe Parade Luxury Penthouse",
        location: "Cuffe Parade",
        propertyType: "Penthouse",
        basePrice: 95000,
        currentPrice: 95000,
        amenities: ["Sea View", "Private Terrace", "Pool", "Gym", "Concierge"],
        bedrooms: 5,
        bathrooms: 4,
        sqft: 4000,
        description: "Exclusive penthouse with breathtaking views",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 95000, event: "Initial listing" }],
      },
      {
        name: "Malabar Hill Elite Mansion",
        location: "Malabar Hill",
        propertyType: "Villa",
        basePrice: 120000,
        currentPrice: 120000,
        amenities: ["Private Garden", "Pool", "Gym", "Security", "Parking"],
        bedrooms: 6,
        bathrooms: 5,
        sqft: 5500,
        description: "Prestigious mansion in Mumbai's most elite neighborhood",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 120000, event: "Initial listing" }],
      },
      {
        name: "Parel Mill District Loft",
        location: "Parel",
        propertyType: "Loft",
        basePrice: 52000,
        currentPrice: 52000,
        amenities: ["Industrial Design", "High Ceilings", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1600,
        description: "Trendy loft in converted mill area",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 52000, event: "Initial listing" }],
      },
      {
        name: "Matunga Cultural Hub Flat",
        location: "Matunga",
        propertyType: "Apartment",
        basePrice: 46000,
        currentPrice: 46000,
        amenities: ["Cultural Area", "Parking", "Security", "Garden"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        description: "Traditional neighborhood with modern amenities",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 46000, event: "Initial listing" }],
      },
      {
        name: "Sion Hospital Area Apartment",
        location: "Sion",
        propertyType: "Apartment",
        basePrice: 40000,
        currentPrice: 40000,
        amenities: ["Near Hospital", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 1,
        sqft: 1000,
        description: "Convenient location near medical facilities",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 40000, event: "Initial listing" }],
      },
      {
        name: "Kurla Station Residency",
        location: "Kurla",
        propertyType: "Apartment",
        basePrice: 43000,
        currentPrice: 43000,
        amenities: ["Station Access", "Parking", "Security", "Gym"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1150,
        description: "Well-connected apartment near railway station",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 43000, event: "Initial listing" }],
      },
      {
        name: "Chembur Garden Colony",
        location: "Chembur",
        propertyType: "Apartment",
        basePrice: 44000,
        currentPrice: 44000,
        amenities: ["Garden Colony", "Parking", "Security", "Children's Play Area"],
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1350,
        description: "Peaceful residential area with greenery",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 44000, event: "Initial listing" }],
      },
      {
        name: "Ghatkopar Metro Hub",
        location: "Ghatkopar",
        propertyType: "Apartment",
        basePrice: 41000,
        currentPrice: 41000,
        amenities: ["Metro Access", "Mall Nearby", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1100,
        description: "Modern apartment near metro and shopping",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 41000, event: "Initial listing" }],
      },
      {
        name: "Vikhroli Park View",
        location: "Vikhroli",
        propertyType: "Apartment",
        basePrice: 40000,
        currentPrice: 40000,
        amenities: ["Park View", "Gym", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        description: "Green surroundings with modern facilities",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 40000, event: "Initial listing" }],
      },
      {
        name: "Kanjurmarg IT Park Office",
        location: "Kanjurmarg",
        propertyType: "Commercial",
        basePrice: 45000,
        currentPrice: 45000,
        amenities: ["IT Park", "High-Speed Internet", "Parking", "Cafeteria"],
        bedrooms: 0,
        bathrooms: 2,
        sqft: 1400,
        description: "Modern office space in tech hub",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 45000, event: "Initial listing" }],
      },
      {
        name: "Bhandup Creek Homes",
        location: "Bhandup",
        propertyType: "Apartment",
        basePrice: 38000,
        currentPrice: 38000,
        amenities: ["Creek View", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 1,
        sqft: 1050,
        description: "Affordable housing with water views",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 38000, event: "Initial listing" }],
      },
      {
        name: "Mulund Garden City",
        location: "Mulund",
        propertyType: "Apartment",
        basePrice: 42000,
        currentPrice: 42000,
        amenities: ["Garden City", "Gym", "Parking", "Security", "Pool"],
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1400,
        description: "Spacious apartment in well-planned suburb",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 42000, event: "Initial listing" }],
      },
      {
        name: "Airoli Sector Residency",
        location: "Airoli",
        propertyType: "Apartment",
        basePrice: 37000,
        currentPrice: 37000,
        amenities: ["Planned Layout", "Parking", "Security", "Gym"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1150,
        description: "Well-organized Navi Mumbai sector",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 37000, event: "Initial listing" }],
      },
      {
        name: "Vashi Business Hub",
        location: "Vashi",
        propertyType: "Commercial",
        basePrice: 48000,
        currentPrice: 48000,
        amenities: ["Business District", "Parking", "High-Speed Internet", "24/7 Access"],
        bedrooms: 0,
        bathrooms: 2,
        sqft: 1600,
        description: "Prime commercial space in Navi Mumbai",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 48000, event: "Initial listing" }],
      },
      {
        name: "Nerul Palm Beach Residency",
        location: "Nerul",
        propertyType: "Apartment",
        basePrice: 39000,
        currentPrice: 39000,
        amenities: ["Near Beach", "Parking", "Security", "Garden"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1200,
        description: "Coastal living in Navi Mumbai",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 39000, event: "Initial listing" }],
      },
      {
        name: "Belapur CBD Tower",
        location: "Belapur",
        propertyType: "Apartment",
        basePrice: 41000,
        currentPrice: 41000,
        amenities: ["CBD Location", "Gym", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1250,
        description: "Modern apartment in central business district",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 41000, event: "Initial listing" }],
      },
      {
        name: "Kharghar Hills View",
        location: "Kharghar",
        propertyType: "Apartment",
        basePrice: 38000,
        currentPrice: 38000,
        amenities: ["Hill View", "Gym", "Parking", "Security", "Garden"],
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1450,
        description: "Scenic apartment with hill views",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 38000, event: "Initial listing" }],
      },
      {
        name: "Panvel Smart City Flat",
        location: "Panvel",
        propertyType: "Apartment",
        basePrice: 35000,
        currentPrice: 35000,
        amenities: ["Smart Home", "Parking", "Security", "Green Spaces"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1100,
        description: "Affordable smart city living",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 35000, event: "Initial listing" }],
      },
      {
        name: "Kalyan Station Apartments",
        location: "Kalyan",
        propertyType: "Apartment",
        basePrice: 33000,
        currentPrice: 33000,
        amenities: ["Station Access", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 1,
        sqft: 950,
        description: "Budget-friendly with excellent connectivity",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 33000, event: "Initial listing" }],
      },
      {
        name: "Dombivli Family Homes",
        location: "Dombivli",
        propertyType: "Apartment",
        basePrice: 32000,
        currentPrice: 32000,
        amenities: ["Family Area", "Parking", "Security", "Children's Play Area"],
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1050,
        description: "Affordable family housing",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 32000, event: "Initial listing" }],
      },
      {
        name: "Ulhasnagar Market District",
        location: "Ulhasnagar",
        propertyType: "Commercial",
        basePrice: 30000,
        currentPrice: 30000,
        amenities: ["Market Area", "Parking", "24/7 Access"],
        bedrooms: 0,
        bathrooms: 1,
        sqft: 800,
        description: "Commercial space in busy market",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 30000, event: "Initial listing" }],
      },
      {
        name: "Badlapur Green Valley",
        location: "Badlapur",
        propertyType: "Villa",
        basePrice: 40000,
        currentPrice: 40000,
        amenities: ["Garden", "Parking", "Security", "Nature Views"],
        bedrooms: 3,
        bathrooms: 2,
        sqft: 2000,
        description: "Peaceful villa in green surroundings",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 40000, event: "Initial listing" }],
      },
      {
        name: "Ambernath Industrial Hub",
        location: "Ambernath",
        propertyType: "Commercial",
        basePrice: 34000,
        currentPrice: 34000,
        amenities: ["Industrial Area", "Parking", "Loading Bay"],
        bedrooms: 0,
        bathrooms: 2,
        sqft: 1500,
        description: "Commercial space in industrial zone",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 34000, event: "Initial listing" }],
      },
      {
        name: "Vasai Beach Resort Villa",
        location: "Vasai",
        propertyType: "Villa",
        basePrice: 55000,
        currentPrice: 55000,
        amenities: ["Beach Access", "Pool", "Garden", "Parking", "Security"],
        bedrooms: 4,
        bathrooms: 3,
        sqft: 3000,
        description: "Luxury beach villa in Vasai",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 55000, event: "Initial listing" }],
      },
      {
        name: "Virar Budget Flats",
        location: "Virar",
        propertyType: "Apartment",
        basePrice: 28000,
        currentPrice: 28000,
        amenities: ["Parking", "Security", "Basic Amenities"],
        bedrooms: 1,
        bathrooms: 1,
        sqft: 650,
        description: "Most affordable option in Mumbai suburbs",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 28000, event: "Initial listing" }],
      },
      {
        name: "Nalasopara Growing Suburb",
        location: "Nalasopara",
        propertyType: "Apartment",
        basePrice: 29000,
        currentPrice: 29000,
        amenities: ["Parking", "Security"],
        bedrooms: 2,
        bathrooms: 1,
        sqft: 850,
        description: "Emerging area with growth potential",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 29000, event: "Initial listing" }],
      },
      {
        name: "Bhayander Station Homes",
        location: "Bhayander",
        propertyType: "Apartment",
        basePrice: 31000,
        currentPrice: 31000,
        amenities: ["Station Access", "Parking", "Security"],
        bedrooms: 2,
        bathrooms: 1,
        sqft: 900,
        description: "Convenient location near railway",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 31000, event: "Initial listing" }],
      },
    ];
    
    for (const prop of properties) {
      await ctx.db.insert("properties", prop);
    }
    
    return { success: true, count: properties.length };
  },
});

// Simulate a market event
export const simulateMarketEvent = mutation({
  args: {},
  handler: async (ctx) => {
    const events = [
      {
        eventType: "infrastructure",
        affectedArea: "Andheri East",
        description: "New metro line extension announced",
        priceImpact: 8,
        duration: 30,
      },
      {
        eventType: "crime",
        affectedArea: "Thane",
        description: "Increased crime reports in the area",
        priceImpact: -5,
        duration: 15,
      },
      {
        eventType: "development",
        affectedArea: "Navi Mumbai",
        description: "New tech park construction begins",
        priceImpact: 10,
        duration: 45,
      },
      {
        eventType: "natural",
        affectedArea: "Juhu",
        description: "Coastal flooding concerns raised",
        priceImpact: -7,
        duration: 20,
      },
      {
        eventType: "economic",
        affectedArea: "Lower Parel",
        description: "Major corporate offices relocating to area",
        priceImpact: 12,
        duration: 60,
      },
      {
        eventType: "infrastructure",
        affectedArea: "Worli",
        description: "Sea Link toll reduction announced",
        priceImpact: 6,
        duration: 30,
      },
      {
        eventType: "development",
        affectedArea: "Bandra West",
        description: "New luxury mall opening",
        priceImpact: 9,
        duration: 40,
      },
      {
        eventType: "natural",
        affectedArea: "Powai",
        description: "Lake pollution levels decrease",
        priceImpact: 7,
        duration: 25,
      },
    ];
    
    const randomEvent = events[Math.floor(Math.random() * events.length)];
    
    await ctx.db.insert("realEstateEvents", {
      ...randomEvent,
      occurredAt: Date.now(),
    });
    
    return randomEvent;
  },
});

// Apply market events to property prices
export const applyMarketEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Get active events (within their duration)
    const allEvents = await ctx.db.query("realEstateEvents").collect();
    const activeEvents = allEvents.filter(
      (e) => now - e.occurredAt < e.duration * oneDayMs
    );
    
    // Group events by area
    const eventsByArea: Record<string, typeof activeEvents> = {};
    for (const event of activeEvents) {
      if (!eventsByArea[event.affectedArea]) {
        eventsByArea[event.affectedArea] = [];
      }
      eventsByArea[event.affectedArea].push(event);
    }
    
    // Update property prices based on events
    const properties = await ctx.db.query("properties").collect();
    
    for (const property of properties) {
      const areaEvents = eventsByArea[property.location] || [];
      if (areaEvents.length === 0) continue;
      
      // Calculate cumulative impact
      const totalImpact = areaEvents.reduce((sum, e) => sum + e.priceImpact, 0);
      const impactFactor = 1 + totalImpact / 100;
      
      const newPrice = Math.floor(property.currentPrice * impactFactor);
      
      if (newPrice !== property.currentPrice) {
        await ctx.db.patch(property._id, {
          currentPrice: newPrice,
          priceHistory: [
            ...property.priceHistory,
            {
              timestamp: now,
              price: newPrice,
              event: areaEvents.map((e) => e.description).join("; "),
            },
          ],
        });
      }
    }
    
    return { success: true, processedProperties: properties.length };
  },
});

// Get recent market events
export const getMarketEvents = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("realEstateEvents")
      .order("desc")
      .take(10);
    
    return events;
  },
});
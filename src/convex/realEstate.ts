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
        basePrice: 40000,
        currentPrice: 40000,
        amenities: ["Pool", "Gym", "24/7 Security", "Parking", "Sea View"],
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1800,
        description: "Premium apartment in the heart of Bandra with stunning sea views",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 40000, event: "Initial listing" }],
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
        basePrice: 30000,
        currentPrice: 30000,
        amenities: ["Compact Living", "Security", "Parking"],
        bedrooms: 1,
        bathrooms: 1,
        sqft: 600,
        description: "Cozy studio for young professionals",
        status: "available" as const,
        listedForSale: false,
        priceHistory: [{ timestamp: Date.now(), price: 30000, event: "Initial listing" }],
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
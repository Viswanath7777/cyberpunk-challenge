import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getCurrentUser } from "./users";
import { Id } from "./_generated/dataModel";

// Seed 50 properties in Mumbai with base price starting at 50,000 credits
export const seedProperties = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Location-based pricing (credits per sqft)
    const locationPricing: Record<string, number> = {
      "Colaba": 45000,
      "Marine Drive": 42000,
      "Worli": 40000,
      "Juhu": 38000,
      "Bandra West": 32000,
      "Lower Parel": 30000,
      "Powai": 25000,
      "Andheri East": 20000,
      "Dadar": 18000,
      "Malad": 15000,
    };

    const locations = [
      "Bandra West", "Andheri East", "Powai", "Juhu", "Worli",
      "Lower Parel", "Colaba", "Marine Drive", "Dadar", "Malad"
    ];

    const amenities = [
      ["Gym", "Pool", "Parking"],
      ["Security", "Garden", "Clubhouse"],
      ["Gym", "Parking", "Power Backup"],
      ["Pool", "Security", "Parking"],
      ["Gym", "Garden", "Security"]
    ];

    const propertyTypes = [
      { bedrooms: 1, bathrooms: 1, sqft: 600 },
      { bedrooms: 2, bathrooms: 2, sqft: 1000 },
      { bedrooms: 3, bathrooms: 2, sqft: 1500 },
      { bedrooms: 4, bathrooms: 3, sqft: 2000 },
      { bedrooms: 0, bathrooms: 1, sqft: 400 } // Studio
    ];

    for (let i = 0; i < 50; i++) {
      const location = locations[i % locations.length];
      const type = propertyTypes[i % propertyTypes.length];
      const amenity = amenities[i % amenities.length];
      
      // Calculate base price using location-specific pricing per sqft
      const pricePerSqft = locationPricing[location] || 20000;
      const basePrice = Math.floor(type.sqft * pricePerSqft);

      await ctx.db.insert("properties", {
        name: `Property ${i + 1}`,
        location,
        bedrooms: type.bedrooms,
        bathrooms: type.bathrooms,
        sqft: type.sqft,
        amenities: amenity,
        basePrice,
        currentPrice: basePrice,
        status: "available",
        listedForSale: false,
      });
    }

    return { success: true, count: 50 };
  },
});

// Get all available properties from market
export const getMarketProperties = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("properties")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .collect();
  },
});

// Get properties listed for sale by players
export const getPlayerListings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("properties")
      .withIndex("by_listed", (q) => q.eq("listedForSale", true))
      .collect();
  },
});

// Get user's owned properties
export const getMyProperties = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("properties")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
  },
});

// Buy property from market
export const buyFromMarket = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.status !== "available") throw new Error("Property not available");

    const userCredits = user.credits ?? 0;
    if (userCredits < property.currentPrice) {
      throw new Error("Insufficient credits");
    }

    // Deduct credits
    await ctx.db.patch(user._id, {
      credits: userCredits - property.currentPrice,
    });

    // Update property
    await ctx.db.patch(args.propertyId, {
      status: "sold",
      ownerId: user._id,
      ownerName: user.characterName || user.name,
      listedForSale: false,
    });

    // Record transaction
    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      buyerId: user._id,
      price: property.currentPrice,
      transactionType: "market_purchase",
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// List property for sale
export const listForSale = mutation({
  args: {
    propertyId: v.id("properties"),
    salePrice: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("Not your property");
    if (args.salePrice <= 0) throw new Error("Invalid price");

    await ctx.db.patch(args.propertyId, {
      listedForSale: true,
      salePrice: args.salePrice,
    });

    return { success: true };
  },
});

// Unlist property from sale
export const unlistFromSale = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("Not your property");

    await ctx.db.patch(args.propertyId, {
      listedForSale: false,
      salePrice: undefined,
    });

    return { success: true };
  },
});

// Buy property from another player
export const buyFromPlayer = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (!property.listedForSale) throw new Error("Property not for sale");
    if (!property.salePrice) throw new Error("No sale price set");
    if (property.ownerId === user._id) throw new Error("Cannot buy your own property");

    const userCredits = user.credits ?? 0;
    if (userCredits < property.salePrice) {
      throw new Error("Insufficient credits");
    }

    const seller = await ctx.db.get(property.ownerId!);
    if (!seller) throw new Error("Seller not found");

    // Transfer credits
    await ctx.db.patch(user._id, {
      credits: userCredits - property.salePrice,
    });

    const sellerCredits = seller.credits ?? 0;
    await ctx.db.patch(seller._id, {
      credits: sellerCredits + property.salePrice,
    });

    // Update property
    await ctx.db.patch(args.propertyId, {
      ownerId: user._id,
      ownerName: user.characterName || user.name,
      listedForSale: false,
      salePrice: undefined,
    });

    // Record transaction
    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      buyerId: user._id,
      sellerId: property.ownerId,
      price: property.salePrice,
      transactionType: "player_to_player",
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// Sell property back to bank (80% of current price)
export const sellToBank = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("Not your property");

    const bankBuyPrice = Math.floor(property.currentPrice * 0.8);
    const userCredits = user.credits ?? 0;

    // Add credits to user
    await ctx.db.patch(user._id, {
      credits: userCredits + bankBuyPrice,
    });

    // Reset property to market
    await ctx.db.patch(args.propertyId, {
      status: "available",
      ownerId: undefined,
      ownerName: undefined,
      listedForSale: false,
      salePrice: undefined,
    });

    // Record transaction
    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      sellerId: user._id,
      price: bankBuyPrice,
      transactionType: "bank_sale",
      timestamp: Date.now(),
    });

    return { success: true, amount: bankBuyPrice };
  },
});

// Admin: Get all properties
export const getAllPropertiesAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") return null;

    return await ctx.db.query("properties").collect();
  },
});

// Admin: Update property price
export const adminUpdatePrice = mutation({
  args: {
    propertyId: v.id("properties"),
    newPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }

    if (args.newPrice <= 0) throw new Error("Invalid price");

    await ctx.db.patch(args.propertyId, {
      currentPrice: args.newPrice,
    });

    return { success: true };
  },
});

// Admin: Trigger market event
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
    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const now = Date.now();
    const expiresAt = now + args.duration;

    // Create event
    await ctx.db.insert("realEstateEvents", {
      eventType: args.eventType,
      affectedArea: args.affectedArea,
      description: args.description,
      priceImpact: args.priceImpact,
      triggeredAt: now,
      expiresAt,
      status: "active",
    });

    // Apply price impact to properties in affected area
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_location", (q) => q.eq("location", args.affectedArea))
      .collect();

    for (const property of properties) {
      const impactMultiplier = 1 + args.priceImpact / 100;
      const newPrice = Math.floor(property.currentPrice * impactMultiplier);
      await ctx.db.patch(property._id, {
        currentPrice: newPrice,
      });
    }

    return { success: true, affectedProperties: properties.length };
  },
});

// Get active market events
export const getActiveEvents = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("realEstateEvents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

// Internal mutation to expire old market events
export const applyMarketEventsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeEvents = await ctx.db
      .query("realEstateEvents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const event of activeEvents) {
      if (event.expiresAt <= now) {
        await ctx.db.patch(event._id, { status: "expired" });
      }
    }
  },
});
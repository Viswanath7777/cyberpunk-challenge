import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getCurrentUser } from "./users";

// Mumbai locations for properties
const MUMBAI_LOCATIONS = [
  "Bandra West", "Andheri East", "Powai", "Juhu", "Worli",
  "Lower Parel", "Colaba", "Marine Drive", "Dadar", "Goregaon",
  "Malad", "Kandivali", "Borivali", "Thane", "Navi Mumbai",
  "Versova", "Lokhandwala", "Santacruz", "Khar", "Bandra East"
];

const AMENITIES = [
  "Swimming Pool", "Gym", "Parking", "Security", "Garden",
  "Club House", "Power Backup", "Lift", "CCTV", "Playground"
];

// Initialize 50 Mumbai properties
export const seedProperties = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const existingCount = await ctx.db.query("properties").collect();
    if (existingCount.length > 0) {
      throw new Error("Properties already seeded");
    }

    const properties = [];
    for (let i = 0; i < 50; i++) {
      const bedrooms = Math.floor(Math.random() * 4); // 0-3 (0 = studio)
      const bathrooms = bedrooms === 0 ? 1 : Math.floor(Math.random() * bedrooms) + 1;
      const sqft = bedrooms === 0 ? 400 + Math.random() * 200 : 600 + bedrooms * 300 + Math.random() * 400;
      const basePrice = bedrooms === 0 ? 50000 : 50000 + bedrooms * 30000;
      const price = Math.floor(basePrice + Math.random() * 20000);
      
      const location = MUMBAI_LOCATIONS[Math.floor(Math.random() * MUMBAI_LOCATIONS.length)];
      const amenityCount = 3 + Math.floor(Math.random() * 5);
      const selectedAmenities = AMENITIES.sort(() => 0.5 - Math.random()).slice(0, amenityCount);

      properties.push({
        name: `${location} ${bedrooms === 0 ? "Studio" : bedrooms + "BHK"} Apartment ${i + 1}`,
        location,
        bedrooms,
        bathrooms,
        sqft: Math.floor(sqft),
        amenities: selectedAmenities,
        basePrice: price,
        currentPrice: price,
        status: "available" as const,
        ownerId: undefined,
        ownerName: undefined,
        listedForSale: false,
        salePrice: undefined,
      });
    }

    for (const prop of properties) {
      await ctx.db.insert("properties", prop);
    }

    return { count: properties.length };
  },
});

// Get all properties (for market view)
export const listProperties = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const properties = await ctx.db.query("properties").collect();
    
    return properties.map(prop => ({
      ...prop,
      isOwned: prop.ownerId === user._id,
    }));
  },
});

// Get user's owned properties
export const myProperties = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("ownerId"), user._id))
      .collect();
  },
});

// Get properties listed for sale by other players
export const playerListings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("properties")
      .filter((q) => 
        q.and(
          q.eq(q.field("listedForSale"), true),
          q.neq(q.field("ownerId"), user._id)
        )
      )
      .collect();
  },
});

// Buy property from market or another player
export const buyProperty = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    if (property.status === "sold" && !property.listedForSale) {
      throw new Error("Property not available");
    }

    const price = property.listedForSale ? property.salePrice! : property.currentPrice;
    
    const userCredits = user.credits ?? 0;
    
    if (userCredits < price) {
      throw new Error("Insufficient credits");
    }

    // Deduct credits from buyer
    await ctx.db.patch(user._id, {
      credits: userCredits - price,
    });

    // If buying from another player, credit them
    if (property.ownerId) {
      const seller = await ctx.db.get(property.ownerId);
      if (seller) {
        const sellerCredits = seller.credits ?? 0;
        await ctx.db.patch(seller._id, {
          credits: sellerCredits + price,
        });
      }
    }

    // Update property ownership
    await ctx.db.patch(args.propertyId, {
      status: "sold",
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
      price,
      transactionType: property.ownerId ? "player_to_player" : "market_purchase",
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// List property for sale
export const listPropertyForSale = mutation({
  args: {
    propertyId: v.id("properties"),
    salePrice: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    if (property.ownerId !== user._id) {
      throw new Error("You don't own this property");
    }

    if (args.salePrice <= 0) {
      throw new Error("Invalid sale price");
    }

    await ctx.db.patch(args.propertyId, {
      listedForSale: true,
      salePrice: args.salePrice,
    });

    return { success: true };
  },
});

// Unlist property from sale
export const unlistProperty = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    if (property.ownerId !== user._id) {
      throw new Error("You don't own this property");
    }

    await ctx.db.patch(args.propertyId, {
      listedForSale: false,
      salePrice: undefined,
    });

    return { success: true };
  },
});

// Sell property back to bank
export const sellToBank = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    if (property.ownerId !== user._id) {
      throw new Error("You don't own this property");
    }

    // Bank buys at 80% of current price
    const bankPrice = Math.floor(property.currentPrice * 0.8);
    const userCredits = user.credits ?? 0;

    await ctx.db.patch(user._id, {
      credits: userCredits + bankPrice,
    });

    await ctx.db.patch(args.propertyId, {
      status: "available",
      ownerId: undefined,
      ownerName: undefined,
      listedForSale: false,
      salePrice: undefined,
    });

    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      buyerId: undefined,
      sellerId: user._id,
      price: bankPrice,
      transactionType: "bank_sale",
      timestamp: Date.now(),
    });

    return { success: true, amount: bankPrice };
  },
});

// Admin: Get all properties
export const getAllPropertiesAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") return null;

    const properties = await ctx.db.query("properties").collect();
    
    // Enrich with owner names
    const enriched = await Promise.all(
      properties.map(async (prop) => {
        if (prop.ownerId) {
          const owner = await ctx.db.get(prop.ownerId);
          return {
            ...prop,
            ownerName: owner?.characterName || owner?.name || "Unknown",
          };
        }
        return prop;
      })
    );

    return enriched;
  },
});

// Admin: Manually update property price
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

    if (args.newPrice <= 0) {
      throw new Error("Invalid price");
    }

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
    priceImpact: v.number(), // percentage
    duration: v.number(), // milliseconds
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Create event record
    await ctx.db.insert("realEstateEvents", {
      eventType: args.eventType,
      affectedArea: args.affectedArea,
      description: args.description,
      priceImpact: args.priceImpact,
      triggeredAt: Date.now(),
      expiresAt: Date.now() + args.duration,
      status: "active",
    });

    // Apply price changes immediately
    const properties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("location"), args.affectedArea))
      .collect();

    for (const property of properties) {
      const multiplier = 1 + args.priceImpact / 100;
      const newPrice = Math.floor(property.currentPrice * multiplier);
      await ctx.db.patch(property._id, {
        currentPrice: Math.max(10000, newPrice), // Minimum 10k credits
      });
    }

    return { success: true, propertiesAffected: properties.length };
  },
});

// Get active market events
export const getActiveEvents = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const now = Date.now();
    return await ctx.db
      .query("realEstateEvents")
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "active"),
          q.gt(q.field("expiresAt"), now)
        )
      )
      .order("desc")
      .take(10);
  },
});
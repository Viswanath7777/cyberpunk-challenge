import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// List all properties
export const listProperties = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("properties").collect();
  },
});

// Get property details with recent events
export const getPropertyDetails = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) return null;

    const recentEvents = await ctx.db
      .query("realEstateEvents")
      .filter((q) => q.eq(q.field("affectedArea"), property.location))
      .order("desc")
      .take(5);

    return { property, recentEvents };
  },
});

// Get user's properties
export const getUserProperties = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user) return null;

    const properties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("ownerId"), user._id))
      .collect();

    const totalValue = properties.reduce((sum, p) => sum + p.currentPrice, 0);
    const totalInvested = properties.reduce((sum, p) => sum + p.basePrice, 0);
    const profitLoss = totalValue - totalInvested;

    return { properties, totalValue, totalInvested, profitLoss };
  },
});

// Buy property from market
export const buyProperty = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user) throw new Error("User not found");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.status !== "available") throw new Error("Property not available");
    if (property.ownerId) throw new Error("Property already owned");

    const userCredits = user.credits ?? 0;
    if (userCredits < property.currentPrice) {
      throw new Error(`Insufficient credits: You have ${userCredits} credits but property costs ${property.currentPrice}`);
    }

    await ctx.db.patch(user._id, {
      credits: userCredits - property.currentPrice,
    });

    await ctx.db.patch(args.propertyId, {
      status: "owned",
      ownerId: user._id,
      purchasedAt: Date.now(),
    });

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

// Sell property back to market
export const sellProperty = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user) throw new Error("User not found");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("Not your property");

    const userCredits = user.credits ?? 0;
    await ctx.db.patch(user._id, {
      credits: userCredits + property.currentPrice,
    });

    await ctx.db.patch(args.propertyId, {
      status: "available",
      ownerId: undefined,
      purchasedAt: undefined,
      listedForSale: false,
      askingPrice: undefined,
      listedAt: undefined,
    });

    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      sellerId: user._id,
      price: property.currentPrice,
      transactionDate: Date.now(),
      transactionType: "market_sale",
    });

    return { success: true };
  },
});

// List property for sale to other players
export const listPropertyForSale = mutation({
  args: {
    propertyId: v.id("properties"),
    askingPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user) throw new Error("User not found");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("Not your property");

    await ctx.db.patch(args.propertyId, {
      listedForSale: true,
      askingPrice: args.askingPrice,
      listedAt: Date.now(),
    });

    return { success: true };
  },
});

// Delist property from player sales
export const delistProperty = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user) throw new Error("User not found");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("Not your property");

    await ctx.db.patch(args.propertyId, {
      listedForSale: false,
      askingPrice: undefined,
      listedAt: undefined,
    });

    return { success: true };
  },
});

// Get player listings
export const getPlayerListings = query({
  args: {},
  handler: async (ctx) => {
    const properties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("listedForSale"), true))
      .collect();

    const enriched = await Promise.all(
      properties.map(async (p) => {
        const owner = p.ownerId ? await ctx.db.get(p.ownerId) : null;
        return {
          ...p,
          ownerName: owner?.characterName ?? "Unknown",
          originalPrice: p.basePrice,
        };
      })
    );

    return enriched;
  },
});

// Buy from player
export const buyFromPlayer = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const buyer = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!buyer) throw new Error("User not found");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (!property.listedForSale) throw new Error("Property not for sale");
    if (!property.askingPrice) throw new Error("No asking price set");
    if (property.ownerId === buyer._id) throw new Error("Cannot buy your own property");

    const buyerCredits = buyer.credits ?? 0;
    if (buyerCredits < property.askingPrice) {
      throw new Error("Insufficient credits");
    }

    const seller = property.ownerId ? await ctx.db.get(property.ownerId) : null;
    if (!seller) throw new Error("Seller not found");

    await ctx.db.patch(buyer._id, {
      credits: buyerCredits - property.askingPrice,
    });

    const sellerCredits = seller.credits ?? 0;
    await ctx.db.patch(seller._id, {
      credits: sellerCredits + property.askingPrice,
    });

    await ctx.db.patch(args.propertyId, {
      ownerId: buyer._id,
      purchasedAt: Date.now(),
      listedForSale: false,
      askingPrice: undefined,
      listedAt: undefined,
    });

    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      buyerId: buyer._id,
      sellerId: seller._id,
      price: property.askingPrice,
      transactionDate: Date.now(),
      transactionType: "player_sale",
    });

    return { success: true };
  },
});

// Get market events
export const getMarketEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("realEstateEvents")
      .order("desc")
      .take(10);
  },
});

// Seed properties (initialize market)
export const seedProperties = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("properties").first();
    if (existing) {
      const all = await ctx.db.query("properties").collect();
      for (const p of all) {
        await ctx.db.delete(p._id);
      }
    }

    const mumbaiProperties = [
      { name: "Studio Apt - Andheri", location: "Andheri West", propertyType: "Studio", basePrice: 75000, bedrooms: 0, bathrooms: 1, sqft: 350, amenities: ["Gym", "Security"], description: "Compact studio near metro" },
      { name: "1BHK - Bandra", location: "Bandra West", propertyType: "Apartment", basePrice: 125000, bedrooms: 1, bathrooms: 1, sqft: 550, amenities: ["Gym", "Pool", "Parking"], description: "Modern 1BHK in prime location" },
      { name: "2BHK - Powai", location: "Powai", propertyType: "Apartment", basePrice: 150000, bedrooms: 2, bathrooms: 2, sqft: 850, amenities: ["Gym", "Pool", "Garden"], description: "Spacious 2BHK with lake view" },
      { name: "Studio - Malad", location: "Malad East", propertyType: "Studio", basePrice: 70000, bedrooms: 0, bathrooms: 1, sqft: 320, amenities: ["Security"], description: "Affordable studio near station" },
      { name: "3BHK - Juhu", location: "Juhu", propertyType: "Apartment", basePrice: 250000, bedrooms: 3, bathrooms: 3, sqft: 1400, amenities: ["Gym", "Pool", "Beach Access", "Parking"], description: "Luxury apartment near beach" },
      { name: "1BHK - Goregaon", location: "Goregaon West", propertyType: "Apartment", basePrice: 110000, bedrooms: 1, bathrooms: 1, sqft: 500, amenities: ["Gym", "Parking"], description: "Well-connected 1BHK" },
      { name: "2BHK - Thane", location: "Thane West", propertyType: "Apartment", basePrice: 130000, bedrooms: 2, bathrooms: 2, sqft: 800, amenities: ["Gym", "Garden", "Parking"], description: "Spacious flat in Thane" },
      { name: "Studio - Kandivali", location: "Kandivali East", propertyType: "Studio", basePrice: 65000, bedrooms: 0, bathrooms: 1, sqft: 300, amenities: ["Security"], description: "Budget-friendly studio" },
      { name: "4BHK - Worli", location: "Worli", propertyType: "Penthouse", basePrice: 400000, bedrooms: 4, bathrooms: 4, sqft: 2200, amenities: ["Gym", "Pool", "Concierge", "Sea View"], description: "Premium penthouse with sea view" },
      { name: "1BHK - Borivali", location: "Borivali West", propertyType: "Apartment", basePrice: 105000, bedrooms: 1, bathrooms: 1, sqft: 480, amenities: ["Gym", "Parking"], description: "Comfortable 1BHK near park" },
      { name: "2BHK - Chembur", location: "Chembur", propertyType: "Apartment", basePrice: 140000, bedrooms: 2, bathrooms: 2, sqft: 820, amenities: ["Gym", "Pool", "Parking"], description: "Modern 2BHK in East Mumbai" },
      { name: "Studio - Dahisar", location: "Dahisar East", propertyType: "Studio", basePrice: 60000, bedrooms: 0, bathrooms: 1, sqft: 280, amenities: ["Security"], description: "Cozy studio apartment" },
      { name: "3BHK - Lower Parel", location: "Lower Parel", propertyType: "Apartment", basePrice: 280000, bedrooms: 3, bathrooms: 3, sqft: 1500, amenities: ["Gym", "Pool", "Clubhouse", "Parking"], description: "Premium 3BHK in central Mumbai" },
      { name: "1BHK - Mulund", location: "Mulund West", propertyType: "Apartment", basePrice: 115000, bedrooms: 1, bathrooms: 1, sqft: 520, amenities: ["Gym", "Garden", "Parking"], description: "Peaceful 1BHK in suburbs" },
      { name: "2BHK - Ghatkopar", location: "Ghatkopar West", propertyType: "Apartment", basePrice: 135000, bedrooms: 2, bathrooms: 2, sqft: 780, amenities: ["Gym", "Parking"], description: "Well-maintained 2BHK" },
      { name: "Studio - Mira Road", location: "Mira Road", propertyType: "Studio", basePrice: 55000, bedrooms: 0, bathrooms: 1, sqft: 260, amenities: ["Security"], description: "Affordable studio in extended suburbs" },
      { name: "3BHK - Versova", location: "Versova", propertyType: "Apartment", basePrice: 220000, bedrooms: 3, bathrooms: 2, sqft: 1200, amenities: ["Gym", "Pool", "Parking"], description: "Spacious 3BHK near beach" },
      { name: "1BHK - Vile Parle", location: "Vile Parle East", propertyType: "Apartment", basePrice: 120000, bedrooms: 1, bathrooms: 1, sqft: 540, amenities: ["Gym", "Parking"], description: "Convenient location near airport" },
      { name: "2BHK - Santacruz", location: "Santacruz West", propertyType: "Apartment", basePrice: 160000, bedrooms: 2, bathrooms: 2, sqft: 880, amenities: ["Gym", "Pool", "Parking"], description: "Prime 2BHK in West Mumbai" },
      { name: "Studio - Virar", location: "Virar West", propertyType: "Studio", basePrice: 50000, bedrooms: 0, bathrooms: 1, sqft: 240, amenities: ["Security"], description: "Budget studio in far suburbs" },
      { name: "4BHK - Bandra", location: "Bandra West", propertyType: "Penthouse", basePrice: 450000, bedrooms: 4, bathrooms: 4, sqft: 2500, amenities: ["Gym", "Pool", "Terrace", "Parking"], description: "Luxury penthouse in Bandra" },
      { name: "1BHK - Kurla", location: "Kurla West", propertyType: "Apartment", basePrice: 100000, bedrooms: 1, bathrooms: 1, sqft: 460, amenities: ["Gym", "Parking"], description: "Affordable 1BHK near station" },
      { name: "2BHK - Khar", location: "Khar West", propertyType: "Apartment", basePrice: 180000, bedrooms: 2, bathrooms: 2, sqft: 920, amenities: ["Gym", "Pool", "Parking"], description: "Upscale 2BHK in Khar" },
      { name: "Studio - Vasai", location: "Vasai West", propertyType: "Studio", basePrice: 52000, bedrooms: 0, bathrooms: 1, sqft: 250, amenities: ["Security"], description: "Simple studio in Vasai" },
      { name: "3BHK - Andheri", location: "Andheri East", propertyType: "Apartment", basePrice: 200000, bedrooms: 3, bathrooms: 2, sqft: 1100, amenities: ["Gym", "Pool", "Parking"], description: "Spacious 3BHK near business district" },
      { name: "1BHK - Dadar", location: "Dadar West", propertyType: "Apartment", basePrice: 130000, bedrooms: 1, bathrooms: 1, sqft: 560, amenities: ["Gym", "Parking"], description: "Central location 1BHK" },
      { name: "2BHK - Matunga", location: "Matunga East", propertyType: "Apartment", basePrice: 145000, bedrooms: 2, bathrooms: 2, sqft: 840, amenities: ["Gym", "Garden", "Parking"], description: "Heritage area 2BHK" },
      { name: "Studio - Nalasopara", location: "Nalasopara West", propertyType: "Studio", basePrice: 48000, bedrooms: 0, bathrooms: 1, sqft: 230, amenities: ["Security"], description: "Basic studio apartment" },
      { name: "3BHK - Colaba", location: "Colaba", propertyType: "Apartment", basePrice: 350000, bedrooms: 3, bathrooms: 3, sqft: 1600, amenities: ["Gym", "Pool", "Sea View", "Parking"], description: "Premium 3BHK in South Mumbai" },
      { name: "1BHK - Jogeshwari", location: "Jogeshwari West", propertyType: "Apartment", basePrice: 108000, bedrooms: 1, bathrooms: 1, sqft: 490, amenities: ["Gym", "Parking"], description: "Convenient 1BHK" },
      { name: "2BHK - Wadala", location: "Wadala East", propertyType: "Apartment", basePrice: 155000, bedrooms: 2, bathrooms: 2, sqft: 860, amenities: ["Gym", "Pool", "Parking"], description: "Modern 2BHK in redeveloped area" },
      { name: "Studio - Bhayander", location: "Bhayander West", propertyType: "Studio", basePrice: 54000, bedrooms: 0, bathrooms: 1, sqft: 270, amenities: ["Security"], description: "Compact studio in suburbs" },
      { name: "4BHK - Marine Drive", location: "Marine Drive", propertyType: "Penthouse", basePrice: 500000, bedrooms: 4, bathrooms: 4, sqft: 2800, amenities: ["Gym", "Pool", "Sea View", "Concierge"], description: "Ultra-luxury penthouse on Marine Drive" },
      { name: "1BHK - Vikhroli", location: "Vikhroli West", propertyType: "Apartment", basePrice: 112000, bedrooms: 1, bathrooms: 1, sqft: 510, amenities: ["Gym", "Garden", "Parking"], description: "Green surroundings 1BHK" },
      { name: "2BHK - Bhandup", location: "Bhandup West", propertyType: "Apartment", basePrice: 125000, bedrooms: 2, bathrooms: 2, sqft: 760, amenities: ["Gym", "Parking"], description: "Affordable 2BHK in suburbs" },
      { name: "Studio - Navi Mumbai", location: "Vashi", propertyType: "Studio", basePrice: 68000, bedrooms: 0, bathrooms: 1, sqft: 310, amenities: ["Security", "Parking"], description: "Studio in planned city" },
      { name: "3BHK - Parel", location: "Parel", propertyType: "Apartment", basePrice: 260000, bedrooms: 3, bathrooms: 3, sqft: 1450, amenities: ["Gym", "Pool", "Clubhouse", "Parking"], description: "Luxury 3BHK in central location" },
      { name: "1BHK - Dombivli", location: "Dombivli East", propertyType: "Apartment", basePrice: 95000, bedrooms: 1, bathrooms: 1, sqft: 440, amenities: ["Gym", "Parking"], description: "Budget 1BHK in extended suburbs" },
      { name: "2BHK - Kalyan", location: "Kalyan West", propertyType: "Apartment", basePrice: 118000, bedrooms: 2, bathrooms: 2, sqft: 740, amenities: ["Gym", "Garden", "Parking"], description: "Spacious 2BHK in Kalyan" },
      { name: "Studio - Airoli", location: "Airoli", propertyType: "Studio", basePrice: 62000, bedrooms: 0, bathrooms: 1, sqft: 290, amenities: ["Security", "Parking"], description: "Modern studio in Navi Mumbai" },
      { name: "3BHK - Churchgate", location: "Churchgate", propertyType: "Apartment", basePrice: 380000, bedrooms: 3, bathrooms: 3, sqft: 1700, amenities: ["Gym", "Pool", "Heritage Building", "Parking"], description: "Heritage 3BHK in South Mumbai" },
      { name: "1BHK - Kharghar", location: "Kharghar", propertyType: "Apartment", basePrice: 102000, bedrooms: 1, bathrooms: 1, sqft: 470, amenities: ["Gym", "Garden", "Parking"], description: "Peaceful 1BHK in Navi Mumbai" },
      { name: "2BHK - Nerul", location: "Nerul", propertyType: "Apartment", basePrice: 128000, bedrooms: 2, bathrooms: 2, sqft: 790, amenities: ["Gym", "Pool", "Parking"], description: "Well-planned 2BHK" },
      { name: "Studio - Panvel", location: "Panvel", propertyType: "Studio", basePrice: 58000, bedrooms: 0, bathrooms: 1, sqft: 275, amenities: ["Security"], description: "Affordable studio in Panvel" },
      { name: "3BHK - Goregaon", location: "Goregaon East", propertyType: "Apartment", basePrice: 195000, bedrooms: 3, bathrooms: 2, sqft: 1080, amenities: ["Gym", "Pool", "Parking"], description: "Family-friendly 3BHK" },
      { name: "1BHK - Malad", location: "Malad West", propertyType: "Apartment", basePrice: 107000, bedrooms: 1, bathrooms: 1, sqft: 485, amenities: ["Gym", "Parking"], description: "Convenient 1BHK near Link Road" },
      { name: "2BHK - Kandivali", location: "Kandivali West", propertyType: "Apartment", basePrice: 132000, bedrooms: 2, bathrooms: 2, sqft: 810, amenities: ["Gym", "Garden", "Parking"], description: "Comfortable 2BHK in West suburbs" },
      { name: "Studio - Ulhasnagar", location: "Ulhasnagar", propertyType: "Studio", basePrice: 46000, bedrooms: 0, bathrooms: 1, sqft: 220, amenities: ["Security"], description: "Basic studio in Ulhasnagar" },
      { name: "3BHK - Mahim", location: "Mahim", propertyType: "Apartment", basePrice: 240000, bedrooms: 3, bathrooms: 3, sqft: 1350, amenities: ["Gym", "Pool", "Sea View", "Parking"], description: "Premium 3BHK near sea" },
      { name: "2BHK - Belapur", location: "Belapur", propertyType: "Apartment", basePrice: 122000, bedrooms: 2, bathrooms: 2, sqft: 750, amenities: ["Gym", "Garden", "Parking"], description: "Serene 2BHK in Navi Mumbai" },
    ];

    for (const prop of mumbaiProperties) {
      await ctx.db.insert("properties", {
        ...prop,
        currentPrice: prop.basePrice,
        status: "available",
        priceHistory: [{ t: Date.now(), v: prop.basePrice, event: "Initial listing" }],
        listedForSale: false,
      });
    }

    return { success: true, count: mumbaiProperties.length };
  },
});

// Apply market events (called by cron)
export const applyMarketEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeEvents = await ctx.db.query("realEstateEvents").collect();

    for (const event of activeEvents) {
      const eventAge = now - event.occurredAt;
      if (eventAge > event.duration) continue;

      const properties = await ctx.db
        .query("properties")
        .filter((q) => q.eq(q.field("location"), event.affectedArea))
        .collect();

      for (const property of properties) {
        const newPrice = Math.floor(property.currentPrice * (1 + event.priceImpact / 100));
        await ctx.db.patch(property._id, {
          currentPrice: newPrice,
          priceHistory: [
            ...property.priceHistory,
            { t: now, v: newPrice, event: event.description },
          ],
        });
      }
    }
  },
});

// Admin: Update property price
export const adminUpdatePrice = mutation({
  args: {
    propertyId: v.id("properties"),
    newPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    await ctx.db.patch(args.propertyId, {
      currentPrice: args.newPrice,
      priceHistory: [
        ...property.priceHistory,
        { t: Date.now(), v: args.newPrice, event: "Admin price adjustment" },
      ],
    });

    await ctx.db.insert("realEstateEvents", {
      eventType: "admin_adjustment",
      affectedArea: property.location,
      description: `Admin adjusted ${property.name} price to ${args.newPrice}`,
      priceImpact: 0,
      duration: 0,
      occurredAt: Date.now(),
    });

    return { success: true };
  },
});

// Admin: Trigger custom event
export const adminTriggerEvent = mutation({
  args: {
    eventType: v.string(),
    affectedArea: v.string(),
    description: v.string(),
    priceImpact: v.number(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user || user.role !== "admin") {
      throw new Error("Admin access required");
    }

    await ctx.db.insert("realEstateEvents", {
      eventType: args.eventType,
      affectedArea: args.affectedArea,
      description: args.description,
      priceImpact: args.priceImpact,
      duration: args.duration,
      occurredAt: Date.now(),
    });

    const properties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("location"), args.affectedArea))
      .collect();

    for (const property of properties) {
      const newPrice = Math.floor(property.currentPrice * (1 + args.priceImpact / 100));
      await ctx.db.patch(property._id, {
        currentPrice: newPrice,
        priceHistory: [
          ...property.priceHistory,
          { t: Date.now(), v: newPrice, event: args.description },
        ],
      });
    }

    return { success: true };
  },
});

// Admin: Get all properties
export const getAllPropertiesAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user || user.role !== "admin") return null;

    const properties = await ctx.db.query("properties").collect();

    const enriched = await Promise.all(
      properties.map(async (p) => {
        const owner = p.ownerId ? await ctx.db.get(p.ownerId) : null;
        return {
          ...p,
          ownerName: owner?.characterName ?? null,
          ownerEmail: owner?.email ?? null,
        };
      })
    );

    return enriched;
  },
});

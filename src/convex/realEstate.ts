import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getCurrentUser } from "./users";

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
    if (!property) throw new Error("Property not found");
    
    const recentEvents = await ctx.db
      .query("realEstateEvents")
      .filter((q) => q.eq(q.field("affectedArea"), property.location))
      .order("desc")
      .take(5);
    
    return { property, recentEvents };
  },
});

// Get user's properties with portfolio stats
export const getUserProperties = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const properties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("ownerId"), user._id))
      .collect();

    const totalValue = properties.reduce((sum, p) => sum + p.currentPrice, 0);
    const totalInvested = properties.reduce((sum, p) => {
      const purchasePrice = p.priceHistory[0]?.price || p.basePrice;
      return sum + purchasePrice;
    }, 0);
    const profitLoss = totalValue - totalInvested;

    return { properties, totalValue, totalInvested, profitLoss };
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
        const purchasePrice = p.priceHistory[0]?.price || p.basePrice;
        return {
          ...p,
          ownerName: owner?.characterName || owner?.name || "Unknown",
          originalPurchasePrice: purchasePrice,
        };
      })
    );

    return enriched;
  },
});

// Buy property from market
export const buyProperty = mutation({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.status !== "available") throw new Error("Property not available");
    if (property.ownerId) throw new Error("Property already owned");

    const userCredits = user.credits ?? 0;
    if (userCredits < property.currentPrice) {
      throw new Error("Insufficient credits");
    }

    await ctx.db.patch(user._id, {
      credits: userCredits - property.currentPrice,
    });

    await ctx.db.patch(args.propertyId, {
      status: "owned" as const,
      ownerId: user._id,
      purchasedAt: Date.now(),
      priceHistory: [
        ...property.priceHistory,
        { timestamp: Date.now(), price: property.currentPrice, event: "Purchased by player" },
      ],
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
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId !== user._id) throw new Error("You don't own this property");

    const userCredits = user.credits ?? 0;
    await ctx.db.patch(user._id, {
      credits: userCredits + property.currentPrice,
    });

    await ctx.db.patch(args.propertyId, {
      status: "available" as const,
      ownerId: undefined,
      purchasedAt: undefined,
      listedForSale: false,
      askingPrice: undefined,
      listedAt: undefined,
      priceHistory: [
        ...property.priceHistory,
        { timestamp: Date.now(), price: property.currentPrice, event: "Sold back to market" },
      ],
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

// List property for player-to-player sale
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

    return { success: true };
  },
});

// Delist property from player-to-player sale
export const delistProperty = mutation({
  args: { propertyId: v.id("properties") },
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
    if (!property.listedForSale) throw new Error("Property not listed for sale");
    if (!property.askingPrice) throw new Error("No asking price set");
    if (property.ownerId === user._id) throw new Error("You already own this property");

    const userCredits = user.credits ?? 0;
    if (userCredits < property.askingPrice) {
      throw new Error("Insufficient credits");
    }

    const seller = property.ownerId ? await ctx.db.get(property.ownerId) : null;
    if (!seller) throw new Error("Seller not found");

    const sellerCredits = seller.credits ?? 0;
    await ctx.db.patch(seller._id, {
      credits: sellerCredits + property.askingPrice,
    });

    await ctx.db.patch(user._id, {
      credits: userCredits - property.askingPrice,
    });

    await ctx.db.patch(args.propertyId, {
      ownerId: user._id,
      purchasedAt: Date.now(),
      listedForSale: false,
      askingPrice: undefined,
      listedAt: undefined,
      priceHistory: [
        ...property.priceHistory,
        { timestamp: Date.now(), price: property.askingPrice, event: "Sold to player" },
      ],
    });

    await ctx.db.insert("propertyTransactions", {
      propertyId: args.propertyId,
      buyerId: user._id,
      sellerId: seller._id,
      price: property.askingPrice,
      transactionDate: Date.now(),
      transactionType: "player_sale",
    });

    return { success: true };
  },
});

// Seed 50 Mumbai properties
export const seedProperties = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all existing properties first
    const existing = await ctx.db.query("properties").collect();
    for (const prop of existing) {
      await ctx.db.delete(prop._id);
    }

    const properties = [
      // Bandra Properties (10)
      { name: "Sea View Studio", location: "Bandra West", propertyType: "Studio", basePrice: 75000, amenities: ["Sea View", "24/7 Security", "Parking"], bedrooms: 0, bathrooms: 1, sqft: 450, description: "Cozy studio with stunning sea views in prime Bandra West location." },
      { name: "Bandra Linking Road 1BHK", location: "Bandra West", propertyType: "1BHK", basePrice: 95000, amenities: ["Gym", "Parking", "Power Backup"], bedrooms: 1, bathrooms: 1, sqft: 650, description: "Modern 1BHK near Linking Road shopping district." },
      { name: "Hill Road Apartment", location: "Bandra West", propertyType: "2BHK", basePrice: 135000, amenities: ["Gym", "Pool", "Security", "Parking"], bedrooms: 2, bathrooms: 2, sqft: 950, description: "Spacious 2BHK in the heart of Bandra's entertainment district." },
      { name: "Bandstand Luxury", location: "Bandra West", propertyType: "3BHK", basePrice: 225000, amenities: ["Sea View", "Gym", "Pool", "Clubhouse", "Parking"], bedrooms: 3, bathrooms: 3, sqft: 1500, description: "Premium 3BHK with panoramic sea views near Bandstand Promenade." },
      { name: "Carter Road Penthouse", location: "Bandra West", propertyType: "Penthouse", basePrice: 450000, amenities: ["Sea View", "Private Terrace", "Gym", "Pool", "Concierge"], bedrooms: 4, bathrooms: 4, sqft: 3000, description: "Ultra-luxury penthouse with private terrace overlooking the Arabian Sea." },
      { name: "Bandra East Studio", location: "Bandra East", propertyType: "Studio", basePrice: 60000, amenities: ["Security", "Parking"], bedrooms: 0, bathrooms: 1, sqft: 400, description: "Affordable studio in upcoming Bandra East." },
      { name: "Kalanagar 2BHK", location: "Bandra East", propertyType: "2BHK", basePrice: 110000, amenities: ["Gym", "Security", "Parking"], bedrooms: 2, bathrooms: 2, sqft: 850, description: "Well-connected 2BHK near BKC business district." },
      { name: "BKC View Apartment", location: "Bandra East", propertyType: "3BHK", basePrice: 185000, amenities: ["Gym", "Pool", "Security", "Parking", "Power Backup"], bedrooms: 3, bathrooms: 2, sqft: 1200, description: "Modern 3BHK with views of BKC skyline." },
      { name: "Khar West 1BHK", location: "Khar West", propertyType: "1BHK", basePrice: 88000, amenities: ["Gym", "Parking", "Security"], bedrooms: 1, bathrooms: 1, sqft: 600, description: "Trendy 1BHK in Khar's cafe district." },
      { name: "Khar Danda Villa", location: "Khar West", propertyType: "Villa", basePrice: 550000, amenities: ["Private Garden", "Pool", "Parking", "Security", "Gym"], bedrooms: 5, bathrooms: 5, sqft: 4000, description: "Exclusive villa with private garden in elite Khar Danda." },

      // Andheri Properties (8)
      { name: "Andheri West Studio", location: "Andheri West", propertyType: "Studio", basePrice: 55000, amenities: ["Security", "Parking"], bedrooms: 0, bathrooms: 1, sqft: 380, description: "Compact studio near Andheri metro station." },
      { name: "Lokhandwala 1BHK", location: "Andheri West", propertyType: "1BHK", basePrice: 82000, amenities: ["Gym", "Security", "Parking", "Power Backup"], bedrooms: 1, bathrooms: 1, sqft: 580, description: "Well-maintained 1BHK in Lokhandwala Complex." },
      { name: "Versova Beach 2BHK", location: "Andheri West", propertyType: "2BHK", basePrice: 125000, amenities: ["Sea View", "Gym", "Pool", "Security"], bedrooms: 2, bathrooms: 2, sqft: 900, description: "Beachside 2BHK with sea breeze and sunset views." },
      { name: "Oshiwara 3BHK", location: "Andheri West", propertyType: "3BHK", basePrice: 165000, amenities: ["Gym", "Parking", "Security", "Clubhouse"], bedrooms: 3, bathrooms: 2, sqft: 1100, description: "Family-friendly 3BHK in peaceful Oshiwara." },
      { name: "Andheri East Studio", location: "Andheri East", propertyType: "Studio", basePrice: 52000, amenities: ["Security", "Parking"], bedrooms: 0, bathrooms: 1, sqft: 360, description: "Budget studio near MIDC and Chakala." },
      { name: "Marol 1BHK", location: "Andheri East", propertyType: "1BHK", basePrice: 75000, amenities: ["Gym", "Security", "Parking"], bedrooms: 1, bathrooms: 1, sqft: 550, description: "Convenient 1BHK near corporate offices." },
      { name: "Saki Naka 2BHK", location: "Andheri East", propertyType: "2BHK", basePrice: 98000, amenities: ["Gym", "Security", "Parking", "Power Backup"], bedrooms: 2, bathrooms: 2, sqft: 800, description: "Affordable 2BHK with metro connectivity." },
      { name: "JB Nagar 3BHK", location: "Andheri East", propertyType: "3BHK", basePrice: 145000, amenities: ["Gym", "Pool", "Security", "Parking"], bedrooms: 3, bathrooms: 2, sqft: 1050, description: "Spacious 3BHK in established residential area." },

      // Juhu Properties (5)
      { name: "Juhu Beach Studio", location: "Juhu", propertyType: "Studio", basePrice: 85000, amenities: ["Sea View", "Security", "Parking"], bedrooms: 0, bathrooms: 1, sqft: 480, description: "Beachfront studio with direct sea access." },
      { name: "Juhu Tara Road 2BHK", location: "Juhu", propertyType: "2BHK", basePrice: 155000, amenities: ["Sea View", "Gym", "Pool", "Security", "Parking"], bedrooms: 2, bathrooms: 2, sqft: 1000, description: "Elegant 2BHK on iconic Juhu Tara Road." },
      { name: "JVPD 3BHK", location: "Juhu", propertyType: "3BHK", basePrice: 215000, amenities: ["Gym", "Pool", "Security", "Parking", "Clubhouse"], bedrooms: 3, bathrooms: 3, sqft: 1400, description: "Premium 3BHK in upscale JVPD scheme." },
      { name: "Juhu Beach Penthouse", location: "Juhu", propertyType: "Penthouse", basePrice: 525000, amenities: ["Sea View", "Private Terrace", "Pool", "Gym", "Concierge", "Parking"], bedrooms: 4, bathrooms: 4, sqft: 3200, description: "Iconic beachfront penthouse with celebrity neighbors." },
      { name: "Juhu Villa", location: "Juhu", propertyType: "Villa", basePrice: 650000, amenities: ["Sea View", "Private Pool", "Garden", "Security", "Parking"], bedrooms: 5, bathrooms: 5, sqft: 4500, description: "Luxurious beachside villa with private pool and garden." },

      // Worli & Lower Parel (7)
      { name: "Worli Sea Face Studio", location: "Worli", propertyType: "Studio", basePrice: 95000, amenities: ["Sea View", "Gym", "Security", "Parking"], bedrooms: 0, bathrooms: 1, sqft: 500, description: "Premium studio on Worli Sea Face." },
      { name: "Worli 2BHK", location: "Worli", propertyType: "2BHK", basePrice: 175000, amenities: ["Sea View", "Gym", "Pool", "Security", "Parking", "Clubhouse"], bedrooms: 2, bathrooms: 2, sqft: 1100, description: "Luxury 2BHK with sea link views." },
      { name: "Worli Tower 3BHK", location: "Worli", propertyType: "3BHK", basePrice: 285000, amenities: ["Sea View", "Gym", "Pool", "Spa", "Security", "Concierge"], bedrooms: 3, bathrooms: 3, sqft: 1800, description: "High-rise 3BHK in iconic Worli tower." },
      { name: "Worli Penthouse", location: "Worli", propertyType: "Penthouse", basePrice: 750000, amenities: ["Sea View", "Private Pool", "Gym", "Spa", "Concierge", "Helipad Access"], bedrooms: 5, bathrooms: 5, sqft: 5000, description: "Ultra-luxury penthouse with helipad access." },
      { name: "Lower Parel 1BHK", location: "Lower Parel", propertyType: "1BHK", basePrice: 92000, amenities: ["Gym", "Security", "Parking", "Power Backup"], bedrooms: 1, bathrooms: 1, sqft: 620, description: "Modern 1BHK near Phoenix Mills." },
      { name: "Lower Parel 2BHK", location: "Lower Parel", propertyType: "2BHK", basePrice: 145000, amenities: ["Gym", "Pool", "Security", "Parking", "Clubhouse"], bedrooms: 2, bathrooms: 2, sqft: 950, description: "Upscale 2BHK in redeveloped mill district." },
      { name: "Parel 3BHK", location: "Lower Parel", propertyType: "3BHK", basePrice: 225000, amenities: ["Gym", "Pool", "Security", "Parking", "Spa", "Clubhouse"], bedrooms: 3, bathrooms: 3, sqft: 1500, description: "Luxurious 3BHK with modern amenities." },

      // Powai (5)
      { name: "Powai Lake Studio", location: "Powai", propertyType: "Studio", basePrice: 62000, amenities: ["Lake View", "Security", "Parking"], bedrooms: 0, bathrooms: 1, sqft: 420, description: "Serene studio overlooking Powai Lake." },
      { name: "Hiranandani 1BHK", location: "Powai", propertyType: "1BHK", basePrice: 85000, amenities: ["Gym", "Pool", "Security", "Parking", "Garden"], bedrooms: 1, bathrooms: 1, sqft: 600, description: "Well-planned 1BHK in Hiranandani Gardens." },
      { name: "Powai 2BHK", location: "Powai", propertyType: "2BHK", basePrice: 128000, amenities: ["Lake View", "Gym", "Pool", "Security", "Parking"], bedrooms: 2, bathrooms: 2, sqft: 920, description: "Spacious 2BHK with lake views." },
      { name: "Hiranandani 3BHK", location: "Powai", propertyType: "3BHK", basePrice: 185000, amenities: ["Lake View", "Gym", "Pool", "Clubhouse", "Security", "Parking"], bedrooms: 3, bathrooms: 2, sqft: 1300, description: "Premium 3BHK in gated community." },
      { name: "Powai Villa", location: "Powai", propertyType: "Villa", basePrice: 475000, amenities: ["Lake View", "Private Garden", "Pool", "Security", "Parking"], bedrooms: 4, bathrooms: 4, sqft: 3500, description: "Exclusive villa with private garden and lake views." },

      // Thane (5)
      { name: "Thane West Studio", location: "Thane West", propertyType: "Studio", basePrice: 50000, amenities: ["Security", "Parking"], bedrooms: 0, bathrooms: 1, sqft: 350, description: "Affordable studio in Thane West." },
      { name: "Ghodbunder Road 1BHK", location: "Thane West", propertyType: "1BHK", basePrice: 68000, amenities: ["Gym", "Security", "Parking"], bedrooms: 1, bathrooms: 1, sqft: 520, description: "Value 1BHK on Ghodbunder Road." },
      { name: "Thane 2BHK", location: "Thane West", propertyType: "2BHK", basePrice: 95000, amenities: ["Gym", "Pool", "Security", "Parking", "Garden"], bedrooms: 2, bathrooms: 2, sqft: 780, description: "Family-friendly 2BHK with garden." },
      { name: "Majiwada 3BHK", location: "Thane", propertyType: "3BHK", basePrice: 135000, amenities: ["Gym", "Pool", "Security", "Parking", "Clubhouse"], bedrooms: 3, bathrooms: 2, sqft: 1050, description: "Spacious 3BHK in well-connected Majiwada." },
      { name: "Thane Creek Villa", location: "Thane", propertyType: "Villa", basePrice: 385000, amenities: ["Creek View", "Garden", "Security", "Parking"], bedrooms: 4, bathrooms: 3, sqft: 2800, description: "Peaceful villa with creek views." },

      // Navi Mumbai (5)
      { name: "Vashi Studio", location: "Vashi", propertyType: "Studio", basePrice: 52000, amenities: ["Security", "Parking"], bedrooms: 0, bathrooms: 1, sqft: 370, description: "Compact studio in Vashi node." },
      { name: "Nerul 1BHK", location: "Nerul", propertyType: "1BHK", basePrice: 70000, amenities: ["Gym", "Security", "Parking", "Garden"], bedrooms: 1, bathrooms: 1, sqft: 540, description: "Green 1BHK in planned Nerul sector." },
      { name: "Kharghar 2BHK", location: "Kharghar", propertyType: "2BHK", basePrice: 92000, amenities: ["Gym", "Pool", "Security", "Parking"], bedrooms: 2, bathrooms: 2, sqft: 800, description: "Affordable 2BHK with hill views." },
      { name: "Seawoods 3BHK", location: "Seawoods", propertyType: "3BHK", basePrice: 142000, amenities: ["Gym", "Pool", "Security", "Parking", "Clubhouse"], bedrooms: 3, bathrooms: 2, sqft: 1100, description: "Modern 3BHK near Seawoods station." },
      { name: "Palm Beach Villa", location: "Nerul", propertyType: "Villa", basePrice: 425000, amenities: ["Sea View", "Garden", "Pool", "Security", "Parking"], bedrooms: 4, bathrooms: 4, sqft: 3200, description: "Beachside villa in Navi Mumbai." },

      // South Mumbai (5)
      { name: "Colaba Studio", location: "Colaba", propertyType: "Studio", basePrice: 105000, amenities: ["Heritage Building", "Security"], bedrooms: 0, bathrooms: 1, sqft: 400, description: "Charming studio in heritage Colaba building." },
      { name: "Cuffe Parade 2BHK", location: "Cuffe Parade", propertyType: "2BHK", basePrice: 195000, amenities: ["Sea View", "Gym", "Security", "Parking"], bedrooms: 2, bathrooms: 2, sqft: 1050, description: "Elegant 2BHK with sea views in South Mumbai." },
      { name: "Malabar Hill 3BHK", location: "Malabar Hill", propertyType: "3BHK", basePrice: 325000, amenities: ["Sea View", "Gym", "Pool", "Security", "Parking"], bedrooms: 3, bathrooms: 3, sqft: 1700, description: "Prestigious 3BHK on Malabar Hill." },
      { name: "Breach Candy Penthouse", location: "Breach Candy", propertyType: "Penthouse", basePrice: 850000, amenities: ["Sea View", "Private Terrace", "Pool", "Gym", "Concierge"], bedrooms: 4, bathrooms: 4, sqft: 4000, description: "Iconic penthouse in Mumbai's most exclusive address." },
      { name: "Walkeshwar Villa", location: "Walkeshwar", propertyType: "Villa", basePrice: 950000, amenities: ["Sea View", "Heritage", "Garden", "Pool", "Security"], bedrooms: 6, bathrooms: 6, sqft: 6000, description: "Historic villa with unparalleled sea views and heritage charm." },
    ];

    for (const prop of properties) {
      await ctx.db.insert("properties", {
        ...prop,
        currentPrice: prop.basePrice,
        status: "available" as const,
        priceHistory: [
          { timestamp: Date.now(), price: prop.basePrice, event: "Initial listing" },
        ],
        listedForSale: false,
      });
    }

    return { count: properties.length };
  },
});

// Get recent market events
export const getMarketEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("realEstateEvents")
      .order("desc")
      .take(10);
  },
});

// Simulate random market event
export const simulateMarketEvent = mutation({
  args: {},
  handler: async (ctx) => {
    const eventTypes = ["infrastructure", "crime", "development", "natural"];
    const areas = ["Bandra West", "Andheri West", "Juhu", "Worli", "Lower Parel", "Powai", "Thane", "Navi Mumbai"];
    
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const area = areas[Math.floor(Math.random() * areas.length)];
    const impact = (Math.random() * 20 - 10); // -10% to +10%
    
    await ctx.db.insert("realEstateEvents", {
      eventType,
      affectedArea: area,
      description: `Market event in ${area}`,
      priceImpact: impact,
      duration: 168, // 1 week
      occurredAt: Date.now(),
    });
  },
});

// Apply market events (internal, called by cron)
export const applyMarketEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeEvents = await ctx.db.query("realEstateEvents").collect();
    
    for (const event of activeEvents) {
      const hoursSince = (now - event.occurredAt) / (1000 * 60 * 60);
      if (hoursSince > event.duration) continue;
      
      const properties = await ctx.db
        .query("properties")
        .filter((q) => q.eq(q.field("location"), event.affectedArea))
        .collect();
      
      for (const property of properties) {
        const adjustment = property.currentPrice * (event.priceImpact / 100);
        const newPrice = Math.max(property.basePrice * 0.5, property.currentPrice + adjustment);
        
        await ctx.db.patch(property._id, {
          currentPrice: Math.floor(newPrice),
          priceHistory: [
            ...property.priceHistory,
            { timestamp: now, price: Math.floor(newPrice), event: event.description },
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
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") throw new Error("Admin only");

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    await ctx.db.patch(args.propertyId, {
      currentPrice: args.newPrice,
      priceHistory: [
        ...property.priceHistory,
        { timestamp: Date.now(), price: args.newPrice, event: "Admin price adjustment" },
      ],
    });

    await ctx.db.insert("realEstateEvents", {
      eventType: "admin",
      affectedArea: property.location,
      description: `Admin adjusted price for ${property.name}`,
      priceImpact: ((args.newPrice - property.currentPrice) / property.currentPrice) * 100,
      duration: 0,
      occurredAt: Date.now(),
    });

    return { success: true };
  },
});

// Admin: Trigger custom market event
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
    if (!user || user.role !== "admin") throw new Error("Admin only");

    await ctx.db.insert("realEstateEvents", {
      eventType: args.eventType,
      affectedArea: args.affectedArea,
      description: args.description,
      priceImpact: args.priceImpact,
      duration: args.duration,
      occurredAt: Date.now(),
    });

    // Apply immediately
    const properties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("location"), args.affectedArea))
      .collect();

    for (const property of properties) {
      const adjustment = property.currentPrice * (args.priceImpact / 100);
      const newPrice = Math.max(property.basePrice * 0.5, property.currentPrice + adjustment);

      await ctx.db.patch(property._id, {
        currentPrice: Math.floor(newPrice),
        priceHistory: [
          ...property.priceHistory,
          { timestamp: Date.now(), price: Math.floor(newPrice), event: args.description },
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
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "admin") throw new Error("Admin only");

    const properties = await ctx.db.query("properties").collect();
    
    const enriched = await Promise.all(
      properties.map(async (p) => {
        const owner = p.ownerId ? await ctx.db.get(p.ownerId) : null;
        return {
          ...p,
          ownerName: owner?.characterName || owner?.name || null,
        };
      })
    );

    return enriched;
  },
});

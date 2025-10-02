import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Make a user an admin (can only be done by existing admin or first user)
export const makeAdmin = mutation({
  args: {
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    
    // Check if there are any admins yet
    const existingAdmins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();

    // If no admins exist, allow the first user to become admin
    // Otherwise, only existing admins can make new admins
    if (existingAdmins.length > 0 && (!currentUser || currentUser.role !== "admin")) {
      throw new Error("Only admins can make other users admin");
    }

    // Find user by email
    const targetUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!targetUser) {
      throw new Error("User not found");
    }

    await ctx.db.patch(targetUser._id, {
      role: "admin",
    });

    return { success: true };
  },
});

// Make a user an admin by their user ID (for users without email)
export const makeAdminById = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    
    // Only existing admins can make new admins
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Only admins can make other users admin");
    }

    // Find user by ID
    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw new Error("User not found");
    }

    await ctx.db.patch(targetUser._id, {
      role: "admin",
    });

    return { success: true, userName: targetUser.characterName || targetUser.name || "Unknown" };
  },
});

// Get all users for admin management
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    
    // Only admins can view all users
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Only admins can view all users");
    }

    const users = await ctx.db.query("users").collect();
    
    return users.map(user => ({
      _id: user._id,
      name: user.name,
      characterName: user.characterName,
      email: user.email,
      role: user.role || "user",
      credits: user.credits || 0,
      level: user.level || 1,
    }));
  },
});
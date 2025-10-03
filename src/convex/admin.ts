import { v } from "convex/values";
import { mutation } from "./_generated/server";
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

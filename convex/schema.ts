import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  conversions: defineTable({
    userId: v.id("users"),
    originalFileId: v.id("_storage"),
    pdfFileId: v.id("_storage"),
    status: v.string(),
    fileName: v.string(),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});

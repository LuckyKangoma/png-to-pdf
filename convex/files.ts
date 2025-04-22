import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { PDFDocument } from "pdf-lib";
import { createCanvas, loadImage } from "canvas";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const startConversion = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversionId = await ctx.db.insert("conversions", {
      userId,
      originalFileId: args.storageId,
      pdfFileId: args.storageId, // Temporary, will be updated
      status: "processing",
      fileName: args.fileName,
    });

    await ctx.scheduler.runAfter(0, api.files.convertToPdf, { conversionId });
    return conversionId;
  },
});

export const convertToPdf = action({
  args: {
    conversionId: v.id("conversions"),
  },
  handler: async (ctx, args) => {
    const conversion = await ctx.runQuery(api.files.getConversion, { 
      conversionId: args.conversionId 
    });
    if (!conversion) throw new Error("Conversion not found");

    // Get the PNG data
    const pngData = await ctx.storage.get(conversion.originalFileId);
    if (!pngData) throw new Error("Original file not found");

    // Convert Blob to Buffer
    const arrayBuffer = await pngData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Load the PNG into canvas
    const image = await loadImage(buffer);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([image.width, image.height]);
    const pngImage = await pdfDoc.embedPng(canvas.toBuffer());
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    const pdfFileId = await ctx.storage.store(pdfBlob);

    // Update conversion record
    await ctx.runMutation(api.files.updateConversion, {
      conversionId: args.conversionId,
      pdfFileId,
      status: "completed",
    });
  },
});

export const updateConversion = mutation({
  args: {
    conversionId: v.id("conversions"),
    pdfFileId: v.id("_storage"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(args.conversionId, {
      pdfFileId: args.pdfFileId,
      status: args.status,
    });
  },
});

export const getConversion = query({
  args: {
    conversionId: v.id("conversions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.get(args.conversionId);
  },
});

export const listConversions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("conversions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getPdfUrl = query({
  args: {
    pdfFileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.storage.getUrl(args.pdfFileId);
  },
});

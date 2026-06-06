import { z } from "zod";

/** Shared request validation for the indexer settings endpoints. */

export const indexerTypeSchema = z.enum(["torznab", "cardigann", "torrentio"]);
export const fetchModeSchema = z.enum(["direct", "flaresolverr"]);

const baseFields = {
  name: z.string().trim().min(1, "Name is required."),
  type: indexerTypeSchema,
  baseUrl: z.string().trim().url("Base URL must be a valid URL."),
  fetchMode: fetchModeSchema,
  categories: z.array(z.string().trim().min(1)).default([]),
};

export const createIndexerSchema = z.object({
  ...baseFields,
  // Tri-state on write: omitted keeps nothing (new), empty clears, value sets.
  apiKey: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  enabled: z.boolean().default(true),
});

export const updateIndexerSchema = z
  .object({
    name: baseFields.name.optional(),
    type: indexerTypeSchema.optional(),
    baseUrl: baseFields.baseUrl.optional(),
    fetchMode: fetchModeSchema.optional(),
    categories: z.array(z.string().trim().min(1)).optional(),
    apiKey: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    password: z.string().nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided.",
  });

export const testIndexerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).default("Indexer"),
  type: indexerTypeSchema,
  baseUrl: baseFields.baseUrl,
  fetchMode: fetchModeSchema,
  categories: z.array(z.string().trim().min(1)).default([]),
  apiKey: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
});

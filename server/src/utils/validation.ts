import { z } from 'zod';

export const IdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform(Number),
});

export const PaginationParamsSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => Math.max(1, parseInt(v, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 10))),
});

export const OptionalIdSchema = z
  .string()
  .optional()
  .transform((v) => (v ? parseInt(v, 10) : undefined))
  .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), {
    message: 'ID must be a positive integer',
  });

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type IdParam = z.infer<typeof IdParamSchema>;
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

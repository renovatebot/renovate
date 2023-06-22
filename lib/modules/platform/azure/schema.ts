import type { WrappedException } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import { z } from 'zod';

export const WrappedExceptionSchema: z.ZodSchema<WrappedException> = z.lazy(
  () =>
    z.object({
      customProperties: z.record(z.any()).optional(),
      errorCode: z.number().optional(),
      eventId: z.number().optional(),
      helpLink: z.string().optional(),
      innerException: WrappedExceptionSchema.optional(),
      message: z.string().optional(),
      stackTrace: z.string().optional(),
      typeKey: z.string().optional(),
      typeName: z.string().optional(),
    })
);

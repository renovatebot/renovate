import type { WrappedException } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

const WrappedException: z.ZodSchema<WrappedException> = z.lazy(() =>
  z.object({
    customProperties: z.record(z.any()).optional(),
    errorCode: z.number().optional(),
    eventId: z.number().optional(),
    helpLink: z.string().optional(),
    innerException: WrappedException.optional(),
    message: z.string().optional(),
    stackTrace: z.string().optional(),
    typeKey: z.string().optional(),
    typeName: z.string().optional(),
  }),
);

export const WrappedExceptionSchema = Json.pipe(WrappedException);

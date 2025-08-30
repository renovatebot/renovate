import type { WrappedException as _WrappedException } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

const _WrappedException: z.ZodSchema<_WrappedException> = z.lazy(() =>
  z.object({
    customProperties: z.record(z.any()).optional(),
    errorCode: z.number().optional(),
    eventId: z.number().optional(),
    helpLink: z.string().optional(),
    innerException: _WrappedException.optional(),
    message: z.string().optional(),
    stackTrace: z.string().optional(),
    typeKey: z.string().optional(),
    typeName: z.string().optional(),
  }),
);

export const WrappedException = Json.pipe(_WrappedException);

export const ItemResponse = z.object({
  objectId: z.string(),
  path: z.string(),
});

export const AzureTreeNode = z.object({
  objectId: z.string(),
  relativePath: z.string(),
  gitObjectType: z.union([z.literal('tree'), z.literal('blob')]),
});

export type AzureTreeNode = z.infer<typeof AzureTreeNode>;

export const AzureTree = z.object({
  objectId: z.string(),
  treeEntries: z.array(AzureTreeNode),
});

export const AzureTag = z.object({
  name: z.string(),
  value: z.string(),
});

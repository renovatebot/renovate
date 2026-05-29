import { z } from 'zod/v3';

/**
 * @see https://gerrit.wikimedia.org/r/Documentation/rest-api-config.html#download-scheme-info
 */
const GerritDownloadSchemeInfo = z.object({
  url: z.string(),
  description: z.string().optional(),
  is_auth_required: z.boolean().optional(),
  is_auth_supported: z.boolean().optional(),
  commands: z.record(z.string(), z.string()).optional(),
  clone_commands: z.record(z.string(), z.string()).optional(),
});

/**
 * @see https://gerrit.wikimedia.org/r/Documentation/rest-api-config.html#download-info
 */
const GerritDownloadInfo = z.object({
  schemes: z.record(z.string(), GerritDownloadSchemeInfo),
  archives: z.array(z.string()),
});

/**
 * @see https://gerrit.wikimedia.org/r/Documentation/rest-api-config.html#server-info
 */
export const GerritServerInfo = z.object({
  download: GerritDownloadInfo,
});
export type GerritServerInfo = z.infer<typeof GerritServerInfo>;

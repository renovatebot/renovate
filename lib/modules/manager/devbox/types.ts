import type { VersioningApi } from '../../versioning/types.ts';

export type ToolVersioning = Partial<
  Record<string, { api: VersioningApi; id: string }>
>;

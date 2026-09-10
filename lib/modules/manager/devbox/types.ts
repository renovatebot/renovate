import type { VersioningApi } from '../../versioning/types.ts';

export type ToolVersioning = Record<string, { api: VersioningApi; id: string }>;

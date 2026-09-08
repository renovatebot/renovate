import type { UpdateArtifactsConfig } from '../types.ts';
import { resolveToolConstraint } from '../util.ts';

export async function getPythonVersionConstraint(
  config: UpdateArtifactsConfig,
): Promise<string | undefined> {
  return await resolveToolConstraint(config, 'python');
}

export async function getCopierVersionConstraint(
  config: UpdateArtifactsConfig,
): Promise<string> {
  return (await resolveToolConstraint(config, 'copier')) ?? '';
}

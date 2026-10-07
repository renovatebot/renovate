import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const GitlabPackage = z.object({
  version: z.string(),
  created_at: z.string(),
  name: z.string(),
  conan_package_name: z.string().optional(),
});
export type GitlabPackage = z.infer<typeof GitlabPackage>;

export const GitlabPackages = LooseArray(GitlabPackage);

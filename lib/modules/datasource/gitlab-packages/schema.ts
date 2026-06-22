import { z } from 'zod/v4';

export const GitlabPackage = z.object({
  version: z.string(),
  created_at: z.string(),
  name: z.string(),
  conan_package_name: z.string().optional(),
});
export type GitlabPackage = z.infer<typeof GitlabPackage>;

export const GitlabPackages = z.array(GitlabPackage);

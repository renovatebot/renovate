import { z } from 'zod/v4';

export const GitlabPackageSchema = z.object({
  version: z.string(),
  created_at: z.string(),
  name: z.string(),
  conan_package_name: z.string().optional(),
});
export type GitlabPackage = z.infer<typeof GitlabPackageSchema>;

export const GitlabPackagesSchema = z.array(GitlabPackageSchema);

export const defaultRegistryUrl = 'https://www.nixhub.io';

export function resolveRegistryUrl(_packageName: string): string {
  const registryUrl = defaultRegistryUrl;
  // for (const rule of packageRules) {
  //   const { matchPackagePrefixes, registryUrls } = rule;
  //   if (
  //     !matchPackagePrefixes ||
  //     packageName.startsWith(matchPackagePrefixes[0])
  //   ) {
  //     // TODO: fix types #22198
  //     registryUrl = registryUrls![0];
  //   }
  // }
  return registryUrl;
}

import type { PackageDependency } from '../../types';
import type { HomebrewManagerData, UrlParsedResult } from '../types';

export abstract class HomebrewUrlHandler {
  abstract readonly type: string;

  // Parse URL and return structured result
  abstract parseUrl(url: string): UrlParsedResult | null;

  // Create dependency object from parsed URL
  abstract createDependency(
    parsed: UrlParsedResult,
    sha256: string | null,
    url: string,
  ): PackageDependency<HomebrewManagerData>;

  // Build new URLs for version update
  abstract buildArchiveUrls(
    managerData: HomebrewManagerData,
    newVersion: string,
  ): string[] | null;
}

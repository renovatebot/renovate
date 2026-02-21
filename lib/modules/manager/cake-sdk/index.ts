import type { Category } from '../../../constants/index.ts';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { isHttpUrl } from '../../../util/url.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

export const url = 'https://cakebuild.net/docs/writing-builds/sdk/tools';
export const categories: Category[] = ['dotnet'];

export const defaultConfig = {
  managerFilePatterns: ['/(?:cake|build)\\.cs$/'],
};

export const supportedDatasources = [NugetDatasource.id];

/**
 * Parses a tool/dependency spec string (nuget:... or dotnet:...) into a PackageDependency.
 * Same URL format as Cake.Tool preprocessor directives.
 */
function parseToolSpec(spec: string): PackageDependency | null {
  try {
    let url = spec.replace(regEx(/^[^:]*:/), '');
    const isEmptyHost = url.startsWith('?');
    url = isEmptyHost ? `http://localhost/${url}` : url;

    const parsedUrl = new URL(url);
    const { origin, pathname, searchParams } = parsedUrl;

    const registryUrl = `${origin}${pathname}`;

    const depName = searchParams.get('package')!;
    const currentValue = searchParams.get('version') ?? undefined;

    const result: PackageDependency = {
      datasource: NugetDatasource.id,
      depName,
      currentValue,
    };

    if (!isEmptyHost) {
      if (isHttpUrl(parsedUrl)) {
        result.registryUrls = [registryUrl];
      } else {
        result.skipReason = 'unsupported-url';
      }
    }

    return result;
  } catch (err) {
    logger.debug({ err, spec }, 'Failed to parse Cake tool spec');
    return null;
  }
}

/**
 * Extracts NuGet dependencies from Cake.Sdk build scripts (.cs files).
 * Supports:
 * - #:sdk Cake.Sdk@version
 * - #:package PackageName@version
 * - InstallTool("nuget:...") / InstallTool("dotnet:...")
 * - InstallTools("...", "...", ...)
 */
export function extractPackageFile(content: string): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  // #:sdk Cake.Sdk@6.0.0
  const sdkMatch = content.match(regEx(/^#:sdk\s+Cake\.Sdk@([^\s\r\n]+)/, 'm'));
  if (sdkMatch) {
    deps.push({
      datasource: NugetDatasource.id,
      depName: 'Cake.Sdk',
      currentValue: sdkMatch[1].trim(),
    });
  }

  // #:package PackageName@version (e.g. #:package Cake.Sonar@5.0.0)
  const packageRegex = regEx(/#:package\s+([^\s@]+)@([^\s\r\n]+)/g);
  for (const packageMatch of content.matchAll(packageRegex)) {
    deps.push({
      datasource: NugetDatasource.id,
      depName: packageMatch[1].trim(),
      currentValue: packageMatch[2].trim(),
    });
  }

  // InstallTool("...") and InstallTools("...", "...") - match "(nuget|dotnet):..."
  const toolSpecRegex = regEx(/"((?:nuget|dotnet):[^"]+)"/g);
  for (const toolMatch of content.matchAll(toolSpecRegex)) {
    const dep = parseToolSpec(toolMatch[1]);
    if (dep) {
      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}

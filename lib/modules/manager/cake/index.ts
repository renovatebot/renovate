import moo from 'moo';
import type { Category } from '../../../constants/index.ts';
import { regEx } from '../../../util/regex.ts';
import { isHttpUrl } from '../../../util/url.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import type { NugetPackageDependency, Registry } from '../nuget/types.ts';
import { applyRegistries, getConfiguredRegistries } from '../nuget/util.ts';
import type { ExtractConfig, PackageFileContent } from '../types.ts';

export const url = 'https://cakebuild.net/docs';
export const categories: Category[] = ['dotnet'];

export const defaultConfig = {
  managerFilePatterns: ['/\\.cake$/'],
};

export const supportedDatasources = [NugetDatasource.id];

const lexer = moo.states({
  main: {
    lineComment: { match: /\/\/.*?$/ }, // TODO #12870
    multiLineComment: { match: /\/\*[^]*?\*\//, lineBreaks: true }, // TODO #12870
    dependency: {
      match: /^#(?:addin|tool|module|load|l)\s+(?:nuget|dotnet):.*$/, // TODO #12870
    },
    dependencyQuoted: {
      match: /^#(?:addin|tool|module|load|l)\s+"(?:nuget|dotnet):[^"]+"\s*$/, // TODO #12870
      value: (s: string) => s.trim().slice(1, -1),
    },
    dependencyFromInstallTools: {
      match: /(?:InstallTools?\s*\()[^)]+(?:\s*\)\s*;)/,
      lineBreaks: true,
    },
    unknown: moo.fallback,
  },
});

function parseDependencyLine(line: string): NugetPackageDependency | null {
  try {
    let url = line.replace(regEx(/^[^:]*:/), '');
    const isEmptyHost = url.startsWith('?');
    url = isEmptyHost ? `http://localhost/${url}` : url;

    const parsedUrl = new URL(url);
    const { origin, pathname, searchParams } = parsedUrl;

    const registryUrl = `${origin}${pathname}`;

    const depName = searchParams.get('package')!;
    const currentValue = searchParams.get('version') ?? undefined;

    const result: NugetPackageDependency = {
      datasource: NugetDatasource.id,
      depName,
      depType: 'nuget',
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
  } catch {
    return null;
  }
}

function parseAndPushDependencyLine(
  registries: Registry[] | undefined,
  deps: NugetPackageDependency[],
  value: string,
): void {
  const dep = parseDependencyLine(value);
  if (dep) {
    applyRegistries(dep, registries);
    deps.push(dep);
  }
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): Promise<PackageFileContent | null> {
  const deps: NugetPackageDependency[] = [];
  const registries = await getConfiguredRegistries(packageFile);

  lexer.reset(content);
  let token = lexer.next();
  while (token) {
    const { type, value } = token;
    if (type === 'dependency' || type === 'dependencyQuoted') {
      parseAndPushDependencyLine(registries, deps, value);
    } else if (type === 'dependencyFromInstallTools') {
      const matches = value.matchAll(regEx(/"dotnet:[^"]+"/g));
      for (const match of matches) {
        const withoutQuote = match.toString().slice(1, -1);
        parseAndPushDependencyLine(registries, deps, withoutQuote);
      }
    }
    token = lexer.next();
  }
  return { deps };
}

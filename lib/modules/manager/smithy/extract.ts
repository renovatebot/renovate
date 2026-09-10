import { logger } from '../../../logger/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { SmithyBuild } from './schema.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let parsed: SmithyBuild;
  try {
    parsed = SmithyBuild.parse(content);
  } catch (err) {
    logger.debug({ err, packageFile }, 'Error parsing smithy-build.json');
    return null;
  }

  const dependencies = parsed.maven?.dependencies;
  if (!dependencies?.length) {
    return null;
  }

  const deps = dependencies.map(gavToPackageDependency);

  const registryUrls = parsed.maven?.repositories
    ?.map((repository) => repository.url)
    .filter((url) => !url.includes('${'));

  return {
    deps,
    ...(registryUrls?.length ? { registryUrls } : {}),
  };
}

function gavToPackageDependency(gav: string): PackageDependency {
  const parts = gav.split(':');
  const [groupId, artifactId, currentValue] = parts;

  if (
    !groupId ||
    !artifactId ||
    parts.length > 3 ||
    groupId.includes('${') ||
    artifactId.includes('${')
  ) {
    return {
      depName: gav,
      skipReason: gav.includes('${')
        ? 'contains-variable'
        : 'invalid-dependency-specification',
    };
  }

  const depName = `${groupId}:${artifactId}`;

  if (!currentValue) {
    return {
      depName,
      datasource: MavenDatasource.id,
      skipReason: 'unspecified-version',
    };
  }

  if (currentValue.includes('${')) {
    return {
      depName,
      datasource: MavenDatasource.id,
      skipReason: 'contains-variable',
    };
  }

  return {
    depName,
    currentValue,
    datasource: MavenDatasource.id,
  };
}

import type { XmlElement } from 'xmldoc';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';

import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';

const dockerPrefix = regEx(/^docker:\/?\//);

function parsePomXml(content: string, packageFile: string): XmlDocument | null {
  let res: XmlDocument;
  try {
    res = new XmlDocument(content);
  } catch {
    logger.debug({ packageFile }, 'Failed to parse pom.xml');
    return null;
  }
  if (res.name !== 'project') {
    return null;
  }
  return res;
}

function getDeps(
  nodes: XmlElement[],
  config: ExtractConfig,
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  nodes.forEach((node) => {
    const depString = node.val.trim();
    if (isDockerRef(depString)) {
      const dep = getDep(
        depString.replace(dockerPrefix, ''),
        true,
        config.registryAliases,
      );
      if (dep.currentValue || dep.currentDigest) {
        deps.push(dep);
      }
    }
  });
  return deps;
}

function isDockerRef(ref: string): boolean {
  const schemaMatch = regEx(/^([a-z0-9]+):\/?\//).test(ref);
  if (
    ref.startsWith('urn:cnb') || // buildpacks registry or builder urns
    ref.startsWith('from=') || // builder reference
    (schemaMatch && !ref.startsWith('docker:/')) // unsupported schema
  ) {
    return false;
  }
  return true;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  const descriptor = parsePomXml(content, packageFile);
  if (!descriptor) {
    return null;
  }

  const pluginNodes =
    descriptor
      .childNamed('build')
      ?.childNamed('plugins')
      ?.childrenNamed('plugin') ?? [];
  pluginNodes.filter((pluginNode) => {
    return (
      pluginNode.valueWithPath('groupId')?.trim() ===
        'org.springframework.boot' &&
      pluginNode.valueWithPath('artifactId')?.trim() ===
        'spring-boot-maven-plugin'
    );
  });
  if (!pluginNodes.length) {
    return null;
  }
  const imageNode = pluginNodes[0]
    .childNamed('configuration')
    ?.childNamed('image');
  if (!imageNode) {
    return null;
  }

  const builder: PackageDependency[] = getDeps(
    imageNode.childrenNamed('builder'),
    config,
  );
  const runImage: PackageDependency[] = getDeps(
    imageNode.childrenNamed('runImage'),
    config,
  );
  const buildpacks: PackageDependency[] = getDeps(
    imageNode.childNamed('buildpacks')?.childrenNamed('buildpack') ?? [],
    config,
  );

  deps.push(...builder, ...runImage, ...buildpacks);

  if (!deps.length) {
    return null;
  }
  return { deps };
}

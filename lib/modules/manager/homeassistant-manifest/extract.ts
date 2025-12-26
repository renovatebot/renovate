import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { PypiDatasource } from '../../datasource/pypi';
import type { PackageDependency, PackageFileContent } from '../types';

const githubRegex = regEx(
  /^(?<depName>.+)@git\+https:\/\/github\.com\/(?<repo>[^/]+\/[^/]+)\.git@(?<gitRef>.+)$/,
);

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let manifest: {
    domain?: string;
    name?: string;
    requirements?: string[];
  };

  try {
    manifest = JSON.parse(content);
  } catch (err) {
    logger.debug({ packageFile, err }, 'Failed to parse manifest.json');
    return null;
  }

  // Validate that this is a Home Assistant manifest by checking for required fields
  // https://developers.home-assistant.io/docs/creating_integration_manifest
  if (!manifest.domain || typeof manifest.domain !== 'string') {
    logger.trace(
      { packageFile },
      'Missing or invalid "domain" field - not a Home Assistant manifest',
    );
    return null;
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    logger.trace(
      { packageFile },
      'Missing or invalid "name" field - not a Home Assistant manifest',
    );
    return null;
  }

  if (!manifest.requirements || !Array.isArray(manifest.requirements)) {
    logger.debug({ packageFile }, 'No requirements found in manifest');
    return null;
  }

  const deps: PackageDependency[] = [];

  for (const requirement of manifest.requirements) {
    if (typeof requirement !== 'string') {
      logger.debug(
        { packageFile, requirement },
        'Invalid requirement in manifest',
      );
      continue;
    }

    // Check for git+https:// requirements
    const githubMatch = githubRegex.exec(requirement);
    if (githubMatch?.groups) {
      const { depName, gitRef } = githubMatch.groups;
      deps.push({
        depName,
        datasource: PypiDatasource.id,
        packageName: depName,
        currentValue: gitRef,
        skipReason: 'unsupported-datasource',
      });
      logger.debug(
        { packageFile, requirement },
        'GitHub git reference not supported yet',
      );
      continue;
    }

    // Parse standard pip requirement format: package[extras]==version or package==version
    const depParts = requirement.split(/==|>=|<=|>|<|!=|~=/);
    if (depParts.length < 2) {
      logger.debug(
        { packageFile, requirement },
        'Unable to parse requirement version',
      );
      deps.push({
        depName: requirement,
        datasource: PypiDatasource.id,
        skipReason: 'invalid-dependency-specification',
      });
      continue;
    }

    const depName = depParts[0].split('[')[0].trim(); // Remove extras like [extra1,extra2]
    const currentValue = depParts[1].trim();

    // Determine operator
    let operator = '==';
    const operatorMatch = regEx(/==|>=|<=|>|<|!=|~=/).exec(requirement);
    if (operatorMatch) {
      operator = operatorMatch[0];
    }

    // Only extract dependencies with exact version pins (==)
    // Other operators like >= could be supported but == is most common for HA
    if (operator === '==') {
      deps.push({
        depName,
        datasource: PypiDatasource.id,
        packageName: depName,
        currentValue,
      });
    } else {
      deps.push({
        depName,
        datasource: PypiDatasource.id,
        packageName: depName,
        currentValue,
        skipReason: 'unsupported',
      });
      logger.debug(
        { packageFile, requirement, operator },
        'Unsupported version constraint operator',
      );
    }
  }

  if (deps.length === 0) {
    return null;
  }

  return { deps };
}

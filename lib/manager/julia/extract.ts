import { parse } from 'toml';
import * as datasourceJuliaGeneral from '../../datasource/julia-general';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { PackageDependency, PackageFile } from '../common';

export function extractPackageFile(content: string): PackageFile | null {
  let parsedContent: any;
  try {
    parsedContent = parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing Project.toml file');
    return null;
  }
  const deps = [];

  if (!deps.length) {
    return null;
  }
  return { deps };
}

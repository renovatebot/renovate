import { logger } from '../../logger';
import { PackageDependency, Upgrade } from '../common';
import { extractDep } from './extract';
import * as cdnjs from '../../datasource/cdnjs';
import got from '../../util/got';
import { CdnjsAsset } from '../../datasource/cdnjs';

const integrityRegexp = /\s+integrity\s*=\s*"(?<hash>[^"]+)"/;

function extractHash(tag: string): string | null {
  let result = null;
  const match = integrityRegexp.exec(tag);
  if (match) result = match.groups.hash;
  return result;
}

async function fetchNewHash(
  dep: PackageDependency,
  newValue: string
): Promise<string | null> {
  let result = null;
  const { depName, lookupName } = dep;
  const url = cdnjs.depUrl(depName);
  const assetName = lookupName.replace(`${depName}/`, '');

  let res = null;
  try {
    res = await got(url, { json: true });
  } catch (e) /* istanbul ignore next */ {
    return null;
  }

  const assets: CdnjsAsset[] = res.body && res.body.assets;
  const asset = assets && assets.find(({ version }) => version === newValue);
  const hash = asset && asset.sri && asset.sri[assetName];
  if (hash) result = hash;
  return result;
}

export async function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): Promise<string | null> {
  const { currentValue, newValue, managerData } = upgrade;
  const { tagPosition, tagLength } = managerData;
  const leftPart = fileContent.slice(0, tagPosition);
  const tagPart = fileContent.slice(tagPosition, tagPosition + tagLength);
  const rightPart = fileContent.slice(tagPosition + tagLength);
  const dep = extractDep(tagPart);
  if (dep.currentValue === newValue) {
    return fileContent;
  }
  if (dep.currentValue === currentValue) {
    const currentHash = extractHash(tagPart);
    let tag = tagPart.replace(currentValue, newValue);
    if (currentHash) {
      const newHash = await fetchNewHash(dep, newValue);
      if (!newHash) {
        logger.error(`Could not upgrade SRI hash`);
        return null;
      }
      tag = tag.replace(currentHash, newHash);
    }
    return `${leftPart}${tag}${rightPart}`;
  }
  return null;
}

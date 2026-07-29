import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger/index.ts';
import type { Http } from '../../../util/http/index.ts';
import { regEx } from '../../../util/regex.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { datasource, repomdXmlFileName } from './common.ts';

export interface RpmRepositoryMetadata {
  repomdUrl: string;
  primaryDbUrl?: string;
  primaryGzipUrl?: string;
}

function getRepodataUrl(
  xml: XmlDocument,
  registryUrl: string,
  repomdUrl: string,
  type: 'primary' | 'primary_db',
  optional: boolean,
): string | undefined {
  const data = xml.childWithAttribute('type', type);

  if (!data) {
    return undefined;
  }

  const locationElement = data.childNamed('location');
  if (!locationElement) {
    if (!optional) {
      throw new Error(`No location element found in ${repomdUrl}`);
    }

    logger.debug(
      { datasource, repomdUrl, type },
      'Optional repomd entry does not contain a location element',
    );
    return undefined;
  }

  const href = locationElement.attr.href;
  if (!href) {
    if (!optional) {
      throw new Error(`No href found in ${repomdUrl}`);
    }

    logger.debug(
      { datasource, repomdUrl, type },
      'Optional repomd entry does not contain an href attribute',
    );
    return undefined;
  }

  // replace trailing "repodata/" from registryUrl, if it exists, with a "/"
  // because href includes "repodata/"
  const registryUrlWithoutRepodata = registryUrl.replace(
    regEx(/\/repodata\/?$/),
    '/',
  );

  return joinUrlParts(registryUrlWithoutRepodata, href);
}

export async function fetchRepositoryMetadata(
  http: Http,
  registryUrl: string,
  metadataSource: 'auto' | 'primary' | 'primary_db' = 'auto',
): Promise<RpmRepositoryMetadata> {
  const repomdUrl = joinUrlParts(registryUrl, repomdXmlFileName);
  const response = await http.getText(repomdUrl.toString());
  const repomdBody = response.body.trimStart();

  // repomd.xml may omit the XML declaration and start directly with the root element
  if (!(repomdBody.startsWith('<?xml') || repomdBody.startsWith('<repomd'))) {
    logger.debug({ datasource, url: repomdUrl }, 'Invalid response format');
    throw new Error(
      `${repomdUrl} is not in XML format. Response body: ${response.body}`,
    );
  }

  const xml = new XmlDocument(repomdBody);
  const primaryDbUrl = getRepodataUrl(
    xml,
    registryUrl,
    repomdUrl.toString(),
    'primary_db',
    metadataSource !== 'primary_db',
  );
  const primaryGzipUrl = getRepodataUrl(
    xml,
    registryUrl,
    repomdUrl.toString(),
    'primary',
    metadataSource === 'primary_db' ||
      (metadataSource === 'auto' && primaryDbUrl !== undefined),
  );

  if (!primaryGzipUrl && !primaryDbUrl) {
    logger.debug(
      `No primary data found in ${repomdUrl}, xml contents: ${response.body}`,
    );
    throw new Error(`No primary data found in ${repomdUrl}`);
  }

  return {
    primaryDbUrl,
    primaryGzipUrl,
    repomdUrl: repomdUrl.toString(),
  };
}

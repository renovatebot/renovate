import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger/index.ts';
import type { Http } from '../../../util/http/index.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { datasource, repomdXmlFileName } from './common.ts';

function getPrimaryRepodataUrl(
  xml: XmlDocument,
  registryUrl: string,
  repomdUrl: string,
): string {
  const primaryData = xml.childWithAttribute('type', 'primary');

  if (!primaryData) {
    throw new Error(`No primary data found in ${repomdUrl}`);
  }

  const locationElement = primaryData.childNamed('location');
  if (!locationElement) {
    throw new Error(`No location element found in ${repomdUrl}`);
  }

  const href = locationElement.attr.href;
  if (!href) {
    throw new Error(`No href found in ${repomdUrl}`);
  }

  // replace trailing "repodata/" from registryUrl, if it exists, with a "/"
  // because href includes "repodata/"
  const registryUrlWithoutRepodata = registryUrl.replace(/\/repodata\/?$/, '/');

  return joinUrlParts(registryUrlWithoutRepodata, href);
}

export async function fetchPrimaryGzipUrl(
  http: Http,
  registryUrl: string,
): Promise<string> {
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

  try {
    return getPrimaryRepodataUrl(xml, registryUrl, repomdUrl.toString());
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.startsWith('No primary data found')
    ) {
      logger.debug(
        `No primary data found in ${repomdUrl}, xml contents: ${response.body}`,
      );
    }

    throw err;
  }
}

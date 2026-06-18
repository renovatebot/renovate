import sax from 'sax';
import { logger } from '../../../../logger/index.ts';
import * as fs from '../../../../util/fs/index.ts';
import type { Http } from '../../../../util/http/index.ts';
import type { ReleaseResult } from '../../types.ts';
import {
  buildReleaseResult,
  formatRpmVersion,
  getCachedGunzippedFile,
} from './common.ts';

export class RpmXmlMetadataProvider {
  private readonly http: Http;

  constructor(http: Http) {
    this.http = http;
  }

  async getReleases(
    primaryGzipUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    const primaryXmlFile = await getCachedGunzippedFile(
      this.http,
      primaryGzipUrl,
      'xml',
    );
    const releases = new Set<string>();
    let insidePackage = false;
    let isTargetPackage = false;
    let insideName = false;

    const saxParser = sax.createStream(true, {
      lowercase: true,
      trim: true,
    });

    saxParser.on('opentag', (node: sax.Tag) => {
      if (node.name === 'package' && node.attributes.type === 'rpm') {
        insidePackage = true;
        isTargetPackage = false;
      }
      if (insidePackage && node.name === 'name') {
        insideName = true;
      }
      if (insidePackage && isTargetPackage && node.name === 'version') {
        const version = formatRpmVersion(
          node.attributes.ver,
          node.attributes.rel,
        );
        if (version) {
          releases.add(version);
        }
      }
    });
    saxParser.on('text', (text: string) => {
      if (insidePackage && insideName && text.trim() === packageName) {
        isTargetPackage = true;
      }
    });
    saxParser.on('closetag', (tag: string) => {
      if (tag === 'name' && insidePackage) {
        insideName = false;
      }
      if (tag === 'package') {
        insidePackage = false;
        isTargetPackage = false;
      }
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      saxParser.on('error', (err: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        logger.debug(`SAX parsing error in ${primaryGzipUrl}: ${err.message}`);
        setImmediate(() => saxParser.removeAllListeners());
        reject(err);
      });
      saxParser.on('end', () => {
        settled = true;
        setImmediate(() => saxParser.removeAllListeners());
        resolve();
      });
      fs.createCacheReadStream(primaryXmlFile).pipe(saxParser);
    });

    const result = buildReleaseResult(releases);
    if (!result) {
      logger.trace(
        `No releases found for package ${packageName} in ${primaryGzipUrl}`,
      );
    }

    return result;
  }
}

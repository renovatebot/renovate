import is from '@sindresorhus/is';
import { regEx } from '../../../../util/regex';
import { parseUrl } from '../../../../util/url';
import { NpmDatasource } from '../../../datasource/npm';
import type { PackageDependency } from '../../types';
import { HomebrewUrlHandler } from './base';

// URL parsing result
export interface NpmUrlParsedResult {
  type: 'npm';
  currentValue: string;
  packageName: string;
}

// Manager data with type discriminator
export interface NpmManagerData {
  type: 'npm';
  packageName: string;
  sha256: string | null;
  url: string | null;
}

export class NpmUrlHandler extends HomebrewUrlHandler {
  readonly type = 'npm';

  parseUrl(urlStr: string): NpmUrlParsedResult | null {
    if (!is.nonEmptyString(urlStr)) {
      return null;
    }

    const url = parseUrl(urlStr);
    if (url?.hostname !== 'registry.npmjs.org') {
      return null;
    }

    // Pattern: /<packageName>/-/<filename>-<version>.tgz
    // For scoped: /@scope/name/-/name-version.tgz
    // For unscoped: /name/-/name-version.tgz
    const pattern = regEx(
      /^\/(?<packageName>(?:@[^/]+\/)?[^/]+)\/-\/[^/]+-(?<version>[\d.]+(?:-[a-zA-Z0-9.-]*)?)\.tgz$/,
    );

    const match = pattern.exec(url.pathname);

    const version = match?.groups?.version;
    const packageName = match?.groups?.packageName;
    if (!packageName || !version) {
      return null;
    }

    return {
      type: 'npm',
      currentValue: version,
      packageName,
    };
  }

  createDependency(
    parsed: NpmUrlParsedResult,
    sha256: string | null,
    url: string,
  ): PackageDependency<NpmManagerData> {
    return {
      depName: parsed.packageName,
      currentValue: parsed.currentValue,
      datasource: NpmDatasource.id,
      managerData: {
        type: 'npm',
        packageName: parsed.packageName,
        sha256,
        url,
      },
    };
  }

  buildArchiveUrls(
    managerData: NpmManagerData,
    newVersion: string,
  ): string[] | null {
    const { packageName } = managerData;

    // Extract filename from package name
    // Scoped: @foo/bar -> bar
    // Unscoped: bar -> bar
    const filename = packageName.includes('/')
      ? packageName.split('/')[1]
      : packageName;

    return [
      `https://registry.npmjs.org/${packageName}/-/${filename}-${newVersion}.tgz`,
    ];
  }
}

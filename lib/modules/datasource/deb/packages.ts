import { escapeRegExp, regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import { PackagesCompressionAlgos } from './types';

/**
 * Retrieves the packages file from the release file.
 * @param releaseFileContent
 * @returns
 */
export function retrievePackagesBaseURLFromReleaseFile(
  releaseFileContent: string,
  basePackageUrl: string,
): {
  hash: string;
  packagesFile: string;
} {
  const res = {
    hash: '',
    packagesFile: '',
  };

  const packagesFiles = [
    ...PackagesCompressionAlgos.map((compression) =>
      joinUrlParts(basePackageUrl, `Packages.${compression}`),
    ),
    joinUrlParts(basePackageUrl, 'Packages'), // fallback to Packages file without compression
  ];

  for (const packagesFile of packagesFiles) {
    // 64 --> SHA256
    const regex = regEx(
      `([a-f0-9]{64})\\s+\\d+\\s+(${escapeRegExp(packagesFile)})\r?\n`,
    );

    const match = regex.exec(releaseFileContent);
    if (match) {
      res.hash = match[1];
      res.packagesFile = packagesFile;
      return res;
    }
  }

  return res;
}

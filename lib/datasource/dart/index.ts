import got from '../../util/got';
import { logger } from '../../logger';
import { DatasourceError, ReleaseResult, GetReleasesConfig } from '../common';

export const id = 'dart';

export async function getPkgReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  let result: ReleaseResult = null;
  const pkgUrl = `https://pub.dartlang.org/api/packages/${lookupName}`;
  interface DartResult {
    versions?: {
      version: string;
    }[];
    latest?: {
      pubspec?: { homepage?: string; repository?: string };
    };
  }

  let raw: {
    body: DartResult;
  } = null;
  try {
    raw = await got(pkgUrl, {
      hostType: id,
      json: true,
    });
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.debug({ lookupName }, `Dependency lookup failure: not found`);
      logger.debug({ err }, 'Dart lookup error');
      return null;
    }
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new DatasourceError(err);
    }
    logger.warn(
      { err, lookupName },
      'pub.dartlang.org lookup failure: Unknown error'
    );
    return null;
  }

  const body = raw && raw.body;
  if (body) {
    const { versions, latest } = body;
    if (versions && latest) {
      result = {
        releases: body.versions.map(({ version }) => ({ version })),
      };

      const pubspec = latest.pubspec;
      if (pubspec) {
        if (pubspec.homepage) {
          result.homepage = pubspec.homepage;
        }

        if (pubspec.repository) {
          result.sourceUrl = pubspec.repository;
        }
      }
    }
  }

  return result;
}

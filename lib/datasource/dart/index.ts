import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http, HttpResponse } from '../../util/http';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'dart';
export const defaultRegistryUrls = ['https://pub.dartlang.org/'];
export const customRegistrySupport = false;

const http = new Http(id);

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  let result: ReleaseResult = null;
  const pkgUrl = `${registryUrl}api/packages/${lookupName}`;
  interface DartResult {
    versions?: {
      version: string;
      published?: string;
    }[];
    latest?: {
      pubspec?: { homepage?: string; repository?: string };
    };
  }

  let raw: HttpResponse<DartResult> = null;
  try {
    raw = await http.getJson<DartResult>(pkgUrl);
  } catch (err) {
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new ExternalHostError(err);
    }
    throw err;
  }

  const body = raw?.body;
  if (body) {
    const { versions, latest } = body;
    if (versions && latest) {
      result = {
        releases: body.versions.map(({ version, published }) => ({
          version,
          releaseTimestamp: published,
        })),
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

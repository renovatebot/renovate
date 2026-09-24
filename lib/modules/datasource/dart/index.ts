import { isEmptyObject, isNonEmptyString } from '@sindresorhus/is';
import type { ConstraintName } from '../../../util/exec/types.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { id as npmId } from '../../versioning/npm/index.ts';
import { Datasource } from '../datasource.ts';
import type {
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import { DartResult } from './schema.ts';

export class DartDatasource extends Datasource {
  static readonly id = 'dart';

  constructor() {
    super(DartDatasource.id);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return ['https://pub.dartlang.org/'];
  }

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `repository` field of the latest release object in the results.';
  override readonly defaultVersioning = npmId;

  async getReleases({
    packageName,
    registryUrl,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const pkgUrl = `${ensureTrailingSlash(
      registryUrl,
    )}api/packages/${packageName}`;

    const { versions, latest } = await this.fetchJson(pkgUrl, DartResult);
    const releases = versions
      ?.filter(({ retracted }) => !retracted)
      ?.map(({ version, published, pubspec }) => {
        const release: Release = {
          version,
          releaseTimestamp: asTimestamp(published),
        };

        const constraints: Partial<Record<ConstraintName, string[]>> = {};
        if (isNonEmptyString(pubspec?.environment?.sdk)) {
          constraints.dart = [pubspec.environment.sdk];
        }
        if (isNonEmptyString(pubspec?.environment?.flutter)) {
          constraints.flutter = [pubspec.environment.flutter];
        }
        if (!isEmptyObject(constraints)) {
          release.constraints = constraints;
        }

        return release;
      });

    if (!releases || !latest) {
      return null;
    }

    const result: ReleaseResult = { releases };

    const pubspec = latest.pubspec;
    if (pubspec) {
      if (pubspec.homepage) {
        result.homepage = pubspec.homepage;
      }

      if (pubspec.repository) {
        result.sourceUrl = pubspec.repository;
      }
    }

    return result;
  }
}

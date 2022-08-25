import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { isVersion, id as semverVersioningId } from '../../versioning/semver';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

const lineTerminationRegex = regEx(`\r?\n`);
const releaseBeginningChar = '\t{';
const releaseTerminationChar = '\t},';
const releaseDateRegex = regEx(
  `Date\\{(?<year>\\d+),\\s+(?<month>\\d+),\\s+(?<day>\\d+)\\}`
);
const releaseVersionRegex = regEx(
  `Version\\{(?<versionMajor>\\d+),\\s+(?<versionMinor>\\d+),\\s+(?<patch>\\d+)\\}`
);
const releaseFutureRegex = regEx(`Future:\\s+true`);

export class GolangVersionDatasource extends Datasource {
  static readonly id = 'golang-version';

  constructor() {
    super(GolangVersionDatasource.id);
  }

  override readonly defaultRegistryUrls = [
    'https://raw.githubusercontent.com/golang/website/',
  ];

  override readonly customRegistrySupport = false;

  override readonly defaultVersioning = semverVersioningId;

  @cache({ namespace: `datasource-${GolangVersionDatasource.id}`, key: 'all' })
  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const res: ReleaseResult = {
      homepage: 'https://go.dev/',
      sourceUrl: 'https://github.com/golang/go',
      releases: [],
    };
    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const golangVersionsUrl = `${registryUrl}HEAD/internal/history/release.go`;

    const response = await this.http.get(golangVersionsUrl);

    const lines = response.body.split(lineTerminationRegex);

    const startOfReleases = lines.indexOf('var Releases = []*Release{');
    if (startOfReleases === -1) {
      throw new ExternalHostError(
        new Error('Invalid file - could not find the Releases section')
      );
    }

    // Remove part before releases
    lines.splice(0, startOfReleases + 1);

    // Parse the release list
    let release: Omit<Release, 'version'> & { version?: string } = {
      version: undefined,
    };
    let skipFutureRelease = false;
    while (lines.length !== 0) {
      const line = lines.shift()!;
      if (line === releaseBeginningChar) {
        if (release.version !== undefined) {
          throw new ExternalHostError(
            new Error('Invalid file - unexpected error while parsing a release')
          );
        }
      } else if (line === releaseTerminationChar) {
        if (skipFutureRelease) {
          skipFutureRelease = false;
        } else {
          if (release.version === undefined) {
            throw new ExternalHostError(
              new Error('Invalid file - release has empty version')
            );
          }
          res.releases.push(release as Release);
        }
        release = { version: undefined };
      } else {
        const isFutureRelease = releaseFutureRegex.test(line);
        if (isFutureRelease) {
          skipFutureRelease = true;
        }
        const releaseDateMatch = releaseDateRegex.exec(line);
        if (releaseDateMatch?.groups) {
          // Make a valid UTC timestamp
          const year = releaseDateMatch.groups.year.padStart(4, '0');
          const month = releaseDateMatch.groups.month.padStart(2, '0');
          const day = releaseDateMatch.groups.day.padStart(2, '0');
          release.releaseTimestamp = `${year}-${month}-${day}T00:00:00.000Z`;
        }
        const releaseVersionMatch = releaseVersionRegex.exec(line);
        if (releaseVersionMatch?.groups) {
          release.version = `${releaseVersionMatch.groups.versionMajor}.${releaseVersionMatch.groups.versionMinor}.${releaseVersionMatch.groups.patch}`;
          if (!isVersion(release.version)) {
            throw new ExternalHostError(
              new Error(`Version ${release.version} is not a valid semver`)
            );
          }
        }
      }
    }

    if (res.releases.length === 0) {
      throw new ExternalHostError(
        new Error(`Invalid file - zero releases extracted`)
      );
    }

    return res;
  }
}

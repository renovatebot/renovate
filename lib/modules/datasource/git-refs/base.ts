import { isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { createSimpleGit } from '../../../util/git/index.ts';
import { getRemoteUrlWithToken } from '../../../util/git/url.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import type { RawRefs } from './types.ts';

const refMatch = regEx(/(?<hash>.*?)\s+refs\/(?<type>.*?)\/(?<value>.*)/);
const headMatch = regEx(/(?<hash>.*?)\s+HEAD/);

const gitId = 'git';

// TODO: extract to a separate directory structure (#10532)
export abstract class GitDatasource extends Datasource {
  static id = gitId;

  /**
   * The `refs/<type>/` kinds this datasource exposes as releases, and the only
   * ones a `newValue` is matched against by {@link GitDatasource.getDigest}.
   */
  protected abstract readonly refTypes: readonly string[];

  constructor(id: string) {
    super(id);
  }

  private async _getRawRefs({
    packageName,
  }: GetReleasesConfig): Promise<RawRefs[] | null> {
    const git = createSimpleGit({
      authentication: { hostTypes: [this.id] },
    });

    // fetch remote tags
    const lsRemote = await git.listRemote([
      getRemoteUrlWithToken(packageName, this.id),
    ]);
    if (!lsRemote) {
      return null;
    }

    const allRefs = lsRemote
      .trim()
      .split(newlineRegex)
      .map((line) => line.trim())
      .map((line) => {
        let match = refMatch.exec(line);
        if (match?.groups) {
          return {
            type: match.groups.type,
            value: match.groups.value,
            hash: match.groups.hash,
          };
        }
        match = headMatch.exec(line);
        if (match?.groups) {
          return {
            type: '',
            value: 'HEAD',
            hash: match.groups.hash,
          };
        }
        logger.trace(`malformed ref: ${line}`);
        return null;
      })
      .filter(isTruthy)
      .filter((ref) => ref.type !== 'pull');

    // For annotated tags, git ls-remote returns two entries:
    // 1. The tag object hash: refs/tags/v1.0.0
    // 2. The dereferenced commit hash: refs/tags/v1.0.0^{}
    // We need to use the dereferenced commit hash (^{}) for annotated tags
    // to match what `git submodule status` returns (the actual commit hash).
    // This prevents false-positive updates that result in empty commits.
    const dereferencedTags: Record<string, string> = {};
    for (const ref of allRefs) {
      if (ref.value.endsWith('^{}')) {
        // Store the commit hash for the base tag name (without ^{})
        dereferencedTags[ref.value.slice(0, -3)] = ref.hash;
      }
    }

    const refs = allRefs
      .filter((ref) => !ref.value.endsWith('^{}'))
      .map((ref) => {
        // For annotated tags, use the dereferenced commit hash
        const dereferencedHash = dereferencedTags[ref.value];
        if (dereferencedHash) {
          return { ...ref, hash: dereferencedHash };
        }
        return ref;
      });

    return refs;
  }

  getRawRefs(config: GetReleasesConfig): Promise<RawRefs[] | null> {
    return this.cached(
      {
        namespace: `datasource-${gitId}`,
        key: config.packageName,
      },
      () => this._getRawRefs(config),
    );
  }

  /**
   * The repository URL, without the `.git` suffix and the trailing slash that
   * a `packageName` may carry.
   */
  protected getSourceUrl(packageName: string): string {
    return packageName.replace(regEx(/\.git$/), '').replace(regEx(/\/$/), '');
  }

  /**
   * One release per distinct ref value of the datasource's
   * {@link GitDatasource.refTypes}, in the order `git ls-remote` returned
   * them. A value carried by several ref types, such as a branch and a tag of
   * the same name, keeps the hash of the first ref that has it.
   */
  protected async getRefReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const rawRefs = await this.getRawRefs({ packageName });
    if (!rawRefs) {
      return null;
    }

    const releases = new Map<string, Release>();
    for (const ref of rawRefs) {
      if (!this.refTypes.includes(ref.type) || releases.has(ref.value)) {
        continue;
      }

      releases.set(ref.value, {
        version: ref.value,
        gitRef: ref.value,
        newDigest: ref.hash,
      });
    }

    return {
      sourceUrl: this.getSourceUrl(packageName),
      releases: [...releases.values()],
    };
  }

  override async getDigest(
    { packageName }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const rawRefs = await this.getRawRefs({ packageName });
    if (!rawRefs) {
      return null;
    }

    const ref = newValue
      ? rawRefs.find(
          (rawRef) =>
            this.refTypes.includes(rawRef.type) && rawRef.value === newValue,
        )
      : rawRefs.find((rawRef) => rawRef.type === '' && rawRef.value === 'HEAD');

    return ref?.hash ?? null;
  }
}

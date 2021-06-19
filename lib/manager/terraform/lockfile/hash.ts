import crypto from 'crypto';
import extract from 'extract-zip';
import pMap from 'p-map';
import { join } from 'upath';
import { TerraformProviderDatasource } from '../../../datasource/terraform-provider';
import type {
  TerraformBuild,
  VersionDetailResponse,
} from '../../../datasource/terraform-provider/types';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import * as fs from '../../../util/fs';
import { Http } from '../../../util/http';
import { getCacheDir, repositoryRegex } from './util';

const http = new Http(TerraformProviderDatasource.id);
const hashCacheTTL = 10080; // in seconds == 1 week

export async function hashFiles(files: string[]): Promise<string> {
  const rootHash = crypto.createHash('sha256');

  for (const file of files) {
    // build for every file a line looking like "aaaaaaaaaaaaaaa  file.txt\n"
    const hash = crypto.createHash('sha256');

    // a sha256sum displayed as lowercase hex string to root hash
    const fileBuffer = await fs.readFile(file);
    hash.update(fileBuffer);
    hash.end();
    const data = hash.read();
    rootHash.update(data.toString('hex'));

    // add double space, the filename and a new line char
    rootHash.update('  ');
    const fileName = file.replace(/^.*[\\/]/, '');
    rootHash.update(fileName);
    rootHash.update('\n');
  }

  rootHash.end();
  const rootData = rootHash.read();
  const result: string = rootData.toString('base64');
  return result;
}

export async function hashOfZipContent(
  zipFilePath: string,
  extractPath: string
): Promise<string> {
  await extract(zipFilePath, { dir: extractPath });
  const files = await fs.readdir(extractPath);
  // the h1 hashing algorithms requires that the files are sorted by filename
  const sortedFiles = files.sort((a, b) => a.localeCompare(b));
  const filesWithPath = sortedFiles.map((file) => `${extractPath}/${file}`);

  const result = await hashFiles(filesWithPath);

  // delete extracted files
  await fs.rm(extractPath, { recursive: true });

  return result;
}

async function getReleaseBackendIndex(
  backendLookUpName: string,
  version: string
): Promise<VersionDetailResponse> {
  return (
    await http.getJson<VersionDetailResponse>(
      `${TerraformProviderDatasource.defaultRegistryUrls[1]}/${backendLookUpName}/${version}/index.json`
    )
  ).body;
}

export async function calculateHashes(
  builds: TerraformBuild[]
): Promise<string[]> {
  const cacheDir = await getCacheDir();

  // for each build download ZIP, extract content and generate hash for all containing files
  const hashes = await pMap(
    builds,
    async (build) => {
      const downloadFileName = join(cacheDir, build.filename);
      const extractPath = join(cacheDir, 'extract', build.filename);
      logger.trace(
        `Downloading archive and generating hash for ${build.name}-${build.version}...`
      );
      const readStream = http.stream(build.url);
      const writeStream = fs.createWriteStream(downloadFileName);

      let hash = null;
      try {
        await fs.pipeline(readStream, writeStream);

        hash = await hashOfZipContent(downloadFileName, extractPath);
        logger.trace(
          { hash },
          `Generated hash for ${build.name}-${build.version}`
        );
      } catch (err) {
        /* istanbul ignore next */
        logger.error({ err, build }, 'write stream error');
      } finally {
        // delete zip file
        await fs.unlink(downloadFileName);
      }
      return hash;
    },
    { concurrency: 4 } // allow to look up 4 builds for this version in parallel
  );
  return hashes;
}

export async function createHashes(
  repository: string,
  version: string
): Promise<string[]> {
  // check cache for hashes
  const repositoryRegexResult = repositoryRegex.exec(repository);
  if (!repositoryRegexResult) {
    // non hashicorp builds are not supported at the moment
    return null;
  }
  const lookupName = repositoryRegexResult.groups.lookupName;
  const backendLookUpName = `terraform-provider-${lookupName}`;

  const cacheKey = `${TerraformProviderDatasource.defaultRegistryUrls[1]}/${repository}/${lookupName}-${version}`;
  const cachedRelease = await packageCache.get<string[]>(
    'terraform-provider-release',
    cacheKey
  );
  // istanbul ignore if
  if (cachedRelease) {
    return cachedRelease;
  }
  let versionReleaseBackend: VersionDetailResponse;
  try {
    versionReleaseBackend = await getReleaseBackendIndex(
      backendLookUpName,
      version
    );
  } catch (err) {
    logger.debug(
      { err, backendLookUpName, version },
      `Failed to retrieve builds for ${backendLookUpName} ${version}`
    );
    return null;
  }

  const builds = versionReleaseBackend.builds;
  const hashes = await calculateHashes(builds);

  // if a hash could not be produced skip caching and return null
  if (hashes.some((value) => value == null)) {
    return null;
  }

  // sorting the hash alphabetically as terraform does this as well
  const sortedHashes = hashes.sort().map((hash) => `h1:${hash}`);
  // save to cache
  await packageCache.set(
    'terraform-provider-release',
    cacheKey,
    sortedHashes,
    hashCacheTTL
  );
  return sortedHashes;
}

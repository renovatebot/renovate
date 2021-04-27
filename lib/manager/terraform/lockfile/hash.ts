import crypto from 'crypto';
import extract from 'extract-zip';
import pMap from 'p-map';
import {
  defaultRegistryUrls,
  id,
} from '../../../datasource/terraform-provider';
import type {
  TerraformBuild,
  VersionDetailResponse,
} from '../../../datasource/terraform-provider/types';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import * as fs from '../../../util/fs';
import { Http } from '../../../util/http';

const http = new Http(id);
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
  const files = await fs.readLocalDirectory(extractPath);
  // the h1 hashing algorithms requires that the files are sorted by filename
  const sortedFiles = files.sort((a, b) => a.localeCompare(b));
  const filesWithPath = sortedFiles.map((file) => `${extractPath}/${file}`);

  const result = hashFiles(filesWithPath);

  // delete extracted files
  for (const value of filesWithPath) {
    await fs.deleteLocalFile(value);
  }
  return result;
}

async function getReleaseBackendIndex(
  backendLookUpName: string,
  version: string
): Promise<VersionDetailResponse> {
  return (
    await http.getJson<VersionDetailResponse>(
      `${defaultRegistryUrls[1]}/${backendLookUpName}/${version}/index.json`
    )
  ).body;
}

export async function calculateHashes(
  builds: TerraformBuild[],
  cacheDir: string
): Promise<string[]> {
  // for each build download ZIP, extract content and generate hash for all containing files
  const hashes = await pMap(
    builds,
    async (build) => {
      const downloadFileName = `${cacheDir}/${build.filename}`;
      const extractPath = `${cacheDir}/extract/${build.filename}`;
      logger.trace(
        `Downloading archive and generating hash for ${build.name}-${build.version}...`
      );
      const readStream = http.stream(build.url);
      const writeStream = fs.createWriteStream(downloadFileName);
      readStream.pipe(writeStream);

      const pipeline = fs.getStreamingPipeline();
      try {
        await pipeline(readStream, writeStream);
      } catch (err) {
        /* istanbul ignore next */
        logger.error({ err }, 'write stream error');
      }

      const hash = await hashOfZipContent(downloadFileName, extractPath);
      logger.trace(
        { hash },
        `Generated hash for ${build.name}-${build.version}`
      );

      // delete zip file
      await fs.deleteLocalFile(downloadFileName);
      await fs.deleteLocalFile(extractPath);

      return hash;
    },
    { concurrency: 4 } // allow to look up 4 builds for this version in parallel
  );
  // filter out null values and push to record
  return hashes.filter((value) => value);
}

export default async function createHashes(
  repository: string,
  version: string,
  cacheDir: string
): Promise<string[]> {
  // check cache for hashes
  const repositoryRegexResult = /^hashicorp\/(?<lookupName>\S+)$/.exec(
    repository
  );
  if (!repositoryRegexResult) {
    // non hashicorp builds are not supported at the moment
    return null;
  }
  const lookupName = repositoryRegexResult.groups.lookupName;
  const backendLookUpName = `terraform-provider-${lookupName}`;

  const cacheKey = `${defaultRegistryUrls[1]}/${repository}/${lookupName}-${version}`;
  const cachedRelease = await packageCache.get<string[]>(
    'terraform-provider-release',
    cacheKey
  );
  // istanbul ignore if
  if (cachedRelease) {
    return cachedRelease;
  }
  let versionReleaseBackend;
  try {
    versionReleaseBackend = await getReleaseBackendIndex(
      backendLookUpName,
      version
    );
    /* istanbul ignore next */
  } catch (err) {
    logger.debug(
      { err, backendLookUpName, version },
      `Failed to retrieve builds for ${backendLookUpName} ${version}`
    );
    return null;
  }

  const builds = versionReleaseBackend.builds;
  const hashes = await calculateHashes(builds, cacheDir);
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

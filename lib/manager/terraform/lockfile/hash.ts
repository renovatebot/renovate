import crypto from 'crypto';
import * as fs from 'fs';
import { createWriteStream } from 'fs';
import extract from 'extract-zip';
import pMap from 'p-map';
import {
  defaultRegistryUrls,
  id,
} from '../../../datasource/terraform-provider';
import {
  TerraformBuild,
  VersionDetailResponse,
} from '../../../datasource/terraform-provider/types';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { Http } from '../../../util/http';

const http = new Http(id);

export function hashFiles(files: string[]): string {
  const rootHash = crypto.createHash('sha256');

  files.forEach((file) => {
    // build for every file a line looking like "aaaaaaaaaaaaaaa  file.txt\n"
    const hash = crypto.createHash('sha256');

    // a sha256sum displayed as lowercase hex string to root hash
    const fileBuffer = fs.readFileSync(file);
    hash.update(fileBuffer);
    hash.end();
    const data = hash.read();
    rootHash.update(data.toString('hex'));

    // add double space, the filename and a new line char
    rootHash.update('  ');
    const fileName = file.replace(/^.*[\\/]/, '');
    rootHash.update(fileName);
    rootHash.update('\n');
  });

  rootHash.end();
  const rootData = rootHash.read();
  const result: string = rootData.toString('base64');
  return `h1:${result}`;
}

export async function hashOfZipContent(
  zipFilePath: string,
  extractPath: string
): Promise<string> {
  await extract(zipFilePath, { dir: extractPath });
  const files = fs.readdirSync(extractPath);
  // the h1 hashing algorithms requires that the files are sorted by filename
  const sortedFiles = files.sort((a, b) => a.localeCompare(b));
  const filesWithPath = sortedFiles.map((file) => `${extractPath}/${file}`);

  const result = hashFiles(filesWithPath);

  // delete extracted files
  filesWithPath.forEach((value) =>
    fs.unlink(value, (err) => {
      if (err) {
        logger.warn({ err }, 'Failed to delete extracted file');
      }
    })
  );
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
      try {
        logger.trace(
          `Downloading archive and generating hash for ${build.name}-${build.version}...`
        );
        const stream = http.stream(build.url);
        const writeStream = createWriteStream(downloadFileName);
        stream.pipe(writeStream);
        /* istanbul ignore next */
        writeStream.on('error', (err) => {
          logger.error({ err }, 'write stream error');
        });

        const streamPromise = new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          stream.on('error', reject);
        });
        await streamPromise;

        const hash = await hashOfZipContent(downloadFileName, extractPath);
        logger.trace(
          { hash },
          `Generated hash for ${build.name}-${build.version}`
        );
        return hash;
      } catch (e) {
        logger.error(e);
        return null;
      } finally {
        // delete zip file
        fs.unlink(downloadFileName, (err) => {
          /* istanbul ignore next */
          if (err) {
            logger.debug({ err }, `Failed to delete file ${downloadFileName}`);
          }
        });
      }
    },
    { concurrency: 4 } // allow to look up 4 builds for this version in parallel
  );
  // filter out null values and push to record
  return hashes.filter((value) => value);
}

export async function createHashes(
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

  const versionReleaseBackend = await getReleaseBackendIndex(
    backendLookUpName,
    version
  );
  if (versionReleaseBackend == null) {
    logger.debug(
      { backendLookUpName, version },
      `Failed to retrieve builds for ${backendLookUpName} ${version}`
    );
    return null;
  }
  const builds = versionReleaseBackend.builds;
  const hashes = await calculateHashes(builds, cacheDir);

  // save to cache
  await packageCache.set('terraform-provider-release', cacheKey, hashes, 10080); // cache for a week
  return hashes;
}

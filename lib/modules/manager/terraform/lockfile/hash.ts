import crypto from 'node:crypto';
import path from 'node:path';
import util from 'node:util';
import extract from 'extract-zip';
import upath from 'upath';
import { logger } from '../../../../logger';
import {
  asyncFilter,
  coerceArray,
  deduplicateArray,
  isNotNullOrUndefined,
} from '../../../../util/array';
import { cache } from '../../../../util/cache/package/decorator';
import * as fs from '../../../../util/fs';
import { ensureCacheDir } from '../../../../util/fs';
import { Http } from '../../../../util/http';
import * as p from '../../../../util/promises';
import { TerraformProviderDatasource } from '../../../datasource/terraform-provider';
import type { TerraformBuild } from '../../../datasource/terraform-provider/types';

export class TerraformProviderHash {
  static http = new Http(TerraformProviderDatasource.id);

  static terraformDatasource = new TerraformProviderDatasource();

  static hashCacheTTL = 10080; // in minutes == 1 week
  // https://github.com/golang/go/issues/53448
  private static async hashFiles(
    basePath: string,
    files: string[],
  ): Promise<string> {
    const rootHash = crypto.createHash('sha256');

    for (const file of files) {
      // build for every file a line looking like "aaaaaaaaaaaaaaa  file.txt\n"

      // get hash of specific file
      const hash = crypto.createHash('sha256');
      const fileBuffer = await fs.readCacheFile(file);
      hash.update(fileBuffer);

      const fileName = path.relative(basePath, file);
      const line = util.format('%s  %s\n', hash.digest('hex'), fileName);
      rootHash.update(line);
    }

    return rootHash.digest('base64');
  }

  static async hashOfZipContent(
    zipFilePath: string,
    extractPath: string,
  ): Promise<string> {
    await extract(zipFilePath, {
      dir: extractPath,
    });
    const hash = await this.hashOfDir(extractPath);
    // delete extracted files
    await fs.rmCache(extractPath);

    return hash;
  }

  static async hashOfDir(dirPath: string): Promise<string> {
    const elements = await fs.listCacheDir(dirPath, { recursive: true });

    const sortedFiles = elements.sort();
    const elementsWithPath = sortedFiles.map(
      (element) => `${dirPath}/${element}`,
    );

    const filesWithPath = await asyncFilter(
      elementsWithPath,
      fs.cachePathIsFile,
    );
    return await TerraformProviderHash.hashFiles(dirPath, filesWithPath);
  }

  @cache({
    namespace: `datasource-${TerraformProviderDatasource.id}-build-hashes`,
    key: (build: TerraformBuild) => build.url,
    ttlMinutes: TerraformProviderHash.hashCacheTTL,
  })
  static async calculateSingleHash(
    build: TerraformBuild,
    cacheDir: string,
  ): Promise<string> {
    const downloadFileName = upath.join(cacheDir, build.filename);
    const extractPath = upath.join(cacheDir, 'extract', build.filename);
    logger.trace(
      `Downloading archive and generating hash for ${build.name}-${build.version}...`,
    );
    const readStream = TerraformProviderHash.http.stream(build.url);
    const writeStream = fs.createCacheWriteStream(downloadFileName);

    try {
      await fs.pipeline(readStream, writeStream);

      const hash = await this.hashOfZipContent(downloadFileName, extractPath);
      logger.trace(
        { hash },
        `Generated hash for ${build.name}-${build.version}`,
      );
      return hash;
    } finally {
      // delete zip file
      await fs.rmCache(downloadFileName);
    }
  }

  static async calculateHashScheme1Hashes(
    builds: TerraformBuild[],
  ): Promise<string[]> {
    const cacheDir = await ensureCacheDir('./others/terraform');

    // for each build download ZIP, extract content and generate hash for all containing files
    return p.map(builds, (build) => this.calculateSingleHash(build, cacheDir), {
      concurrency: 4,
    });
  }

  static async createHashes(
    registryURL: string,
    repository: string,
    version: string,
  ): Promise<string[] | null> {
    const builds = await TerraformProviderHash.terraformDatasource.getBuilds(
      registryURL,
      repository,
      version,
    );
    if (!builds) {
      return null;
    }

    // check if the publisher uses one shasum file for all builds or separate ones
    // we deduplicate to reduce the number of API calls
    const shaUrls = deduplicateArray(
      builds.map((build) => build.shasums_url).filter(isNotNullOrUndefined),
    );

    const zhHashes: string[] = [];
    for (const shaUrl of shaUrls) {
      const hashes =
        await TerraformProviderHash.terraformDatasource.getZipHashes(shaUrl);

      zhHashes.push(...coerceArray(hashes));
    }

    const h1Hashes =
      await TerraformProviderHash.calculateHashScheme1Hashes(builds);

    const hashes = [];
    hashes.push(...h1Hashes.map((hash) => `h1:${hash}`));
    hashes.push(...zhHashes.map((hash) => `zh:${hash}`));

    // sorting the hash alphabetically as terraform does this as well
    return hashes.sort();
  }
}

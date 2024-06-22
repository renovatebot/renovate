import crypto from 'node:crypto';
import extract from 'extract-zip';
import upath from 'upath';
import { logger } from '../../../../logger';
import {
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

  private static async hashElementList(
    basePath: string,
    fileSystemEntries: string[],
  ): Promise<string> {
    const rootHash = crypto.createHash('sha256');

    for (const entryPath of fileSystemEntries) {
      const absolutePath = upath.resolve(basePath, entryPath);
      if (!(await fs.cachePathIsFile(absolutePath))) {
        continue;
      }

      // build for every file a line looking like "aaaaaaaaaaaaaaa  file.txt\n"

      // get hash of specific file
      const hash = crypto.createHash('sha256');
      const fileBuffer = await fs.readCacheFile(absolutePath);
      hash.update(fileBuffer);

      const line = `${hash.digest('hex')}  ${upath.normalize(entryPath)}\n`;
      rootHash.update(line);
    }

    return rootHash.digest('base64');
  }

  /**
   * This is a reimplementation of the Go H1 hash algorithm found at https://github.com/golang/mod/blob/master/sumdb/dirhash/hash.go
   * The package provides two function HashDir and HashZip where the first is for hashing the contents of a directory
   * and the second for doing the same but implicitly extracting the contents first.
   *
   * The problem starts with that there is a bug which leads to the fact that HashDir and HashZip do not return the same
   * hash if there are folders inside the content which should be hashed.
   *
   * In a folder structure such as
   * .
   * ├── Readme.md
   * └── readme-assets/
   *     └── image.jpg
   *
   * HashDir will create a list of following entries which in turn will hash again
   * aaaaaaaaaaa  Readme.md\n
   * ccccccccccc  readme-assets/image.jpg\n
   *
   * HashZip in contrast will not filter out the directory itself but rather includes it in the hash list
   * aaaaaaaaaaa  Readme.md\n
   * bbbbbbbbbbb  readme-assets/\n
   * ccccccccccc  readme-assets/image.jpg\n
   *
   * As the resulting string is used to generate the final hash it will differ based on which function has been used.
   * The issue is tracked here: https://github.com/golang/go/issues/53448
   *
   * This implementation follows the intended implementation and filters out folder entries.
   * Terraform seems NOT to use HashZip for provider validation, but rather extracts it and then do the hash calculation
   * even as both are set up in their code base.
   * https://github.com/hashicorp/terraform/blob/3fdfbd69448b14a4982b3c62a5d36835956fcbaa/internal/getproviders/hash.go#L283-L305
   *
   * @param zipFilePath path to the zip file
   * @param extractPath path to where to temporarily extract the data
   */
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

    const sortedFileSystemObjects = elements.sort();
    return await TerraformProviderHash.hashElementList(
      dirPath,
      sortedFileSystemObjects,
    );
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

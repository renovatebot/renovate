import crypto from 'crypto';
import extract from 'extract-zip';
import pMap from 'p-map';
import upath from 'upath';
import { logger } from '../../../../logger';
import { cache } from '../../../../util/cache/package/decorator';
import * as fs from '../../../../util/fs';
import { ensureCacheDir } from '../../../../util/fs';
import { Http } from '../../../../util/http';
import { regEx } from '../../../../util/regex';
import { TerraformProviderDatasource } from '../../../datasource/terraform-provider';
import type { TerraformBuild } from '../../../datasource/terraform-provider/types';

export class TerraformProviderHash {
  static http = new Http(TerraformProviderDatasource.id);

  static terraformDatasource = new TerraformProviderDatasource();

  static hashCacheTTL = 10080; // in minutes == 1 week

  private static async hashFiles(files: string[]): Promise<string> {
    const rootHash = crypto.createHash('sha256');

    for (const file of files) {
      // build for every file a line looking like "aaaaaaaaaaaaaaa  file.txt\n"
      const hash = crypto.createHash('sha256');

      // a sha256sum displayed as lowercase hex string to root hash
      const fileBuffer = await fs.readFile(file);
      hash.update(fileBuffer);
      rootHash.update(hash.digest('hex'));

      // add double space, the filename and a new line char
      rootHash.update('  ');
      const fileName = file.replace(regEx(/^.*[\\/]/), '');
      rootHash.update(fileName);
      rootHash.update('\n');
    }

    return rootHash.digest('base64');
  }

  static async hashOfZipContent(
    zipFilePath: string,
    extractPath: string
  ): Promise<string> {
    await extract(zipFilePath, { dir: extractPath });
    const files = await fs.readdir(extractPath);
    // the h1 hashing algorithms requires that the files are sorted by filename
    const sortedFiles = files.sort((a, b) => a.localeCompare(b));
    const filesWithPath = sortedFiles.map((file) => `${extractPath}/${file}`);

    const result = await TerraformProviderHash.hashFiles(filesWithPath);

    // delete extracted files
    await fs.rm(extractPath, { recursive: true });

    return result;
  }

  @cache({
    namespace: `datasource-${TerraformProviderDatasource.id}-build-hashes`,
    key: (build: TerraformBuild) => build.url,
    ttlMinutes: TerraformProviderHash.hashCacheTTL,
  })
  static async calculateSingleHash(
    build: TerraformBuild,
    cacheDir: string
  ): Promise<string> {
    const downloadFileName = upath.join(cacheDir, build.filename);
    const extractPath = upath.join(cacheDir, 'extract', build.filename);
    logger.trace(
      `Downloading archive and generating hash for ${build.name}-${build.version}...`
    );
    const readStream = TerraformProviderHash.http.stream(build.url);
    const writeStream = fs.createWriteStream(downloadFileName);

    try {
      await fs.pipeline(readStream, writeStream);

      const hash = await this.hashOfZipContent(downloadFileName, extractPath);
      logger.trace(
        { hash },
        `Generated hash for ${build.name}-${build.version}`
      );
      return hash;
    } finally {
      // delete zip file
      await fs.unlink(downloadFileName);
    }
  }

  static async calculateHashes(builds: TerraformBuild[]): Promise<string[]> {
    const cacheDir = await ensureCacheDir('./others/terraform');

    // for each build download ZIP, extract content and generate hash for all containing files
    return pMap(
      builds,
      (build) => this.calculateSingleHash(build, cacheDir),
      { concurrency: 4 } // allow to look up 4 builds for this version in parallel
    );
  }

  static async createHashes(
    registryURL: string,
    repository: string,
    version: string
  ): Promise<string[] | null> {
    const builds = await TerraformProviderHash.terraformDatasource.getBuilds(
      registryURL,
      repository,
      version
    );
    if (!builds) {
      return null;
    }
    const hashes = await TerraformProviderHash.calculateHashes(builds);

    // sorting the hash alphabetically as terraform does this as well
    return hashes.sort().map((hash) => `h1:${hash}`);
  }
}

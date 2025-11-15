import { createUnzip } from 'zlib';
import * as lzma from 'lzma-native';
import unbzip2 from 'unbzip2-stream';
import * as fs from '../../../util/fs';

/**
 * Extracts the specified compressed file to the output file.
 *
 * @param compressedFile - The path to the compressed file.
 * @param compression - The compression method used (currently 'gz', 'xz' and 'bzip2' are supported).
 * @param outputFile - The path where the extracted content will be stored.
 * @throws Will throw an error if the compression method is unknown.
 */
export async function extract(
  compressedFile: string,
  compression: string,
  outputFile: string,
): Promise<void> {
  const source = fs.createCacheReadStream(compressedFile);
  const destination = fs.createCacheWriteStream(outputFile);

  switch (compression) {
    case 'gz':
      await fs.pipeline(source, createUnzip(), destination);
      break;
    case 'xz':
      await fs.pipeline(source, lzma.createDecompressor(), destination);
      break;
    case 'bz2':
      await fs.pipeline(source, unbzip2(), destination);
      break;
    default:
      throw new Error(`Unsupported compression standard '${compression}'`);
  }
}

/**
 * Checks if the file exists and retrieves its creation time.
 *
 * @param filePath - The path to the file.
 * @returns The creation time if the file exists, otherwise undefined.
 */
export async function getFileCreationTime(
  filePath: string,
): Promise<Date | undefined> {
  const stats = await fs.statCacheFile(filePath);
  return stats?.ctime;
}

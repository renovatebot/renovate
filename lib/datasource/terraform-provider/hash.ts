import crypto from 'crypto';
import * as fs from 'fs';
import extract from 'extract-zip';
import { logger } from '../../logger';

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
    fs.unlink(value, (err) =>
      logger.warn({ err }, 'Failed to delete extracted file')
    )
  );
  return result;
}

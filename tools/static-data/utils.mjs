import { isString } from '@sindresorhus/is';
import fs from 'fs-extra';
import prettier from 'prettier';

/**
 * Update given file with new provided data.
 * @param {string} file Path to a data file
 * @param {string|NodeJS.ArrayBufferView} newData New data to be written
 */
export async function updateJsonFile(file, newData) {
  try {
    console.log(`Updating ${file}`);
    const newString = isString(newData)
      ? newData
      : Buffer.from(
          newData.buffer,
          newData.byteOffset,
          newData.byteLength,
        ).toString('utf8');
    const pretty = await prettier.format(newString, { parser: 'json' });
    await fs.writeFile(file, pretty);
  } catch (e) {
    console.error(e.toString());
    process.exit(1);
  }
}

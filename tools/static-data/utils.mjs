import fs from 'fs-extra';

/**
 * Update given file with new provided data.
 * @param {string} file Path to a data file
 * @param {string|NodeJS.ArrayBufferView} newData New data to be written
 */
export async function updateJsonFile(file, newData) {
  try {
    console.log(`Updating ${file}`);
    await fs.writeFile(file, newData);
  } catch (e) {
    console.error(e.toString());
    process.exit(1);
  }
}

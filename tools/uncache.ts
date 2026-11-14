/**
 * Decompress and unencode values from the Package Cache or Repository Cache.
 *
 * Usage:
 *
 *  node tools/uncache.ts "$(redis-cli get "datasource-npm:cache-provider-https://registry.npmjs.org/nock")"
 *  node tools/uncache.ts ~/Downloads/cache.json
 *  node tools/uncache.ts G0ohAAQi1GVVr/.......
 *
 * Supports:
 *
 * - cache values from the Package Cache
 * - cache values from the Repository Cache
 */
import fs from 'fs-extra';
import { decompressFromBase64 } from '../lib/util/compress.ts';

const input = process.argv[2];

let toDecode = undefined;

if (input.startsWith('{')) {
  const encoded = JSON.parse(input);
  toDecode =
    // if it's from the Package Cache
    encoded.value ??
    // if it's from the Repository Cache
    encoded.payload;
} else if (await fs.exists(input)) {
  const encoded = JSON.parse(await fs.readFile(input, 'utf8'));

  toDecode =
    // if it's from the Package Cache
    encoded.value ??
    // if it's from the Repository Cache
    encoded.payload;
} else {
  toDecode = input;
}

// oxlint-disable-next-line no-console -- intentional: not production code
console.log(await decompressFromBase64(toDecode));

import { createReadStream } from 'fs';
import { performance } from 'perf_hooks';
import readline from 'readline';

async function probeExtractedPackage(extractedFile, packageName) {
  const requiredPackageKeys = ['Package', 'Version', 'Homepage'];
  const rl = readline.createInterface({
    input: createReadStream(extractedFile),
    terminal: false,
  });
  let pd = {};
  for await (const line of rl) {
    if (line === '') {
      // now we should have all information available
      if (pd.Package === packageName) {
        // return { releases: [{ version: pd.Version }], homepage: pd.Homepage };
      }
      pd = {};
      continue;
    }

    for (let i = 0; i < requiredPackageKeys.length; i++) {
      if (line.startsWith(requiredPackageKeys[i])) {
        pd[requiredPackageKeys[i]] = line
          .substring(requiredPackageKeys[i].length + 1)
          .trim();
        break;
      }
    }
  }

  return null;
}

const startTime = performance.now();
const p = await probeExtractedPackage(
  '/tmp/renovate-deb/packages/6a3a33ecf7f7cfdd630f78c3e840c5bf3bbb9c090f139a178c44dd6dd2de7154.txt',
  'curl'
);
var endTime = performance.now();
console.log(`Took  ${endTime - startTime} ms`);

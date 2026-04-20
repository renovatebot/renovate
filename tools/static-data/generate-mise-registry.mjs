import { execSync } from 'child_process';
import { updateJsonFile } from './utils.mjs';

// use the JSON output, as the default output includes a banner
const versionOutput = execSync('mise version --json', { encoding: 'utf8' });
/** @type {{ version: string;  }} */
const version = JSON.parse(versionOutput);
console.log(`Generating mise registry using mise version ${version.version}`);
const output = execSync('mise registry --json', { encoding: 'utf8' });
/** @type {{ short: string; backends: string[] }[]} */
const tools = JSON.parse(output);

const registry = Object.fromEntries(
  tools
    .map(
      ({ short, backends }) =>
        /** @type {[string, string[]]} */ ([short, backends]),
    )
    .sort(([a], [b]) => a.localeCompare(b)),
);

await updateJsonFile(
  'lib/data/mise-registry.json',
  JSON.stringify(registry, null, 2) + '\n',
);

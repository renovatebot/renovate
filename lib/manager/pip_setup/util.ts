import { resolveFile } from '../../util';
import { readFile, readLocalFile, writeLocalFile } from '../../util/fs';

// need to match filename in `data/extract.py`
const REPORT = 'renovate-python-report.json';
const EXTRACT = 'renovate-python-extract.py';

let extractPy: string | undefined;

export async function copyExtractFile(): Promise<string> {
  if (extractPy === undefined) {
    const file = await resolveFile('data/extract.py');
    extractPy = await readFile(file, 'utf8');
  }

  await writeLocalFile(EXTRACT, extractPy);

  return EXTRACT;
}

export interface PythonSetup {
  extras_require: string[];
  install_requires: string[];
}

export async function parseReport(): Promise<PythonSetup> {
  const data = await readLocalFile(REPORT, 'utf8');
  return JSON.parse(data);
}

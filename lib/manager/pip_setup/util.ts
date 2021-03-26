import { dirname } from 'path';
import { join } from 'upath';
import dataFiles from '../../data-files.generated';
import { ensureCacheDir, outputFile, readLocalFile } from '../../util/fs';

// need to match filename in `data/extract.py`
const REPORT = 'renovate-pip_setup-report.json';
const EXTRACT = 'renovate-pip_setup-extract.py';

let extractPy: string | undefined;

export async function getExtractFile(): Promise<string> {
  if (extractPy) {
    return extractPy;
  }

  const cacheDir = await ensureCacheDir('./others/pip_setup');
  extractPy = join(cacheDir, EXTRACT);
  await outputFile(extractPy, dataFiles.get('extract.py'));

  return extractPy;
}

export interface PythonSetup {
  extras_require: Record<string, string[]>;
  install_requires: string[];
}

export async function parseReport(packageFile: string): Promise<PythonSetup> {
  const data = await readLocalFile(join(dirname(packageFile), REPORT), 'utf8');
  return JSON.parse(data);
}

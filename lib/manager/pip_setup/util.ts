import { dirname } from 'path';
import { join } from 'upath';
import dataFiles from '../../data-files.generated';
import { ensureCacheDir, outputFile, readLocalFile } from '../../util/fs';
import type { PythonSetup } from './types';

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
  await outputFile(extractPy, dataFiles.get('data/extract.py'));

  return extractPy;
}

export async function parseReport(packageFile: string): Promise<PythonSetup> {
  const data = await readLocalFile(join(dirname(packageFile), REPORT), 'utf8');
  return JSON.parse(data);
}

import { readFile, updateFile } from '../utils/index.ts';
import { generateLockFileTable } from './config.ts';
import { replaceContent } from './utils.ts';

export async function generateLockFileMaintenance(dist: string): Promise<void> {
  const fileName = `${dist}/key-concepts/lock-file-maintenance.md`;
  let content = await readFile(fileName);
  content = replaceContent(content, generateLockFileTable(), {
    replaceStart: '<!-- lock-file-table-begin -->',
    replaceStop: '<!-- lock-file-table-end -->',
  });

  await updateFile(fileName, content);
}

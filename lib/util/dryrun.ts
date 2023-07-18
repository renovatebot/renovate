import { GlobalConfig } from '../config/global';
import { logger } from '../logger';
import { writeLocalFile } from './fs';

export function dryRunCanDoAction(
  name: string,
  jsonData: object | string,
  markdownData?: string,
  loggerMeta?: Record<string, any>
): boolean {
  const dryRun = GlobalConfig.get('dryRun');
  if (dryRun) {
    logger.info(loggerMeta ?? {}, `DRY-RUN: Would ${name}`);
    if (GlobalConfig.get('localDir')) {
      void writeLocalFile(
        `dryrun/${name}.json`,
        JSON.stringify(jsonData, undefined, 2)
      );
      if (markdownData) {
        void writeLocalFile(`dryrun/${name}.md`, markdownData);
      }
    }
  }
  return !!dryRun;
}

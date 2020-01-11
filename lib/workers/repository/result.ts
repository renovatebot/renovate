import { RenovateConfig } from '../../config';

type ProcessStatus = 'disabled' | 'enabled' | 'onboarding' | 'unknown';

export interface ProcessResult {
  res: string;
  status: ProcessStatus;
}

export function processResult(
  config: RenovateConfig,
  res: string
): ProcessResult {
  const disabledStatuses = [
    'archived',
    'blocked',
    'cannot-fork',
    'disabled',
    'forbidden',
    'fork',
    'mirror',
    'no-package-files',
    'renamed',
    'uninitiated',
    'empty',
  ];
  let status: ProcessStatus;
  // istanbul ignore next
  if (disabledStatuses.includes(res)) {
    status = 'disabled';
  } else if (config.repoIsOnboarded) {
    status = 'enabled';
  } else if (config.repoIsOnboarded === false) {
    status = 'onboarding';
  } else {
    status = 'unknown';
  }
  return { res, status };
}

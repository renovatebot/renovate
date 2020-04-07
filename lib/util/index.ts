import { setExecConfig } from './exec';
import { setFsConfig } from './fs';
import { RenovateConfig } from '../config/common';

export async function setUtilConfig(
  config: Partial<RenovateConfig>
): Promise<void> {
  await setExecConfig(config);
  setFsConfig(config);
}

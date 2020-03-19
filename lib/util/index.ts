import { setExecConfig } from './exec';
import { setFsConfig } from './fs';

export async function setUtilConfig(config: any): Promise<void> {
  await setExecConfig(config);
  setFsConfig(config);
}

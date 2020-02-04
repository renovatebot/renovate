import { setExecConfig } from './exec';
import { setFsConfig } from './fs';

export function setUtilConfig(config: any): void {
  setExecConfig(config);
  setFsConfig(config);
}

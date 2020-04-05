import * as template from '../../../util/template';
import { BranchConfig } from '../../common';

// istanbul ignore next
export function getPrBanner(config: BranchConfig): string {
  if (config.global && config.global.prBanner) {
    return template.compile(config.global.prBanner, config) + '\n\n';
  }
  if (config.isGroup) {
    return ''; // TODO: why?
  }
  if (!config.prBanner) {
    return '';
  }
  return template.compile(config.prBanner.toString(), config) + '\n\n';
}

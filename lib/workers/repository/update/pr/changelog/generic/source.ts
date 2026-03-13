import { BranchUpgradeConfig } from '../../../../../types.ts';
import { ChangeLogSource } from '../source.ts';

export class GenericChangeLogSource extends ChangeLogSource {
  constructor() {
    super('generic', null!);
  }

  override getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    throw new Error('Method not implemented.');
  }

  override getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return config.changelogUrl!;
  }

  override hasValidRepository(repository: string): boolean {
    return true;
  }
}

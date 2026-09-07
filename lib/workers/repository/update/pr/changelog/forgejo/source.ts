import { ChangeLogSource } from '../source.ts';

export class ForgejoChangeLogSource extends ChangeLogSource {
  constructor() {
    super('forgejo');
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    return `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
  }

  override hasValidRepository(repository: string): boolean {
    return repository.split('/').length === 2;
  }
}

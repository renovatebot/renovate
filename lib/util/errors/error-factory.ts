import { RepositoryError } from './repository-error';

interface Context {
  branchName?: string;
  repositoryName?: string;
}

export class ErrorFactory {
  private context: Context;

  setContext(context: Context): void {
    this.context = context;
  }

  throwRepositoryError(code: string): RepositoryError {
    throw new RepositoryError(code, this.context.repositoryName);
  }
}

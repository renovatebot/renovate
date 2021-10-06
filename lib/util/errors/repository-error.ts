export class RepositoryError extends Error {
  private readonly repositoryName?: string;

  public constructor(message?: string, repositoryName?: string) {
    super(message);
    this.repositoryName = repositoryName;
  }

  public override toString(): string {
    if (this.repositoryName) {
      return `${this.name} (${this.repositoryName}): ${this.message}`;
    }

    return `${this.name}: ${this.message}`;
  }
}

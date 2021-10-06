export class BranchError extends Error {
  private readonly branchName?: string;

  public constructor(message?: string, branchName?: string) {
    super(message);
    this.branchName = branchName;
  }

  public override toString(): string {
    if (this.branchName) {
      return `${this.name} (${this.branchName}): ${this.message}`;
    }

    return `${this.name}: ${this.message}`;
  }
}

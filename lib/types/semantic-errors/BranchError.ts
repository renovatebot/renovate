export class BranchError extends Error {
  private readonly branchName: string;

  public constructor(branchName: string, message?: string) {
    super(message);
    this.branchName = branchName;
  }

  public override toString(): string {
    return `${this.name} (${this.branchName}): ${this.message}`;
  }
}

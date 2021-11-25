export class SemanticCommitMessage {
  private static readonly REGEXP =
    /(?<type>\w+)\s*[(]*(?<scope>\w+)*[)]*:\s*(?<description>[\w\s]*)/;

  readonly type: string;
  readonly scope?: string;
  readonly description: string;

  constructor(type: string, description: string, scope?: string) {
    this.type = type;
    this.description = description;
    this.scope = scope;
  }

  static fromString(message: string): SemanticCommitMessage {
    const { groups } = message.match(SemanticCommitMessage.REGEXP);

    return new SemanticCommitMessage(
      groups.type?.trim(),
      groups.description?.trim(),
      groups.scope?.trim()
    );
  }
}

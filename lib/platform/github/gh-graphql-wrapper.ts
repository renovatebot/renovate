import get from './gh-got-wrapper';

export default class Graphql {
  repoOwner: string = '';

  repoName: string = '';

  repoItem: string = '';

  repoItemFilterBy: string = '';

  repoItemNodeList: string[] = [];

  repoResultNumEls: number = 100;

  setRepoOwner(owner: string): void {
    this.repoOwner = owner;
  }

  setRepoName(name: string): void {
    this.repoName = name;
  }

  setRepoItem(item: string): void {
    this.repoItem = item;
  }

  setRepoItemFilterBy(itemFilterBy: string): void {
    this.repoItemFilterBy = itemFilterBy;
  }

  setRepoItemNodeList(itemNodeList: string[]): void {
    this.repoItemNodeList = itemNodeList;
  }

  setRepoResultNumEls(numEls: number): void {
    this.repoResultNumEls = numEls;
  }

  async get(cursor = ''): Promise<any> {
    const url = 'graphql';
    const headers = {
      accept: 'application/vnd.github.merge-info-preview+json',
    };
    const afterCursor = cursor === '' ? null : `"${cursor}"`;
    // prettier-ignore
    const nodeListString = this.repoItemNodeList.join('\n');
    const query = `
    query {
      repository(owner: "${this.repoOwner}", name: "${this.repoName}") {
        ${this.repoItem}(first: ${this.repoResultNumEls}, after:${afterCursor}, orderBy: {field: UPDATED_AT, direction: DESC}, filterBy: ${this.repoItemFilterBy}) {
          pageInfo {
            startCursor
            hasNextPage
          }
          nodes {
            ${nodeListString}
          }
        }
      }
    }
    `;

    const options = {
      headers,
      body: JSON.stringify({ query }),
      json: false,
    };

    try {
      const res = JSON.parse((await (get as any).post(url, options)).body);

      if (!res.data && !res.errors) {
        // retry query until numElements == 1
        if (this.repoResultNumEls === 1) {
          logger.info({ query, res }, 'No graphql res.data');
          return [false, [], ''];
        }

        this.repoResultNumEls = parseInt(
          (this.repoResultNumEls / 2).toString(),
          10
        );
        return await this.get(cursor);
      }

      const nextCursor = res.data.repository[this.repoItem].pageInfo.hasNextPage
        ? res.data.repository[this.repoItem].pageInfo.startCursor
        : '';

      return [true, res.data.repository[this.repoItem].nodes, nextCursor];
    } catch (err) {
      logger.warn({ query, err }, 'graphql.get error');
      throw new Error('platform-error');
    }
  }

  async getAll(): Promise<any> {
    let [success, elements, nextCursor] = await this.get('');
    const allElements = [];

    while (success) {
      allElements.push(...elements);

      if (!nextCursor) {
        break;
      }

      [success, elements, nextCursor] = await this.get(nextCursor);
    }

    return allElements;
  }
}

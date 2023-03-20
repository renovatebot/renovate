import type { IssueCollectorId } from './issue-collector';
import { JiraIssueCollector } from './jira';
import type { IssueCollectorAPI } from './types';

const api = new Map<IssueCollectorId, IssueCollectorAPI>();
export default api;

api.set(JiraIssueCollector.id, new JiraIssueCollector());

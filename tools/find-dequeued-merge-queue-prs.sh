#!/bin/bash

# Find open, approved PRs which have been dequeued (removed) from the merge queue
# but aren't currently back in the queue, and label them so they're easier to spot
# and requeue.
#
# See: https://www.jvt.me/posts/2026/08/11/github-merge-queue-prs/

REPO='renovatebot/renovate'
LABEL='status:merge-queue-dequeued'

QUERY='
query {
  search(query: "repo:'"$REPO"' is:pr is:open review:approved", type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        number
        mergeQueueEntry {
          id
        }
        labels(first: 50) {
          nodes {
            name
          }
        }
        timelineItems(last: 1, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) {
          nodes {
            ... on RemovedFromMergeQueueEvent {
              reason
            }
          }
        }
      }
    }
  }
}'

RESULT=$(gh api graphql -f query="$QUERY") || { echo "Failed to query GraphQL API"; exit 1; }

# PRs which: have been removed from the queue, aren't currently re-queued, and don't already have the label
DEQUEUED_PRS=$(echo "$RESULT" | jq --arg label "$LABEL" '
  [.data.search.nodes[]
    | select(.mergeQueueEntry == null)
    | select(.timelineItems.nodes | length > 0)
    | select([.labels.nodes[].name] | index($label) | not)
    | {number, reason: .timelineItems.nodes[0].reason}]') || { echo "Failed to parse GraphQL response"; exit 1; }

COUNT=$(echo "$DEQUEUED_PRS" | jq 'length')

if [ "$COUNT" -eq 0 ]; then
    echo "No newly dequeued PRs found."
    exit 0
fi

echo "Found $COUNT PR(s) dequeued from the merge queue:"

for NUMBER in $(echo "$DEQUEUED_PRS" | jq -r '.[].number'); do
    REASON=$(echo "$DEQUEUED_PRS" | jq -r --argjson n "$NUMBER" '.[] | select(.number == $n) | .reason')
    echo "- #$NUMBER (reason: $REASON)"
    gh pr edit "$NUMBER" --repo "$REPO" --add-label "$LABEL" || { echo "Failed to label PR #$NUMBER"; exit 1; }
done

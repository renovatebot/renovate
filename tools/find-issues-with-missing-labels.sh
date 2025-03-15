#!/bin/bash

# When the repository labels are changed (i.e dropped a label, added a label, etc), you should make the same change to the lists below.
# For example, if the repository added a "type:task" type label, then add "-label:type:task" to the TYPE_LABELS_FILTER.

PRIORITY_LABELS_FILTER='-label:priority-1-critical -label:priority-2-high -label:priority-3-medium -label:priority-4-low'
ISSUE_TYPE_FILTER='-type:Bug -type:Feature -type:Task'

HAS_ISSUES_MISSING_LABELS=false
HAS_ISSUES_MISSING_ISSUE_TYPE=false

ISSUE_BODY="# Label check action\n"

REPO='renovatebot/renovate'

ISSUE_TITLE="Issues with missing labels"

# Extract the label type from the filter
LABEL_TYPE=$(echo "$PRIORITY_LABELS_FILTER" | cut -d ':' -f 2 | cut -d '-' -f 1)

# Fetch issues that match the filter
ISSUES_MISSING_LABEL=$(gh issue list --repo $REPO --limit 100000 -s open -S "$PRIORITY_LABELS_FILTER" --json "number,title") || { echo "Failed to fetch issues without $LABEL_TYPE labels"; exit 1; }
# Ignore the Issue from the "Find issues with missing labels" Action
ISSUES_MISSING_LABEL=$(echo "$ISSUES_MISSING_LABEL" | jq --arg title "$ISSUE_TITLE" 'map(select(.title != $title))')

if [ "$ISSUES_MISSING_LABEL" != "[]" ]; then
    HAS_ISSUES_MISSING_LABELS=true
    
    # Create a list of issue numbers
    FORMATTED_OUTPUT=$(echo "$ISSUES_MISSING_LABEL" | jq -r '.[].number' | sed 's/^/- https:\/\/redirect.github.com\/renovatebot\/renovate\/issues\//')
    
    # Count the issues and decide if the output should be singular or plural
    ISSUE_COUNT=$(echo "$ISSUES_MISSING_LABEL" | jq '. | length')
    ISSUE_SINGULAR_PLURAL=$(if [ "$ISSUE_COUNT" -eq 1 ]; then echo "issue"; else echo "issues"; fi)
    
    # Append the "list of issues without labels" to the issue body
    ISSUE_BODY="$ISSUE_BODY## Found $ISSUE_COUNT $ISSUE_SINGULAR_PLURAL missing \`$LABEL_TYPE:\` labels:\n$FORMATTED_OUTPUT\n"
fi

# Extract the issue type from the filter
LABEL_TYPE=$(echo "$ISSUE_TYPE_FILTER" | cut -d ':' -f 2)

# Fetch issues that match the filter
ISSUES_MISSING_TYPE=$(gh issue list --repo $REPO --limit 100000 -s open -S "$ISSUE_TYPE_FILTER" --json "number,title") || { echo "Failed to fetch issues without $LABEL_TYPE"; exit 1; }
# Ignore the Issue from the "Find issues with missing labels" Action
ISSUES_MISSING_TYPE=$(echo "$ISSUES_MISSING_TYPE" | jq --arg title "$ISSUE_TITLE" 'map(select(.title != $title))')

if [ "$ISSUES_MISSING_TYPE" != "[]" ]; then
    HAS_ISSUES_MISSING_ISSUE_TYPE=true
    
    # Create a list of issue numbers
    FORMATTED_OUTPUT=$(echo "$ISSUES_MISSING_TYPE" | jq -r '.[].number' | sed 's/^/- https:\/\/redirect.github.com\/renovatebot\/renovate\/issues\//')
    
    # Count the issues and decide if the output should be singular or plural
    ISSUE_COUNT=$(echo "$ISSUES_MISSING_TYPE" | jq '. | length')
    ISSUE_SINGULAR_PLURAL=$(if [ "$ISSUE_COUNT" -eq 1 ]; then echo "issue"; else echo "issues"; fi)
    
    # Append the "list of issues without issye type" to the issue body
    ISSUE_BODY="$ISSUE_BODY## Found $ISSUE_COUNT $ISSUE_SINGULAR_PLURAL missing issue type:\n$FORMATTED_OUTPUT\n"
fi

if [[ "$HAS_ISSUES_MISSING_LABELS" == "false" && "$HAS_ISSUES_MISSING_ISSUE_TYPE" == "false" ]]; then
    echo "All checked issues have labels and type."
    ISSUE_BODY="$ISSUE_BODY All checked issues are correctly labeled and have issue type.\n"
fi

ISSUE_NUMBER=33236

# Edit the open issue, and update the list of issues.
gh issue edit "$ISSUE_NUMBER" --repo $REPO --title "$ISSUE_TITLE" --body "$(echo -e "$ISSUE_BODY")" || { echo "Failed to update issue."; exit 1; }

if [[ "$HAS_ISSUES_MISSING_LABELS" == "false" && "$HAS_ISSUES_MISSING_ISSUE_TYPE" == "false" ]]; then
    exit 0
fi

# Show the list of "issues with missing labels" in the logs.
echo -e "$ISSUE_BODY"

# Log a message and "fail" the Action if there are issues with missing labels
echo "Found issues without labels. Please check the issue(s) listed above. Exiting the action."

exit 1

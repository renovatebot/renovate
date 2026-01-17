#!/bin/bash
set -e

# Check for undesirable code additions
# Usage: ./tools/check-undesirable-code.sh [base-branch]
# Default base branch: main

BASE_BRANCH="${1:-main}"
echo "Comparing against base branch: $BASE_BRANCH"

# Ensure we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check if base branch exists
if ! git rev-parse --verify "$BASE_BRANCH" > /dev/null 2>&1; then
    echo "❌ Error: Base branch '$BASE_BRANCH' does not exist"
    exit 1
fi

BASE_BRANCH_REF=$(git merge-base "$BASE_BRANCH" HEAD)
echo "Base branch ref: $BASE_BRANCH_REF"
echo ""

# ============================================================================
# Check 1: Snapshots in *.spec.ts files
# ============================================================================
echo "### Calculating diff for '*.spec.ts' files..."
git diff "$BASE_BRANCH_REF" -- '*.spec.ts' > /tmp/diff_spec_ts.txt

echo "### Counting additions and deletions of snapshots..."
ADDED=$(grep '^+' /tmp/diff_spec_ts.txt | grep -v '^+++' | grep -E '\.toMatch(Snapshot|InlineSnapshot)\(' | wc -l || true)
DELETED=$(grep '^-' /tmp/diff_spec_ts.txt | grep -v '^---' | grep -E '\.toMatch(Snapshot|InlineSnapshot)\(' | wc -l || true)

echo "Added snapshot calls: $ADDED"
echo "Deleted snapshot calls: $DELETED"

SNAPSHOTS_PASSED=false
if [ "$ADDED" -gt "$DELETED" ]; then
    echo "❌ Error: Snapshots have been added in this PR. Use toMatch instead."
    echo ""
else
    echo "✅ Snapshot code check passed."
    echo ""
    SNAPSHOTS_PASSED=true
fi

# ============================================================================
# Check 2: __fixtures__ files
# ============================================================================
echo "### Calculating file changes in '__fixtures__' directories..."
git diff --name-status "$BASE_BRANCH_REF" > /tmp/diff_name_status.txt

echo "### Processing added files in '__fixtures__' directories..."
ADDED_FIXTURES=$(grep '^A' /tmp/diff_name_status.txt | awk '{print $2}' | grep '/__fixtures__/' || true)
NUM_ADDED_FIXTURES=$(echo "$ADDED_FIXTURES" | grep -c . || true)
if [ -n "$ADDED_FIXTURES" ]; then
    echo "Added files in '__fixtures__':"
    echo "$ADDED_FIXTURES"
fi
echo "Total number of added files in '__fixtures__': $NUM_ADDED_FIXTURES"
echo ""

echo "### Processing deleted files in '__fixtures__' directories..."
DELETED_FIXTURES=$(grep '^D' /tmp/diff_name_status.txt | awk '{print $2}' | grep '/__fixtures__/' || true)
NUM_DELETED_FIXTURES=$(echo "$DELETED_FIXTURES" | grep -c . || true)
if [ -n "$DELETED_FIXTURES" ]; then
    echo "Deleted files in '__fixtures__':"
    echo "$DELETED_FIXTURES"
fi
echo "Total number of deleted files in '__fixtures__': $NUM_DELETED_FIXTURES"
echo ""

echo "### Processing renamed files involving '__fixtures__' directories..."
RENAME_ENTRIES=$(grep '^R' /tmp/diff_name_status.txt || true)

if [ -n "$RENAME_ENTRIES" ]; then
    while read -r line; do
        if [ -z "$line" ]; then
            continue
        fi
        STATUS=$(echo "$line" | awk '{print $1}')
        OLD_PATH=$(echo "$line" | awk '{print $2}')
        NEW_PATH=$(echo "$line" | awk '{print $3}')

        echo "Processing rename: $OLD_PATH -> $NEW_PATH"

        OLD_IN_FIXTURES=0
        NEW_IN_FIXTURES=0

        if echo "$OLD_PATH" | grep -q '/__fixtures__/'; then
            OLD_IN_FIXTURES=1
        fi

        if echo "$NEW_PATH" | grep -q '/__fixtures__/'; then
            NEW_IN_FIXTURES=1
        fi

        if [ "$OLD_IN_FIXTURES" -eq 1 ] && [ "$NEW_IN_FIXTURES" -eq 0 ]; then
            NUM_DELETED_FIXTURES=$((NUM_DELETED_FIXTURES + 1))
            echo "File moved out of '__fixtures__': $OLD_PATH -> $NEW_PATH"
        elif [ "$OLD_IN_FIXTURES" -eq 0 ] && [ "$NEW_IN_FIXTURES" -eq 1 ]; then
            NUM_ADDED_FIXTURES=$((NUM_ADDED_FIXTURES + 1))
            echo "File moved into '__fixtures__': $OLD_PATH -> $NEW_PATH"
        else
            echo "File renamed within the same directory: $OLD_PATH -> $NEW_PATH"
        fi
    done <<< "$RENAME_ENTRIES"
    echo ""
fi

echo "Updated total number of added files in '__fixtures__': $NUM_ADDED_FIXTURES"
echo "Updated total number of deleted files in '__fixtures__': $NUM_DELETED_FIXTURES"
echo ""

FIXTURES_PASSED=false
if [ "$NUM_ADDED_FIXTURES" -gt "$NUM_DELETED_FIXTURES" ]; then
    echo "❌ Error: More files have been added to '__fixtures__' directories than deleted."
    echo ""
else
    echo "✅ Fixtures files check passed."
    echo ""
    FIXTURES_PASSED=true
fi

# ============================================================================
# Final Result
# ============================================================================
rm -f /tmp/diff_spec_ts.txt /tmp/diff_name_status.txt

if [ "$SNAPSHOTS_PASSED" = true ] && [ "$FIXTURES_PASSED" = true ]; then
    echo "🎉 All checks passed successfully."
    exit 0
else
    echo "❌ Some checks failed. Please fix the issues above."
    exit 1
fi

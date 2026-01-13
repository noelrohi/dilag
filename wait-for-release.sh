#!/bin/bash

# Wait for GitHub Actions release workflow to complete
# Usage: ./wait-for-release.sh [run_id]

RUN_ID=${1:-$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')}

echo "Watching workflow run: $RUN_ID"
echo "View at: https://github.com/noelrohi/dilag/actions/runs/$RUN_ID"
echo ""

# Wait for the workflow to complete
gh run watch "$RUN_ID" --exit-status

# Check the result
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Release completed successfully!"
    # Play success sound and announce
    afplay /System/Library/Sounds/Glass.aiff &
    say "job is done"
else
    echo ""
    echo "❌ Release failed!"
    # Play error sound and announce
    afplay /System/Library/Sounds/Basso.aiff &
    say "job failed"
fi

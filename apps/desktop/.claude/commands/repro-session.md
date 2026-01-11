---
description: Debug and reproduce issues with a dilag session
arguments:
  - name: session_id
    description: The session ID to debug (e.g., ses_45d168f9affeUVwF6yWwaxf9jF)
    required: true
---

Debug session: $ARGUMENTS.session_id

## Steps

1. Find the opencode server port by running: `pgrep -fl "opencode serve"`
2. For each port found, check if the session exists: `curl -s "http://127.0.0.1:PORT/session?limit=10" | jq '.[] | select(.id == "$ARGUMENTS.session_id")'`
3. Once you find the right port, check session status: `curl -s "http://127.0.0.1:PORT/session/status" | jq '.["$ARGUMENTS.session_id"]'`
4. Check for pending questions: `curl -s "http://127.0.0.1:PORT/question" | jq '.[] | select(.sessionID == "$ARGUMENTS.session_id")'`
5. Check for pending permissions: `curl -s "http://127.0.0.1:PORT/permission" | jq '.[] | select(.sessionID == "$ARGUMENTS.session_id")'`
6. Get recent messages: `curl -s "http://127.0.0.1:PORT/session/$ARGUMENTS.session_id/message?limit=5" | jq '.[-1].parts | map(select(.type == "tool")) | .[-1] | {tool, status: .state.status}'`

## Common Issues

- **Session busy but no pending items**: Check last tool status - may be stuck in "running"
- **Streaming stopped after question**: Usually a permission is pending
- **Question tool error**: Often validation errors (header max 12 chars)

Report what you find and suggest next steps.

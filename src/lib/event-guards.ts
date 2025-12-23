/**
 * Type guards for OpenCode SDK events
 * Provides type-safe event handling without unsafe type assertions
 */

import type {
  Event,
  EventMessagePartUpdated,
  EventMessageUpdated,
  EventSessionStatus,
  EventSessionDiff,
  EventSessionIdle,
  EventSessionError,
} from "@opencode-ai/sdk/v2/client";

/**
 * Type guard for message.part.updated events
 */
export function isEventMessagePartUpdated(
  event: Event
): event is EventMessagePartUpdated {
  return (
    event.type === "message.part.updated" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "part" in event.properties
  );
}

/**
 * Type guard for message.updated events
 */
export function isEventMessageUpdated(
  event: Event
): event is EventMessageUpdated {
  return (
    event.type === "message.updated" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "info" in event.properties
  );
}

/**
 * Type guard for session.status events
 */
export function isEventSessionStatus(
  event: Event
): event is EventSessionStatus {
  return (
    event.type === "session.status" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "sessionID" in event.properties &&
    "status" in event.properties
  );
}

/**
 * Type guard for session.diff events
 */
export function isEventSessionDiff(event: Event): event is EventSessionDiff {
  return (
    event.type === "session.diff" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "sessionID" in event.properties &&
    "diff" in event.properties
  );
}

/**
 * Type guard for session.idle events
 */
export function isEventSessionIdle(event: Event): event is EventSessionIdle {
  return (
    event.type === "session.idle" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "sessionID" in event.properties
  );
}

/**
 * Type guard for session.error events
 */
export function isEventSessionError(event: Event): event is EventSessionError {
  return (
    event.type === "session.error" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "sessionID" in event.properties
  );
}

/**
 * Extracts session ID from any event type in a type-safe manner.
 * Searches through common property locations.
 *
 * @returns The session ID if found, null otherwise
 */
export function extractSessionId(event: Event): string | null {
  // Handle known event types first with type guards
  if (isEventMessagePartUpdated(event)) {
    return event.properties.part.sessionID ?? null;
  }

  if (isEventMessageUpdated(event)) {
    return event.properties.info.sessionID ?? null;
  }

  if (isEventSessionStatus(event)) {
    return event.properties.sessionID ?? null;
  }

  if (isEventSessionDiff(event)) {
    return event.properties.sessionID ?? null;
  }

  if (isEventSessionIdle(event)) {
    return event.properties.sessionID ?? null;
  }

  if (isEventSessionError(event)) {
    return event.properties.sessionID ?? null;
  }

  // Fallback: check for sessionID in properties for unknown event types
  if (
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object"
  ) {
    const props = event.properties as Record<string, unknown>;

    // Direct sessionID property
    if ("sessionID" in props && typeof props.sessionID === "string") {
      return props.sessionID;
    }

    // Nested in info
    if (
      "info" in props &&
      props.info !== null &&
      typeof props.info === "object"
    ) {
      const info = props.info as Record<string, unknown>;
      if ("sessionID" in info && typeof info.sessionID === "string") {
        return info.sessionID;
      }
    }

    // Nested in part
    if (
      "part" in props &&
      props.part !== null &&
      typeof props.part === "object"
    ) {
      const part = props.part as Record<string, unknown>;
      if ("sessionID" in part && typeof part.sessionID === "string") {
        return part.sessionID;
      }
    }
  }

  return null;
}

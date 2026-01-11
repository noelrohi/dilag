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

// Custom event types not in SDK (or with additional properties we need)
export interface EventMessageRemovedCustom {
  type: "message.removed";
  properties: {
    sessionID: string;
    messageID: string;
  };
}

export interface EventSessionUpdatedCustom {
  type: "session.updated";
  properties: {
    info: {
      id: string;
      title?: string;
      revert?: {
        messageID: string;
        partID?: string;
        snapshot?: string;
        diff?: string;
      } | null;
    };
  };
}

// Server heartbeat event
export interface EventServerHeartbeat {
  type: "server.heartbeat";
  properties: Record<string, unknown>;
}

// File watcher event
export interface EventFileWatcherUpdated {
  type: "file.watcher.updated";
  properties: {
    file: string;
    event: "add" | "change" | "unlink";
  };
}

// Project updated event
export interface EventProjectUpdated {
  type: "project.updated";
  properties: Record<string, unknown>;
}

// VCS branch updated event
export interface EventVcsBranchUpdated {
  type: "vcs.branch.updated";
  properties: {
    branch?: string;
  };
}

// Permission request event
export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: {
    messageID: string;
    callID: string;
  };
}

export interface EventPermissionAsked {
  type: "permission.asked";
  properties: PermissionRequest;
}

// Permission reply event
export interface EventPermissionReplied {
  type: "permission.replied";
  properties: {
    sessionID: string;
    requestID: string;
    reply: "once" | "always" | "reject";
  };
}

// Question types
export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: {
    messageID: string;
    callID: string;
  };
}

export interface EventQuestionAsked {
  type: "question.asked";
  properties: QuestionRequest;
}

export interface EventQuestionReplied {
  type: "question.replied";
  properties: {
    sessionID: string;
    requestID: string;
    answers: string[][];
  };
}

export interface EventQuestionRejected {
  type: "question.rejected";
  properties: {
    sessionID: string;
    requestID: string;
  };
}

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
 * Type guard for message.removed events
 */
export function isEventMessageRemoved(
  event: Event
): event is Event & EventMessageRemovedCustom {
  return (
    event.type === "message.removed" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "sessionID" in event.properties &&
    "messageID" in event.properties
  );
}

/**
 * Type guard for session.updated events
 */
export function isEventSessionUpdated(
  event: Event
): event is Event & EventSessionUpdatedCustom {
  return (
    event.type === "session.updated" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "info" in event.properties
  );
}

/**
 * Type guard for server.heartbeat events
 * Note: server.heartbeat may not be in SDK's Event type union, so we cast
 */
export function isEventServerHeartbeat(
  event: Event
): event is Event & EventServerHeartbeat {
  return (event.type as string) === "server.heartbeat";
}

/**
 * Type guard for file.watcher.updated events
 */
export function isEventFileWatcherUpdated(
  event: Event
): event is Event & EventFileWatcherUpdated {
  return (
    event.type === "file.watcher.updated" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "file" in event.properties &&
    "event" in event.properties
  );
}

/**
 * Type guard for project.updated events
 */
export function isEventProjectUpdated(
  event: Event
): event is Event & EventProjectUpdated {
  return (
    event.type === "project.updated" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object"
  );
}

/**
 * Type guard for vcs.branch.updated events
 */
export function isEventVcsBranchUpdated(
  event: Event
): event is Event & EventVcsBranchUpdated {
  return (
    event.type === "vcs.branch.updated" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object"
  );
}

/**
 * Type guard for permission.asked events
 * Note: permission.asked may not be in SDK's Event type union, so we cast
 */
export function isEventPermissionAsked(
  event: Event
): event is Event & EventPermissionAsked {
  return (
    (event.type as string) === "permission.asked" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "id" in (event.properties as Record<string, unknown>) &&
    "sessionID" in (event.properties as Record<string, unknown>) &&
    "permission" in (event.properties as Record<string, unknown>)
  );
}

/**
 * Type guard for permission.replied events
 * Note: permission.replied may not be in SDK's Event type union, so we cast
 */
export function isEventPermissionReplied(
  event: Event
): event is Event & EventPermissionReplied {
  return (
    (event.type as string) === "permission.replied" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "sessionID" in (event.properties as Record<string, unknown>) &&
    "requestID" in (event.properties as Record<string, unknown>) &&
    "reply" in (event.properties as Record<string, unknown>)
  );
}

/**
 * Type guard for question.asked events
 * Note: question.asked may not be in SDK's Event type union, so we cast
 */
export function isEventQuestionAsked(
  event: Event
): event is Event & EventQuestionAsked {
  return (
    (event.type as string) === "question.asked" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "id" in (event.properties as Record<string, unknown>) &&
    "sessionID" in (event.properties as Record<string, unknown>) &&
    "questions" in (event.properties as Record<string, unknown>)
  );
}

/**
 * Type guard for question.replied events
 * Note: question.replied may not be in SDK's Event type union, so we cast
 */
export function isEventQuestionReplied(
  event: Event
): event is Event & EventQuestionReplied {
  return (
    (event.type as string) === "question.replied" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "sessionID" in (event.properties as Record<string, unknown>) &&
    "requestID" in (event.properties as Record<string, unknown>) &&
    "answers" in (event.properties as Record<string, unknown>)
  );
}

/**
 * Type guard for question.rejected events
 * Note: question.rejected may not be in SDK's Event type union, so we cast
 */
export function isEventQuestionRejected(
  event: Event
): event is Event & EventQuestionRejected {
  return (
    (event.type as string) === "question.rejected" &&
    "properties" in event &&
    event.properties !== null &&
    typeof event.properties === "object" &&
    "sessionID" in (event.properties as Record<string, unknown>) &&
    "requestID" in (event.properties as Record<string, unknown>)
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

  if (isEventMessageRemoved(event)) {
    return event.properties.sessionID ?? null;
  }

  if (isEventSessionUpdated(event)) {
    return event.properties.info.id ?? null;
  }

  if (isEventPermissionAsked(event)) {
    return event.properties.sessionID ?? null;
  }

  if (isEventPermissionReplied(event)) {
    return event.properties.sessionID ?? null;
  }

  if (isEventQuestionAsked(event)) {
    const questionEvent = event as unknown as EventQuestionAsked;
    return questionEvent.properties.sessionID ?? null;
  }

  if (isEventQuestionReplied(event)) {
    const questionEvent = event as unknown as EventQuestionReplied;
    return questionEvent.properties.sessionID ?? null;
  }

  if (isEventQuestionRejected(event)) {
    const questionEvent = event as unknown as EventQuestionRejected;
    return questionEvent.properties.sessionID ?? null;
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

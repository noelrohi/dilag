import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "./session-store";
import type { Message, MessagePart } from "./session-store";

describe("session-store", () => {
  beforeEach(() => {
    // Reset store state before each test
    useSessionStore.setState({
      currentSessionId: null,
      screenPositions: {},
      messages: {},
      parts: {},
      sessionStatus: {},
      sessionDiffs: {},
      isServerReady: false,
      error: null,
      debugEvents: [],
    });
  });

  describe("client state management", () => {
    it("should set current session id", () => {
      useSessionStore.getState().setCurrentSessionId("session-1");
      expect(useSessionStore.getState().currentSessionId).toBe("session-1");

      useSessionStore.getState().setCurrentSessionId(null);
      expect(useSessionStore.getState().currentSessionId).toBeNull();
    });

    it("should set screen positions for a session", () => {
      const positions = [
        { id: "screen-1", x: 100, y: 200 },
        { id: "screen-2", x: 300, y: 400 },
      ];

      useSessionStore.getState().setScreenPositions("session-1", positions);

      expect(useSessionStore.getState().screenPositions["session-1"]).toEqual(positions);
    });
  });

  describe("message management", () => {
    it("should add messages in timestamp order", () => {
      const sessionId = "session-1";
      useSessionStore.getState().setMessages(sessionId, []);

      const msg1: Message = {
        id: "msg-1",
        sessionID: sessionId,
        role: "user",
        time: { created: 1000 },
      };

      const msg2: Message = {
        id: "msg-2",
        sessionID: sessionId,
        role: "assistant",
        time: { created: 2000 },
      };

      const msg3: Message = {
        id: "msg-3",
        sessionID: sessionId,
        role: "user",
        time: { created: 1500 }, // Should be inserted between msg1 and msg2
      };

      useSessionStore.getState().addMessage(sessionId, msg1);
      useSessionStore.getState().addMessage(sessionId, msg2);
      useSessionStore.getState().addMessage(sessionId, msg3);

      const messages = useSessionStore.getState().messages[sessionId];
      expect(messages).toHaveLength(3);
      expect(messages[0].id).toBe("msg-1");
      expect(messages[1].id).toBe("msg-3");
      expect(messages[2].id).toBe("msg-2");
    });

    it("should not add duplicate messages", () => {
      const sessionId = "session-1";
      useSessionStore.getState().setMessages(sessionId, []);

      const msg: Message = {
        id: "msg-1",
        sessionID: sessionId,
        role: "user",
        time: { created: 1000 },
      };

      useSessionStore.getState().addMessage(sessionId, msg);
      useSessionStore.getState().addMessage(sessionId, msg);

      expect(useSessionStore.getState().messages[sessionId]).toHaveLength(1);
    });

    it("should update a message", () => {
      const sessionId = "session-1";
      const msg: Message = {
        id: "msg-1",
        sessionID: sessionId,
        role: "user",
        time: { created: 1000 },
        isStreaming: true,
      };

      useSessionStore.getState().setMessages(sessionId, [msg]);
      useSessionStore.getState().updateMessage(sessionId, "msg-1", {
        isStreaming: false,
        time: { created: 1000, completed: 2000 },
      });

      const updated = useSessionStore.getState().messages[sessionId][0];
      expect(updated.isStreaming).toBe(false);
      expect(updated.time.completed).toBe(2000);
    });
  });

  describe("parts management", () => {
    it("should add parts to a message", () => {
      const messageId = "msg-1";
      const part: MessagePart = {
        id: "part-1",
        messageID: messageId,
        sessionID: "session-1",
        type: "text",
        text: "Hello world",
      };

      useSessionStore.getState().updatePart(messageId, part);

      const parts = useSessionStore.getState().parts[messageId];
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual(part);
    });

    it("should update existing parts", () => {
      const messageId = "msg-1";
      const part: MessagePart = {
        id: "part-1",
        messageID: messageId,
        sessionID: "session-1",
        type: "text",
        text: "Initial text",
      };

      useSessionStore.getState().updatePart(messageId, part);

      const updatedPart: MessagePart = {
        ...part,
        text: "Updated text",
      };

      useSessionStore.getState().updatePart(messageId, updatedPart);

      const parts = useSessionStore.getState().parts[messageId];
      expect(parts).toHaveLength(1);
      expect(parts[0].text).toBe("Updated text");
    });

    it("should maintain part order by id", () => {
      const messageId = "msg-1";

      const part1: MessagePart = { id: "a-part", messageID: messageId, type: "text", text: "A" };
      const part2: MessagePart = { id: "c-part", messageID: messageId, type: "text", text: "C" };
      const part3: MessagePart = { id: "b-part", messageID: messageId, type: "text", text: "B" };

      useSessionStore.getState().updatePart(messageId, part1);
      useSessionStore.getState().updatePart(messageId, part2);
      useSessionStore.getState().updatePart(messageId, part3);

      const parts = useSessionStore.getState().parts[messageId];
      expect(parts).toHaveLength(3);
      expect(parts[0].id).toBe("a-part");
      expect(parts[1].id).toBe("b-part");
      expect(parts[2].id).toBe("c-part");
    });
  });

  describe("server/UI state", () => {
    it("should set server ready state", () => {
      useSessionStore.getState().setServerReady(true);
      expect(useSessionStore.getState().isServerReady).toBe(true);

      useSessionStore.getState().setServerReady(false);
      expect(useSessionStore.getState().isServerReady).toBe(false);
    });

    it("should set error state", () => {
      useSessionStore.getState().setError("Test error");
      expect(useSessionStore.getState().error).toBe("Test error");

      useSessionStore.getState().setError(null);
      expect(useSessionStore.getState().error).toBeNull();
    });

    it("should set session status", () => {
      useSessionStore.getState().setSessionStatus("session-1", "running");
      expect(useSessionStore.getState().sessionStatus["session-1"]).toBe("running");

      useSessionStore.getState().setSessionStatus("session-1", "idle");
      expect(useSessionStore.getState().sessionStatus["session-1"]).toBe("idle");
    });
  });

  describe("clearSessionData", () => {
    it("should clear all data for a session", () => {
      const sessionId = "session-1";

      // Set up some data
      useSessionStore.getState().setCurrentSessionId(sessionId);
      useSessionStore.getState().setMessages(sessionId, [
        { id: "msg-1", sessionID: sessionId, role: "user", time: { created: 1000 } },
      ]);
      useSessionStore.getState().setSessionStatus(sessionId, "running");
      useSessionStore.getState().setSessionDiffs(sessionId, []);

      // Clear
      useSessionStore.getState().clearSessionData(sessionId);

      expect(useSessionStore.getState().currentSessionId).toBeNull();
      expect(useSessionStore.getState().messages[sessionId]).toBeUndefined();
      expect(useSessionStore.getState().sessionStatus[sessionId]).toBeUndefined();
      expect(useSessionStore.getState().sessionDiffs[sessionId]).toBeUndefined();
    });
  });

  describe("debug events", () => {
    it("should add debug events", () => {
      const event = { type: "test.event" as const, properties: {} };

      useSessionStore.getState().addDebugEvent(event as any);

      expect(useSessionStore.getState().debugEvents).toHaveLength(1);
    });

    it("should limit debug events to 500", () => {
      // Add 510 events
      for (let i = 0; i < 510; i++) {
        useSessionStore.getState().addDebugEvent({
          type: "test.event" as const,
          properties: { index: i },
        } as any);
      }

      expect(useSessionStore.getState().debugEvents.length).toBeLessThanOrEqual(500);
    });

    it("should clear debug events", () => {
      useSessionStore.getState().addDebugEvent({ type: "test.event" as const, properties: {} } as any);
      useSessionStore.getState().clearDebugEvents();

      expect(useSessionStore.getState().debugEvents).toHaveLength(0);
    });
  });

  describe("handleEvent (SSE)", () => {
    it("should handle message.updated event for new message", () => {
      const sessionId = "session-1";
      useSessionStore.getState().setMessages(sessionId, []);

      const event = {
        type: "message.updated" as const,
        properties: {
          info: {
            id: "msg-1",
            sessionID: sessionId,
            role: "user" as const,
            time: { created: 1000 },
          },
        },
      };

      useSessionStore.getState().handleEvent(event as any);

      const messages = useSessionStore.getState().messages[sessionId];
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("msg-1");
      expect(messages[0].isStreaming).toBe(true);
    });

    it("should handle message.updated event for completed message", () => {
      const sessionId = "session-1";
      const msg: Message = {
        id: "msg-1",
        sessionID: sessionId,
        role: "user",
        time: { created: 1000 },
        isStreaming: true,
      };
      useSessionStore.getState().setMessages(sessionId, [msg]);

      const event = {
        type: "message.updated" as const,
        properties: {
          info: {
            id: "msg-1",
            sessionID: sessionId,
            role: "user" as const,
            time: { created: 1000, completed: 2000 },
          },
        },
      };

      useSessionStore.getState().handleEvent(event as any);

      const updated = useSessionStore.getState().messages[sessionId][0];
      expect(updated.isStreaming).toBe(false);
    });

    it("should handle session.status event", () => {
      const event = {
        type: "session.status" as const,
        properties: {
          sessionID: "session-1",
          status: { type: "running" },
        },
      };

      useSessionStore.getState().handleEvent(event as any);

      expect(useSessionStore.getState().sessionStatus["session-1"]).toBe("running");
    });

    it("should handle message.part.updated event", () => {
      const event = {
        type: "message.part.updated" as const,
        properties: {
          part: {
            id: "part-1",
            messageID: "msg-1",
            sessionID: "session-1",
            type: "text",
            text: "Hello",
          },
        },
      };

      useSessionStore.getState().handleEvent(event as any);

      const parts = useSessionStore.getState().parts["msg-1"];
      expect(parts).toHaveLength(1);
      expect(parts[0].text).toBe("Hello");
    });
  });
});

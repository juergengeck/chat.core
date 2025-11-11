/**
 * Send Message Plan - Atomic Plan
 *
 * Platform-agnostic plan for sending messages to conversations.
 * Works through any transport (IPC, HTTP, stdio, React Native).
 *
 * Key features:
 * - Send message to topic/conversation
 * - Validate message content
 * - Store in ONE.core
 * - Post to channel for sync
 * - Pure business logic, zero platform code
 *
 * Usage:
 * ```typescript
 * const plan = new SendMessagePlan(nodeOneCore);
 * const result = await plan.sendMessage({
 *   topicId: 'topic-123',
 *   content: 'Hello, world!'
 * }, context);
 * ```
 */
import type { PlanContext } from '@refinio/api/types/context';
/**
 * Send Message Request
 */
export interface SendMessageRequest {
    /** Topic/conversation ID to send message to */
    topicId: string;
    /** Message content (text) */
    content: string;
    /** Optional attachments (future) */
    attachments?: string[];
    /** Optional reply-to message ID */
    replyTo?: string;
}
/**
 * Send Message Response
 */
export interface SendMessageResponse {
    /** Created message ID */
    messageId: string;
    /** Timestamp of message creation */
    timestamp: string;
    /** Topic ID the message was sent to */
    topicId: string;
}
/**
 * Send Message Plan
 *
 * Atomic plan for sending messages.
 */
export declare class SendMessagePlan {
    private nodeOneCore;
    constructor(nodeOneCore: any);
    /**
     * Send a message to a conversation
     */
    sendMessage(request: SendMessageRequest, context: PlanContext): Promise<SendMessageResponse>;
    /**
     * Simulate async delay (for demonstration)
     */
    private simulateDelay;
}
//# sourceMappingURL=SendMessagePlan.d.ts.map
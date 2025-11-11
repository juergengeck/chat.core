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
/**
 * Send Message Plan
 *
 * Atomic plan for sending messages.
 */
export class SendMessagePlan {
    nodeOneCore;
    constructor(nodeOneCore) {
        this.nodeOneCore = nodeOneCore;
    }
    /**
     * Send a message to a conversation
     */
    async sendMessage(request, context) {
        // Validate request
        if (!request.topicId || !request.topicId.trim()) {
            throw new Error('Topic ID is required');
        }
        if (!request.content || !request.content.trim()) {
            throw new Error('Message content is required');
        }
        // In real implementation, this would:
        // 1. Create message object with ONE.core
        // 2. Store as versioned object
        // 3. Post to channel for P2P sync
        // 4. Emit to local subscribers
        // Mock implementation for demonstration
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();
        // Simulate async operation
        await this.simulateDelay(50);
        // In real code:
        // const message = {
        //   $type$: 'Message',
        //   id: messageId,
        //   topicId: request.topicId,
        //   content: request.content,
        //   sender: context.userId,
        //   timestamp,
        //   replyTo: request.replyTo
        // };
        //
        // const result = await storeVersionedObject(message);
        // await channelManager.postToChannel(request.topicId, message);
        return {
            messageId,
            timestamp,
            topicId: request.topicId
        };
    }
    /**
     * Simulate async delay (for demonstration)
     */
    async simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=SendMessagePlan.js.map
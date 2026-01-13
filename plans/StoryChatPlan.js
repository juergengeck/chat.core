/**
 * StoryChatPlan - Chat operations using Story + Cube architecture
 *
 * This plan creates chat messages wrapped with StoryFactory for:
 * - Full provenance tracking (who, when, what)
 * - Cube indexing for efficient queries
 * - Edit/delete history via Story versioning
 *
 * @see docs/designs/STORY-CUBE-CHAT-ARCHITECTURE.md
 */
/**
 * Chat Plan definition for StoryFactory registration
 */
export const CHAT_PLAN = {
    id: 'ChatPlan',
    name: 'Chat Plan',
    description: 'Creates and manages chat messages using Story + Cube architecture',
    domain: 'chat',
    supplyPatterns: [
        { type: 'ChatMessage', description: 'Chat messages' }
    ]
};
// ============================================================================
// StoryChatPlan Implementation
// ============================================================================
/**
 * StoryChatPlan - Chat operations with Story tracking
 *
 * Usage:
 * ```typescript
 * const chatPlan = new StoryChatPlan(storyFactory, deps, ownerIdHash, '1.0.0');
 * await chatPlan.init();
 *
 * const result = await chatPlan.createMessage({
 *     topicIdHash,
 *     content: 'Hello world!'
 * });
 * ```
 */
export class StoryChatPlan {
    storyFactory;
    deps;
    owner;
    instanceVersion;
    planIdHash;
    constructor(storyFactory, deps, owner, instanceVersion = '1.0.0') {
        this.storyFactory = storyFactory;
        this.deps = deps;
        this.owner = owner;
        this.instanceVersion = instanceVersion;
    }
    /**
     * Initialize the plan - must be called before other methods
     */
    async init() {
        this.planIdHash = await this.storyFactory.registerPlan(CHAT_PLAN);
    }
    /**
     * Generate a UUID for message identity
     */
    generateId() {
        return crypto.randomUUID();
    }
    /**
     * Ensure plan is initialized
     */
    ensureInitialized() {
        if (!this.planIdHash) {
            throw new Error('StoryChatPlan not initialized. Call init() first.');
        }
    }
    // ========================================================================
    // Create Message
    // ========================================================================
    /**
     * Create a new chat message
     *
     * Creates a ChatMessage and wraps with StoryFactory for provenance tracking.
     * The Story captures who created the message and when.
     */
    async createMessage(request) {
        this.ensureInitialized();
        const result = await this.storyFactory.wrapExecution({
            title: `Message in ${String(request.topicIdHash).substring(0, 8)}`,
            planId: this.planIdHash,
            planTypeName: 'ChatPlan',
            owner: this.owner,
            instanceVersion: this.instanceVersion
        }, async () => {
            const message = {
                $type$: 'ChatMessage',
                id: this.generateId(),
                topic: request.topicIdHash,
                content: request.content,
                replyTo: request.replyTo,
                attachments: request.attachments
            };
            const stored = await this.deps.storeVersionedObject(message);
            return {
                result: {
                    messageHash: stored.hash,
                    messageIdHash: stored.idHash
                },
                productHash: stored.hash
            };
        });
        return {
            messageHash: result.result.messageHash,
            messageIdHash: result.result.messageIdHash,
            storyIdHash: result.storyId
        };
    }
    // ========================================================================
    // Create Reaction
    // ========================================================================
    /**
     * Create a reaction to a message
     *
     * Reactions are ChatMessages with:
     * - reaction field set (emoji)
     * - replyTo pointing to target message
     * - no content
     */
    async createReaction(request) {
        this.ensureInitialized();
        const result = await this.storyFactory.wrapExecution({
            title: `Reaction ${request.reaction}`,
            planId: this.planIdHash,
            planTypeName: 'ChatPlan',
            owner: this.owner,
            instanceVersion: this.instanceVersion
        }, async () => {
            // Get topic from target message
            const targetMessage = await this.deps.getObject(request.targetMessageHash);
            const reaction = {
                $type$: 'ChatMessage',
                id: this.generateId(),
                topic: targetMessage.topic,
                replyTo: request.targetMessageHash,
                reaction: request.reaction
                // No content for reactions
            };
            const stored = await this.deps.storeVersionedObject(reaction);
            return {
                result: {
                    reactionHash: stored.hash,
                    reactionIdHash: stored.idHash
                },
                productHash: stored.hash
            };
        });
        return {
            reactionHash: result.result.reactionHash,
            reactionIdHash: result.result.reactionIdHash,
            storyIdHash: result.storyId
        };
    }
    // ========================================================================
    // Edit Message
    // ========================================================================
    /**
     * Edit an existing message
     *
     * Creates a new version of the message with updated content.
     * The Story chain tracks edit history.
     */
    async editMessage(request) {
        this.ensureInitialized();
        const result = await this.storyFactory.wrapExecution({
            title: 'Edit message',
            planId: this.planIdHash,
            planTypeName: 'ChatPlan',
            owner: this.owner,
            instanceVersion: this.instanceVersion
        }, async () => {
            // Load current message
            const current = await this.deps.getObjectByIdHash(request.messageIdHash);
            // Verify ownership - check original Story
            // For now, we trust the caller. In production, check Story.owner
            // TODO: Add ownership verification via Story lookup
            // Create new version with updated content
            const updated = {
                ...current.obj,
                content: request.newContent
            };
            const stored = await this.deps.storeVersionedObject(updated);
            return {
                result: { messageHash: stored.hash },
                productHash: stored.hash
            };
        });
        return {
            messageHash: result.result.messageHash,
            storyIdHash: result.storyId
        };
    }
    // ========================================================================
    // Delete Message
    // ========================================================================
    /**
     * Delete a message (soft delete via tombstone)
     *
     * Creates a new version with deleted=true and content cleared.
     * Original content preserved in earlier Story versions.
     */
    async deleteMessage(request) {
        this.ensureInitialized();
        const result = await this.storyFactory.wrapExecution({
            title: 'Delete message',
            planId: this.planIdHash,
            planTypeName: 'ChatPlan',
            owner: this.owner,
            instanceVersion: this.instanceVersion
        }, async () => {
            // Load current message
            const current = await this.deps.getObjectByIdHash(request.messageIdHash);
            // Verify ownership
            // TODO: Add ownership verification via Story lookup
            // Create tombstone version
            const tombstone = {
                $type$: 'ChatMessage',
                id: current.obj.id,
                topic: current.obj.topic,
                replyTo: current.obj.replyTo,
                reaction: current.obj.reaction,
                // Content cleared
                content: undefined,
                attachments: undefined,
                // Deletion marker
                deleted: true,
                deletedReason: request.reason
            };
            const stored = await this.deps.storeVersionedObject(tombstone);
            return {
                result: { messageHash: stored.hash },
                productHash: stored.hash
            };
        });
        return {
            messageHash: result.result.messageHash,
            storyIdHash: result.storyId
        };
    }
    // ========================================================================
    // Remove Reaction
    // ========================================================================
    /**
     * Remove a reaction
     *
     * Creates a new version with reaction cleared.
     */
    async removeReaction(request) {
        this.ensureInitialized();
        const result = await this.storyFactory.wrapExecution({
            title: 'Remove reaction',
            planId: this.planIdHash,
            planTypeName: 'ChatPlan',
            owner: this.owner,
            instanceVersion: this.instanceVersion
        }, async () => {
            // Load current reaction
            const current = await this.deps.getObjectByIdHash(request.reactionIdHash);
            // Verify this is a reaction
            if (!current.obj.reaction) {
                throw new Error('Message is not a reaction');
            }
            // Create version with reaction cleared
            const updated = {
                ...current.obj,
                reaction: undefined
            };
            const stored = await this.deps.storeVersionedObject(updated);
            return {
                result: { messageHash: stored.hash },
                productHash: stored.hash
            };
        });
        return {
            messageHash: result.result.messageHash,
            storyIdHash: result.storyId
        };
    }
}
//# sourceMappingURL=StoryChatPlan.js.map
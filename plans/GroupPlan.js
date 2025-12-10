/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation group operations.
 * Delegates to TopicGroupManager for low-level Group creation.
 */
/**
 * GroupPlan - Pure business logic for conversation group operations
 *
 * Dependencies injected via constructor:
 * - topicGroupManager: Low-level Group/Topic operations
 * - nodeOneCore: ONE.core instance for owner/instanceVersion
 */
export class GroupPlan {
    static get planId() { return 'group'; }
    static get planName() { return 'Group'; }
    static get description() { return 'Manages conversation groups'; }
    static get version() { return '1.0.0'; }
    topicGroupManager;
    nodeOneCore;
    constructor(topicGroupManager, nodeOneCore) {
        this.topicGroupManager = topicGroupManager;
        this.nodeOneCore = nodeOneCore;
    }
    /**
     * Create a conversation group for a topic
     */
    async createGroup(request) {
        console.log(`[GroupPlan] Creating group for topic ${request.topicId} with ${request.participants.length} participants`);
        try {
            await this.topicGroupManager.createGroupTopic(request.topicName, request.topicId, request.participants, request.autoAddChumConnections || false);
            const groupIdHash = this.topicGroupManager.getCachedGroupForTopic(request.topicId);
            if (!groupIdHash) {
                throw new Error(`Group creation failed - no groupIdHash in cache for topic ${request.topicId}`);
            }
            console.log(`[GroupPlan] Created group ${String(groupIdHash).substring(0, 8)} for topic ${request.topicId}`);
            return {
                success: true,
                groupIdHash
            };
        }
        catch (error) {
            console.error('[GroupPlan] Error creating group:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get group for a topic
     */
    async getGroupForTopic(request) {
        try {
            const groupIdHash = await this.topicGroupManager.getGroupForTopic(request.topicId);
            if (!groupIdHash) {
                return {
                    success: false,
                    error: `No group found for topic ${request.topicId}`
                };
            }
            const participants = await this.topicGroupManager.getTopicParticipants(request.topicId);
            return {
                success: true,
                groupIdHash,
                participants
            };
        }
        catch (error) {
            console.error('[GroupPlan] Error getting group for topic:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get participants for a topic
     */
    async getTopicParticipants(request) {
        try {
            const participants = await this.topicGroupManager.getTopicParticipants(request.topicId);
            return {
                success: true,
                participants
            };
        }
        catch (error) {
            console.error('[GroupPlan] Error getting topic participants:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
//# sourceMappingURL=GroupPlan.js.map
/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation topic operations.
 * Delegates to TopicGroupManager which uses Topic as the parent object.
 *
 * Architecture:
 *   Topic → channel (ChannelInfo) → participants (HashGroup)
 *        → channelCertificate (AffirmationCertificate)
 *
 * CHUM follows all references automatically when Topic is shared.
 */
/**
 * GroupPlan - Pure business logic for conversation topic operations
 *
 * Dependencies injected via constructor:
 * - topicGroupManager: Topic/ChannelInfo operations
 */
export class GroupPlan {
    static get planId() { return 'group'; }
    static get planName() { return 'Group'; }
    static get description() { return 'Manages conversation topics via Topic/ChannelInfo sharing'; }
    static get version() { return '3.0.0'; }
    topicGroupManager;
    constructor(topicGroupManager) {
        this.topicGroupManager = topicGroupManager;
    }
    /**
     * Create a conversation topic with participants
     */
    async createTopic(request) {
        console.log(`[GroupPlan] Creating topic ${request.topicId} with ${request.participants.length} participants`);
        try {
            const result = await this.topicGroupManager.createGroupTopic(request.topicName, request.topicId, request.participants);
            console.log(`[GroupPlan] ✅ Created topic ${String(result.topicIdHash).substring(0, 8)}`);
            return {
                success: true,
                topicIdHash: result.topicIdHash,
                channelInfoIdHash: result.channelInfoIdHash,
                participantsHash: result.participantsHash
            };
        }
        catch (error) {
            console.error('[GroupPlan] Error creating topic:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get topic info for a conversation
     */
    async getTopic(request) {
        try {
            const topicIdHash = this.topicGroupManager.getCachedTopicForConversation(request.topicId);
            if (!topicIdHash) {
                return {
                    success: false,
                    error: `No topic found for topicId ${request.topicId}`
                };
            }
            const participants = await this.topicGroupManager.getTopicParticipants(request.topicId);
            return {
                success: true,
                topicIdHash,
                participants
            };
        }
        catch (error) {
            console.error('[GroupPlan] Error getting topic:', error);
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
    /**
     * Add participants to an existing topic
     */
    async addParticipants(request) {
        console.log(`[GroupPlan] Adding ${request.participants.length} participants to topic ${request.topicId}`);
        try {
            await this.topicGroupManager.addParticipantsToTopic(request.topicId, request.participants);
            return { success: true };
        }
        catch (error) {
            console.error('[GroupPlan] Error adding participants:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
//# sourceMappingURL=GroupPlan.js.map
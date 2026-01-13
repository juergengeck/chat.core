/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation topic operations.
 * Uses TopicModel for topic creation and access control.
 *
 * Architecture:
 *   Topic → channel (ChannelInfo) → participants (HashGroup)
 *        → group (Group, for group conversations)
 *
 * CHUM follows all references automatically when Topic is shared.
 */
/**
 * GroupPlan - Pure business logic for conversation topic operations
 *
 * Dependencies injected via constructor:
 * - topicModel: TopicModel for topic creation and queries
 * - storageDeps: Storage functions for object access
 */
export class GroupPlan {
    static get planId() { return 'group'; }
    static get planName() { return 'Group'; }
    static get description() { return 'Manages conversation topics via TopicModel'; }
    static get version() { return '4.0.0'; }
    topicModel;
    storageDeps;
    ownerId;
    // Cache: topicId -> topicIdHash (for quick lookups)
    topicCache;
    constructor(topicModel, storageDeps, ownerId) {
        this.topicModel = topicModel;
        this.storageDeps = storageDeps;
        this.ownerId = ownerId;
        this.topicCache = new Map();
    }
    /**
     * Create a conversation topic with participants
     *
     * Creates HashGroup -> Group -> Topic with proper structure.
     * TopicModel.createGroupTopic expects a Group ID hash.
     */
    async createTopic(request) {
        console.log(`[GroupPlan] ========== CREATE TOPIC START ==========`);
        console.log(`[GroupPlan] topicId: ${request.topicId}`);
        console.log(`[GroupPlan] topicName: ${request.topicName}`);
        console.log(`[GroupPlan] this.ownerId: ${String(this.ownerId)}`);
        console.log(`[GroupPlan] this.ownerId type: ${typeof this.ownerId}`);
        console.log(`[GroupPlan] request.participants count: ${request.participants.length}`);
        console.log(`[GroupPlan] request.participants:`, request.participants.map(p => String(p).substring(0, 16)));
        try {
            // Ensure owner is included in participants
            const allParticipants = [...request.participants];
            const ownerAlreadyIncluded = allParticipants.some(p => String(p) === String(this.ownerId));
            console.log(`[GroupPlan] Owner already in participants? ${ownerAlreadyIncluded}`);
            if (!ownerAlreadyIncluded) {
                allParticipants.unshift(this.ownerId);
                console.log(`[GroupPlan] Added owner to participants`);
            }
            console.log(`[GroupPlan] Final allParticipants count: ${allParticipants.length}`);
            console.log(`[GroupPlan] Final allParticipants:`, allParticipants.map(p => String(p).substring(0, 16)));
            // Step 1: Create HashGroup with participants
            const hashGroupObj = {
                $type$: 'HashGroup',
                person: new Set(allParticipants)
            };
            console.log(`[GroupPlan] HashGroup person Set size: ${hashGroupObj.person.size}`);
            console.log(`[GroupPlan] HashGroup members:`, Array.from(hashGroupObj.person).map(p => String(p).substring(0, 16)));
            const hashGroupResult = await this.storageDeps.storeUnversionedObject(hashGroupObj);
            const hashGroupHash = hashGroupResult.hash;
            console.log(`[GroupPlan] Created HashGroup: ${String(hashGroupHash).substring(0, 8)}`);
            // Step 2: Create Group referencing HashGroup
            const groupObj = {
                $type$: 'Group',
                name: request.topicName || `group-${request.topicId}`,
                hashGroup: hashGroupHash
            };
            const groupResult = await this.storageDeps.storeVersionedObject(groupObj);
            const groupIdHash = groupResult.idHash;
            console.log(`[GroupPlan] Created Group: ${String(groupIdHash).substring(0, 8)}`);
            // Step 3: Create topic via TopicModel with Group ID hash
            // Channel identity is based on participants only (no owner), ensuring
            // consistent idHash across all participants.
            const topic = await this.topicModel.createGroupTopic(request.topicName, groupIdHash, request.topicId);
            const topicIdHash = await this.storageDeps.calculateIdHashOfObj(topic);
            // Get ChannelInfo to extract participantsHash
            const channelInfoResult = await this.storageDeps.getObjectByIdHash(topic.channel);
            const channelInfo = channelInfoResult.obj;
            // Cache the topic
            this.topicCache.set(request.topicId, topicIdHash);
            console.log(`[GroupPlan] Created topic ${String(topicIdHash).substring(0, 8)}`);
            return {
                success: true,
                topicIdHash,
                channelInfoIdHash: topic.channel,
                participantsHash: channelInfo.participants
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
            // Try cache first
            let topicIdHash = this.topicCache.get(request.topicId);
            // If not in cache, try to find via TopicModel
            // topicId is expected to be the idHash string
            if (!topicIdHash) {
                const topic = await this.topicModel.findTopic(request.topicId);
                if (!topic) {
                    return {
                        success: false,
                        error: `No topic found for topicId ${request.topicId}`
                    };
                }
                topicIdHash = await this.storageDeps.calculateIdHashOfObj(topic);
                this.topicCache.set(request.topicId, topicIdHash);
            }
            const participants = await this.getParticipantsForTopic(request.topicId);
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
     * Get participants for a topic from its ChannelInfo
     * @param topicId - The Topic's computed idHash (as string)
     */
    async getParticipantsForTopic(topicId) {
        const topic = await this.topicModel.findTopic(topicId);
        if (!topic) {
            throw new Error(`Topic ${topicId} not found`);
        }
        // Get ChannelInfo
        const channelInfoResult = await this.storageDeps.getObjectByIdHash(topic.channel);
        const channelInfo = channelInfoResult.obj;
        // Get HashGroup
        const hashGroup = await this.storageDeps.getObject(channelInfo.participants);
        const personSet = hashGroup.person || new Set();
        return Array.from(personSet);
    }
    /**
     * Get participants for a topic
     */
    async getTopicParticipants(request) {
        try {
            const participants = await this.getParticipantsForTopic(request.topicId);
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
     * @param request.topicId - The Topic's computed idHash (as string)
     */
    async addParticipants(request) {
        console.log(`[GroupPlan] Adding ${request.participants.length} participants to topic ${request.topicId}`);
        try {
            const topic = await this.topicModel.findTopic(request.topicId);
            if (!topic) {
                throw new Error(`Topic ${request.topicId} not found`);
            }
            // Use TopicModel to add participants
            await this.topicModel.addPersonsToTopic(request.participants, topic);
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
    /**
     * Get cached topic ID hash
     */
    getCachedTopicForConversation(topicId) {
        return this.topicCache.get(topicId);
    }
}
//# sourceMappingURL=GroupPlan.js.map
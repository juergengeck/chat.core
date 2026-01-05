/**
 * Topic Group Manager (Platform-Agnostic)
 *
 * Simplified manager that uses Topic as the parent object for sharing.
 * CHUM follows all references from Topic automatically:
 *   Topic → channel (ChannelInfo) → participants (HashGroup)
 *        → channelCertificate (AffirmationCertificate) → License, Signature
 *
 * No manual sharing logic needed - share Topic, CHUM syncs the tree.
 */
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
export class TopicGroupManager {
    oneCore;
    storageDeps;
    trustPlan;
    // Cache: topicId -> topicIdHash (for quick lookups)
    topicCache;
    constructor(oneCore, storageDeps, trustPlan) {
        this.oneCore = oneCore;
        this.storageDeps = storageDeps;
        this.trustPlan = trustPlan;
        this.topicCache = new Map();
    }
    /**
     * Create a group topic and share it with participants.
     *
     * Architecture:
     * 1. TopicModel creates Topic → ChannelInfo → HashGroup
     * 2. We create AffirmationCertificate for the ChannelInfo
     * 3. Update Topic with channelCertificate reference
     * 4. Share Topic to all participants
     * 5. CHUM follows all references and syncs the complete tree
     *
     * @param topicName - Display name for the topic
     * @param topicId - Unique ID for the topic
     * @param participants - Person IDs to include
     */
    async createGroupTopic(topicName, topicId, participants = []) {
        console.log(`[TopicGroupManager] Creating topic: "${topicName}" (${topicId})`);
        // P2P conversations use createOneToOneTopic directly
        if (topicId.includes('<->')) {
            throw new Error(`P2P conversation ${topicId} should use TopicModel.createOneToOneTopic`);
        }
        if (!this.oneCore.ownerId) {
            throw new Error('Cannot create topic without owner ID');
        }
        // Ensure owner is included
        const allParticipants = [...participants];
        if (!allParticipants.includes(this.oneCore.ownerId)) {
            allParticipants.unshift(this.oneCore.ownerId);
        }
        console.log(`[TopicGroupManager] Participants: ${allParticipants.map(p => String(p).substring(0, 8)).join(', ')}`);
        // Step 1: Create Topic via TopicModel (creates ChannelInfo + HashGroup)
        const topic = await this.oneCore.topicModel.createGroupTopic(topicName, allParticipants, topicId, this.oneCore.ownerId);
        const topicIdHash = await this.storageDeps.calculateIdHashOfObj(topic);
        console.log(`[TopicGroupManager] Created topic ${String(topicIdHash).substring(0, 8)}`);
        // Step 2: Get the ChannelInfo to create certificate for it
        const channelInfoResult = await this.storageDeps.getObjectByIdHash(topic.channel);
        const channelInfo = channelInfoResult.obj;
        // Step 3: Create AffirmationCertificate for the ChannelInfo
        // This proves we (the owner) created this channel configuration
        // Cast idHash to SHA256Hash - they're both strings, types are compile-time only
        const certResult = await this.oneCore.leuteModel.trust.certify('AffirmationCertificate', { data: topic.channel }, this.oneCore.ownerId);
        console.log(`[TopicGroupManager] Created certificate ${String(certResult.certificate.hash).substring(0, 8)}`);
        // Step 4: Update Topic with channelCertificate
        const updatedTopic = {
            ...topic,
            channelCertificate: certResult.certificate.hash
        };
        const savedTopic = await this.storageDeps.storeVersionedObject(updatedTopic);
        console.log(`[TopicGroupManager] Updated topic with channelCertificate`);
        // Step 5: Share Topic to all participants
        // CHUM will follow references and sync: Topic → ChannelInfo → HashGroup → Certificate chain
        console.log(`[TopicGroupManager] Creating IdAccess for Topic ${String(savedTopic.idHash).substring(0, 8)} with persons:`, allParticipants.map(p => String(p).substring(0, 8)));
        console.log(`[TopicGroupManager] Creating IdAccess for ChannelInfo ${String(topic.channel).substring(0, 8)} with persons:`, allParticipants.map(p => String(p).substring(0, 8)));
        await this.storageDeps.createAccess([
            {
                id: savedTopic.idHash, // Topic (versioned)
                person: allParticipants,
                group: [],
                mode: SET_ACCESS_MODE.ADD
            },
            {
                id: topic.channel, // ChannelInfo (versioned)
                person: allParticipants,
                group: [],
                mode: SET_ACCESS_MODE.ADD
            }
        ]);
        console.log(`[TopicGroupManager] IdAccess created. Shared topic to ${allParticipants.length} participants`);
        // Cache the topic
        this.topicCache.set(topicId, savedTopic.idHash);
        return {
            topic: savedTopic.obj,
            topicIdHash: savedTopic.idHash,
            channelInfoIdHash: topic.channel,
            participantsHash: channelInfo.participants
        };
    }
    /**
     * Get cached topic for a conversation
     */
    getCachedTopicForConversation(topicId) {
        return this.topicCache.get(topicId);
    }
    /**
     * Check if a conversation has a topic
     */
    hasConversationTopic(conversationId) {
        return this.topicCache.has(conversationId);
    }
    /**
     * Get participants for a topic from its ChannelInfo
     */
    async getTopicParticipants(topicId) {
        console.log(`[TopicGroupManager] Getting participants for topic: ${topicId}`);
        // Find the topic
        const topic = await this.oneCore.topicModel.findTopic(topicId);
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
     * Add participants to an existing topic
     */
    async addParticipantsToTopic(topicId, newParticipants) {
        console.log(`[TopicGroupManager] Adding ${newParticipants.length} participants to topic: ${topicId}`);
        const topic = await this.oneCore.topicModel.findTopic(topicId);
        if (!topic) {
            throw new Error(`Topic ${topicId} not found`);
        }
        // Get current participants
        const currentParticipants = await this.getTopicParticipants(topicId);
        const toAdd = newParticipants.filter(p => !currentParticipants.includes(p));
        if (toAdd.length === 0) {
            console.log(`[TopicGroupManager] All participants already in topic`);
            return;
        }
        // Create new HashGroup with all participants
        const allParticipants = [...currentParticipants, ...toAdd];
        const newHashGroup = {
            $type$: 'HashGroup',
            person: new Set(allParticipants)
        };
        const storedHashGroup = await this.storageDeps.storeUnversionedObject(newHashGroup);
        // Create new ChannelInfo with updated participants
        const channelInfoResult = await this.storageDeps.getObjectByIdHash(topic.channel);
        const channelInfo = channelInfoResult.obj;
        const updatedChannelInfo = {
            ...channelInfo,
            participants: storedHashGroup.hash
        };
        const savedChannelInfo = await this.storageDeps.storeVersionedObject(updatedChannelInfo);
        // Create new certificate for the updated ChannelInfo
        // Cast idHash to SHA256Hash - they're both strings, types are compile-time only
        const certResult = await this.oneCore.leuteModel.trust.certify('AffirmationCertificate', { data: savedChannelInfo.idHash }, this.oneCore.ownerId);
        // Update Topic with new channel and certificate
        const updatedTopic = {
            ...topic,
            channel: savedChannelInfo.idHash,
            channelCertificate: certResult.certificate.hash
        };
        const savedTopic = await this.storageDeps.storeVersionedObject(updatedTopic);
        // Share updated Topic to all participants (including new ones)
        await this.storageDeps.createAccess([
            {
                id: savedTopic.idHash,
                person: allParticipants,
                group: [],
                mode: SET_ACCESS_MODE.ADD
            },
            {
                id: savedChannelInfo.idHash,
                person: allParticipants,
                group: [],
                mode: SET_ACCESS_MODE.ADD
            }
        ]);
        // Update cache
        this.topicCache.set(topicId, savedTopic.idHash);
        console.log(`[TopicGroupManager] Added ${toAdd.length} participants, total: ${allParticipants.length}`);
    }
    /**
     * Create a P2P topic (delegates to TopicModel)
     */
    async createP2PTopic(topicName, topicId, participants) {
        console.log(`[TopicGroupManager] Creating P2P topic: ${topicId}`);
        if (participants.length !== 2) {
            throw new Error(`P2P topic requires exactly 2 participants`);
        }
        const topic = await this.oneCore.topicModel.createOneToOneTopic(participants[0], participants[1]);
        const topicIdHash = await this.storageDeps.calculateIdHashOfObj(topic);
        this.topicCache.set(topicId, topicIdHash);
        return topic;
    }
    /**
     * Ensure P2P channels exist for a peer
     */
    async ensureP2PChannelsForPeer(peerPersonId) {
        const sortedIds = [this.oneCore.ownerId, peerPersonId].sort();
        const p2pTopicId = `${sortedIds[0]}<->${sortedIds[1]}`;
        console.log(`[TopicGroupManager] Ensuring P2P topic: ${p2pTopicId}`);
        let topic = await this.oneCore.topicModel.findTopic(p2pTopicId);
        if (!topic) {
            topic = await this.oneCore.topicModel.createOneToOneTopic(this.oneCore.ownerId, peerPersonId);
            console.log(`[TopicGroupManager] Created P2P topic`);
        }
        // Share topic to peer
        await this.oneCore.topicModel.addPersonsToTopic([peerPersonId], topic);
        console.log(`[TopicGroupManager] Ensured P2P topic shared with peer`);
    }
    /**
     * Handle a received Topic (when synced via CHUM)
     * Validates the channelCertificate before accepting
     */
    async handleReceivedTopic(topicIdHash, topic) {
        console.log(`[TopicGroupManager] Processing received topic: ${topic.id}`);
        // Validate channelCertificate if present
        if (topic.channelCertificate) {
            try {
                // Get the certificate and verify it
                const cert = await this.storageDeps.getObject(topic.channelCertificate);
                // Check if affirmed by a trusted person (pass the certificate hash)
                const affirmedBy = await this.oneCore.leuteModel.trust.affirmedBy(topic.channelCertificate);
                const myId = await this.oneCore.leuteModel.myMainIdentity();
                const knownPeople = await this.oneCore.leuteModel.others();
                // Extract person IDs from SomeoneModel objects
                const knownPersonIds = await Promise.all(knownPeople.map(someone => someone.mainIdentity()));
                const trustedPeople = [myId, ...knownPersonIds];
                const isTrusted = affirmedBy.some(id => trustedPeople.includes(id));
                if (!isTrusted) {
                    console.log(`[TopicGroupManager] Rejected topic - certificate not from trusted person`);
                    return false;
                }
                console.log(`[TopicGroupManager] Topic certificate validated`);
            }
            catch (error) {
                console.warn(`[TopicGroupManager] Could not validate certificate:`, error.message);
                // Continue anyway - certificate validation is optional for now
            }
        }
        // Cache the topic
        this.topicCache.set(topic.id, topicIdHash);
        // Establish implied trust for participants (if paranoia level 0)
        if (this.oneCore.paranoiaLevel === 0 && this.trustPlan) {
            const participants = await this.getTopicParticipants(topic.id);
            for (const personId of participants) {
                if (String(personId) !== String(this.oneCore.ownerId)) {
                    try {
                        await this.trustPlan.setTrustLevel({
                            personId,
                            trustLevel: 'medium',
                            reason: `Topic participant: ${topic.id}`
                        });
                    }
                    catch (e) {
                        // Trust may already exist
                    }
                }
            }
        }
        return true;
    }
    /**
     * Initialize Group sync listener (LEGACY)
     * @deprecated Groups are no longer used - Topics are the parent objects now
     */
    initializeGroupSyncListener() {
        console.log(`[TopicGroupManager] initializeGroupSyncListener() - legacy stub (Groups deprecated, use Topics)`);
        // No-op: Groups are deprecated, Topic sync listener handles everything
    }
    /**
     * Initialize Topic sync listener
     */
    initializeTopicSyncListener() {
        console.log(`[TopicGroupManager] Initializing topic sync listener`);
        import('@refinio/one.core/lib/storage-versioned-objects.js').then(({ onVersionedObj }) => {
            onVersionedObj.addListener(async (result) => {
                if (result.obj.$type$ === 'Topic') {
                    await this.handleReceivedTopic(result.idHash, result.obj);
                }
            });
            console.log(`[TopicGroupManager] Topic sync listener initialized`);
        }).catch(error => {
            console.error(`[TopicGroupManager] Failed to initialize listener:`, error);
        });
    }
    // ========== CHUM Filter Methods ==========
    /**
     * Check if an Access/IdAccess hash is allowed to be sent outbound via CHUM
     *
     * With the simplified architecture, all Access/IdAccess from our instance
     * are allowed since they're created by us for legitimate sharing.
     *
     * @param hash - The Access or IdAccess hash to check
     */
    isAllowedOutbound(_hash) {
        // Allow all outbound Access/IdAccess - they're created by us for sharing
        return true;
    }
    /**
     * Check if an Access/IdAccess hash is allowed to be accepted inbound via CHUM
     *
     * With the simplified architecture, all Access/IdAccess from paired peers
     * are allowed since pairing establishes trust.
     *
     * @param hash - The Access or IdAccess hash to check
     */
    isAllowedInbound(_hash) {
        // Allow all inbound Access/IdAccess from paired peers
        return true;
    }
    // ========== Deprecated methods for backwards compatibility ==========
    /** @deprecated Use getCachedTopicForConversation instead */
    getCachedGroupForTopic(topicId) {
        return this.topicCache.get(topicId);
    }
    /** @deprecated Groups are no longer used - participants come from ChannelInfo */
    hasConversationGroup(conversationId) {
        return this.topicCache.has(conversationId);
    }
    /** @deprecated Use createGroupTopic instead */
    async getOrCreateConversationGroup(topicId) {
        const result = await this.createGroupTopic(topicId, topicId, []);
        return result.topicIdHash;
    }
    /** @deprecated Not needed - CHUM handles sync */
    async syncReceivedGroups() {
        console.log(`[TopicGroupManager] syncReceivedGroups() is deprecated`);
    }
}
export default TopicGroupManager;
//# sourceMappingURL=TopicGroupManager.js.map
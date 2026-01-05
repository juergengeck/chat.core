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
import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { OneVersionedObjectTypes, OneUnversionedObjectTypes, Person, HashGroup } from '@refinio/one.core/lib/recipes.js';
import type { VersionedObjectResult } from '@refinio/one.core/lib/storage-versioned-objects.js';
import type { UnversionedObjectResult } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import type { SetAccessParam } from '@refinio/one.core/lib/access.js';
import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import type ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js';
import type { Topic } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import type { ChannelInfo } from '@refinio/one.models/lib/recipes/ChannelRecipes.js';
/**
 * Storage functions for TopicGroupManager (to avoid module duplication in Vite worker)
 */
export interface TopicGroupManagerStorageDeps {
    storeVersionedObject: <T extends OneVersionedObjectTypes>(obj: T) => Promise<VersionedObjectResult<T>>;
    storeUnversionedObject: <T extends OneUnversionedObjectTypes>(obj: T) => Promise<UnversionedObjectResult<T>>;
    getObjectByIdHash: <T extends OneVersionedObjectTypes>(idHash: SHA256IdHash<T>) => Promise<VersionedObjectResult<T>>;
    getObject: <T extends OneUnversionedObjectTypes>(hash: SHA256Hash<T>) => Promise<T>;
    createAccess: (accessRequests: SetAccessParam[]) => Promise<void>;
    calculateIdHashOfObj: <T extends OneVersionedObjectTypes>(obj: T) => Promise<SHA256IdHash<T>>;
    calculateHashOfObj: <T extends OneUnversionedObjectTypes>(obj: T) => Promise<SHA256Hash<T>>;
}
/** Trust plan interface for setting trust levels */
export interface TrustPlan {
    setTrustLevel(request: {
        personId: SHA256IdHash<Person>;
        trustLevel: string;
        reason?: string;
    }): Promise<void>;
}
/** AI Assistant model interface */
export interface AIAssistantModel {
    getAIPersonForTopic(topicId: string): SHA256IdHash<Person> | undefined;
    getModelIdForPersonId(personId: SHA256IdHash<Person>): string | undefined;
}
/**
 * Minimal interface for ONE.core instance
 */
export interface OneCoreInstance {
    ownerId: SHA256IdHash<Person>;
    channelManager: ChannelManager;
    topicModel: TopicModel;
    leuteModel: LeuteModel;
    connectionsModel?: ConnectionsModel;
    aiAssistantModel?: AIAssistantModel;
    paranoiaLevel?: 0 | 1;
}
/**
 * Result from creating a topic
 */
export interface CreateTopicResult {
    topic: Topic;
    topicIdHash: SHA256IdHash<Topic>;
    channelInfoIdHash: SHA256IdHash<ChannelInfo>;
    participantsHash: SHA256Hash<HashGroup>;
}
export declare class TopicGroupManager {
    private oneCore;
    private storageDeps;
    private trustPlan?;
    private topicCache;
    constructor(oneCore: OneCoreInstance, storageDeps: TopicGroupManagerStorageDeps, trustPlan?: TrustPlan);
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
    createGroupTopic(topicName: string, topicId: string, participants?: SHA256IdHash<Person>[]): Promise<CreateTopicResult>;
    /**
     * Get cached topic for a conversation
     */
    getCachedTopicForConversation(topicId: string): SHA256IdHash<Topic> | undefined;
    /**
     * Check if a conversation has a topic
     */
    hasConversationTopic(conversationId: string): boolean;
    /**
     * Get participants for a topic from its ChannelInfo
     */
    getTopicParticipants(topicId: string): Promise<SHA256IdHash<Person>[]>;
    /**
     * Add participants to an existing topic
     */
    addParticipantsToTopic(topicId: string, newParticipants: SHA256IdHash<Person>[]): Promise<void>;
    /**
     * Create a P2P topic (delegates to TopicModel)
     */
    createP2PTopic(topicName: string, topicId: string, participants: [SHA256IdHash<Person>, SHA256IdHash<Person>]): Promise<Topic>;
    /**
     * Ensure P2P channels exist for a peer
     */
    ensureP2PChannelsForPeer(peerPersonId: SHA256IdHash<Person>): Promise<void>;
    /**
     * Handle a received Topic (when synced via CHUM)
     * Validates the channelCertificate before accepting
     */
    handleReceivedTopic(topicIdHash: SHA256IdHash<Topic>, topic: Topic): Promise<boolean>;
    /**
     * Initialize Group sync listener (LEGACY)
     * @deprecated Groups are no longer used - Topics are the parent objects now
     */
    initializeGroupSyncListener(): void;
    /**
     * Initialize Topic sync listener
     */
    initializeTopicSyncListener(): void;
    /**
     * Check if an Access/IdAccess hash is allowed to be sent outbound via CHUM
     *
     * With the simplified architecture, all Access/IdAccess from our instance
     * are allowed since they're created by us for legitimate sharing.
     *
     * @param hash - The Access or IdAccess hash to check
     */
    isAllowedOutbound(_hash: string): boolean;
    /**
     * Check if an Access/IdAccess hash is allowed to be accepted inbound via CHUM
     *
     * With the simplified architecture, all Access/IdAccess from paired peers
     * are allowed since pairing establishes trust.
     *
     * @param hash - The Access or IdAccess hash to check
     */
    isAllowedInbound(_hash: string): boolean;
    /** @deprecated Use getCachedTopicForConversation instead */
    getCachedGroupForTopic(topicId: string): SHA256IdHash<any> | undefined;
    /** @deprecated Groups are no longer used - participants come from ChannelInfo */
    hasConversationGroup(conversationId: string): boolean;
    /** @deprecated Use createGroupTopic instead */
    getOrCreateConversationGroup(topicId: string): Promise<unknown>;
    /** @deprecated Not needed - CHUM handles sync */
    syncReceivedGroups(): Promise<void>;
}
export default TopicGroupManager;
//# sourceMappingURL=TopicGroupManager.d.ts.map
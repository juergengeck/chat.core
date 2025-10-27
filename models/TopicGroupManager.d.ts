/**
 * Topic Group Manager (Platform-Agnostic)
 * Manages group creation for topics with proper participants
 *
 * This is pure business logic that works on both Node.js and browser platforms.
 * Platform-specific concerns are handled via dependency injection.
 */
import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
/**
 * Storage functions for TopicGroupManager (to avoid module duplication in Vite worker)
 */
export interface TopicGroupManagerStorageDeps {
    storeVersionedObject: (obj: any) => Promise<any>;
    getObjectByIdHash: (idHash: SHA256IdHash<any>) => Promise<any>;
    getObject: (hash: SHA256Hash<any>) => Promise<any>;
    getAllOfType: (type: string) => Promise<any[]>;
    createAccess: (accessRequests: any[]) => Promise<any>;
    calculateIdHashOfObj: (obj: any) => Promise<SHA256IdHash<any>>;
    calculateHashOfObj: (obj: any) => Promise<SHA256Hash<any>>;
}
/**
 * Minimal interface for ONE.core instance
 * Works for both NodeOneCore and WorkerOneCore
 */
export interface OneCoreInstance {
    ownerId: SHA256IdHash<Person>;
    channelManager: ChannelManager;
    topicModel: TopicModel;
    leuteModel: LeuteModel;
    aiAssistantModel?: any;
}
export declare class TopicGroupManager {
    private oneCore;
    private conversationGroups;
    private storageDeps;
    constructor(oneCore: OneCoreInstance, storageDeps: TopicGroupManagerStorageDeps);
    /**
     * Create an objectFilter for CHUM sync that validates Group signatures
     * This filter ensures Groups are cryptographically signed by trusted members
     *
     * @returns ObjectFilter function for use in ConnectionsModel config
     */
    createObjectFilter(): (hash: SHA256Hash<any> | SHA256IdHash<any>, type: string) => Promise<boolean>;
    /**
     * Check if a conversation has a group
     */
    hasConversationGroup(conversationId: string): boolean;
    /**
     * Check if a conversation is P2P (2 participants)
     */
    isP2PConversation(conversationId: any): any;
    /**
     * Create or get a conversation group for a topic
     * This group includes: browser owner, node owner, and AI assistant
     */
    getOrCreateConversationGroup(topicId: any, aiPersonId?: null): Promise<unknown>;
    /**
     * Get default participants for a conversation
     * This returns the minimal set - actual conversations will add more participants
     */
    getDefaultParticipants(aiPersonId?: null): Promise<unknown>;
    /**
     * Add participants to a conversation group
     * @deprecated Use addParticipantsToTopic() instead
     */
    addParticipantsToGroup(topicId: any, participantIds: any): Promise<any>;
    /**
     * Get default AI person ID
     */
    getDefaultAIPersonId(): any;
    /**
     * Add a participant to relevant conversation groups
     * This is called when a CHUM connection is established
     * For group chats: adds them to groups where they should be a member
     * For P2P: ensures the P2P conversation structure exists
     * @param {string} personId - The person ID to add to relevant groups
     */
    addParticipantToRelevantGroups(personId: any): Promise<any>;
    /**
     * Ensure a participant has access to a group they're a member of
     */
    ensureGroupAccess(groupIdHash: any, personId: any): Promise<any>;
    /**
     * Add a participant to a specific conversation group
     * @param {string} topicId - The topic ID
     * @param {string} groupIdHash - The group's ID hash
     * @param {string} personId - The person ID to add
     */
    addParticipantToGroup(topicId: any, groupIdHash: any, personId: any): Promise<any>;
    /**
     * Create a P2P topic following one.leute reference patterns exactly
     * @param {string} topicName - Display name for the topic
     * @param {string} topicId - Topic ID in format: personId1<->personId2
     * @param {Array<string>} participantIds - Array of exactly 2 person IDs
     */
    createP2PTopic(topicName: any, topicId: any, participantIds: any): Promise<any>;
    /**
     * Create a topic with the conversation group - compatible with one.leute architecture
     * In one.leute: ONE topic ID, MULTIPLE channels (one per participant)
     * @param {string} topicName - Display name for the topic
     * @param {string} topicId - Unique ID for the topic
     * @param {Array<string>} participantIds - Array of person IDs (humans, AIs, etc) to include
     * @param {boolean} autoAddChumConnections - Whether to automatically add all CHUM connections (default: false)
     */
    createGroupTopic(topicName: string, topicId: string, participantIds?: SHA256IdHash<Person>[], autoAddChumConnections?: boolean): Promise<unknown>;
    /**
     * Add participants to existing topic's group
     */
    addParticipantsToTopic(topicId: string, participants: SHA256IdHash<Person>[]): Promise<unknown>;
    /**
     * Query IdAccess objects to find the group for a topic
     * This is the persistent way to find groups - IdAccess stores the topic→group relationship
     * @param {string} topicId - The topic ID
     * @returns {Promise<SHA256IdHash<Group> | null>} The group ID hash or null if not found
     */
    getGroupForTopic(topicId: any): Promise<SHA256IdHash<any> | null>;
    /**
     * Get all participants for a topic from its group
     * @param {string} topicId - The topic ID
     * @returns {Promise<string[]>} Array of participant person IDs
     */
    getTopicParticipants(topicId: any): Promise<string[]>;
    /**
     * Ensure participant has their own channel for a group they're part of
     * This should be called when a participant discovers they're in a group
     * @param {string} topicId - The topic ID
     * @param {string} groupIdHash - The group's ID hash
     */
    ensureParticipantChannel(topicId: any, groupIdHash: any): Promise<any>;
    /**
     * Initialize group sync listener
     * Listens for Group objects received via CHUM and creates channels for them
     */
    initializeGroupSyncListener(): void;
    /**
     * Handle a received Group object
     * Called either from the event listener or explicitly when a group is received
     */
    private handleReceivedGroup;
    /**
     * @deprecated This method is deprecated - use initializeGroupSyncListener() instead
     * Kept for backwards compatibility
     */
    syncReceivedGroups(): Promise<void>;
    /**
     * @deprecated Do not use - creates duplicate conversations
     * P2P conversations should always use personId1<->personId2 format
     */
    ensureP2PChannelsForProfile(someoneId: any, peerPersonId: any): Promise<any>;
    /**
     * Ensure channels exist for P2P conversations with a specific peer
     * This is called when a CHUM connection is established
     * @param {string} peerPersonId - The peer's person ID
     */
    ensureP2PChannelsForPeer(peerPersonId: any): Promise<any>;
}
export default TopicGroupManager;
//# sourceMappingURL=TopicGroupManager.d.ts.map
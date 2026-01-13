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
import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person, HashGroup } from '@refinio/one.core/lib/recipes.js';
import type { Topic } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import type { ChannelInfo } from '@refinio/one.models/lib/recipes/ChannelRecipes.js';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
/**
 * Result from creating a topic
 */
export interface CreateTopicResult {
    topic: Topic;
    topicIdHash: SHA256IdHash<Topic>;
    channelInfoIdHash: SHA256IdHash<ChannelInfo>;
    participantsHash: SHA256Hash<HashGroup<Person>>;
}
/**
 * Storage dependencies for GroupPlan
 * Note: Generic methods use 'any' to avoid constraint issues with ONE.core's
 * complex type system. Runtime behavior is correct; these are just type signatures
 * for the dependency injection pattern.
 */
export interface GroupPlanStorageDeps {
    getObjectByIdHash: (idHash: SHA256IdHash<any>) => Promise<{
        obj: any;
    }>;
    getObject: (hash: SHA256Hash<any>) => Promise<any>;
    calculateIdHashOfObj: (obj: any) => Promise<SHA256IdHash<any>>;
    storeUnversionedObject: (obj: any) => Promise<{
        hash: SHA256Hash<any>;
    }>;
    storeVersionedObject: (obj: any) => Promise<{
        hash: SHA256Hash<any>;
        idHash: SHA256IdHash<any>;
    }>;
}
export interface CreateTopicRequest {
    topicId: string;
    topicName: string;
    participants: SHA256IdHash<Person>[];
}
export interface CreateTopicResponse {
    success: boolean;
    topicIdHash?: SHA256IdHash<Topic>;
    channelInfoIdHash?: SHA256IdHash<ChannelInfo>;
    participantsHash?: SHA256Hash<HashGroup>;
    error?: string;
}
export interface GetTopicRequest {
    topicId: string;
}
export interface GetTopicResponse {
    success: boolean;
    topicIdHash?: SHA256IdHash<Topic>;
    channelInfoIdHash?: SHA256IdHash<ChannelInfo>;
    participants?: SHA256IdHash<Person>[];
    error?: string;
}
export interface GetTopicParticipantsRequest {
    topicId: string;
}
export interface GetTopicParticipantsResponse {
    success: boolean;
    participants?: SHA256IdHash<Person>[];
    error?: string;
}
export interface AddParticipantsRequest {
    topicId: string;
    participants: SHA256IdHash<Person>[];
}
export interface AddParticipantsResponse {
    success: boolean;
    error?: string;
}
/**
 * GroupPlan - Pure business logic for conversation topic operations
 *
 * Dependencies injected via constructor:
 * - topicModel: TopicModel for topic creation and queries
 * - storageDeps: Storage functions for object access
 */
export declare class GroupPlan {
    static get planId(): string;
    static get planName(): string;
    static get description(): string;
    static get version(): string;
    private topicModel;
    private storageDeps;
    private ownerId;
    private topicCache;
    constructor(topicModel: TopicModel, storageDeps: GroupPlanStorageDeps, ownerId: SHA256IdHash<Person>);
    /**
     * Create a conversation topic with participants
     *
     * Creates HashGroup -> Group -> Topic with proper structure.
     * TopicModel.createGroupTopic expects a Group ID hash.
     */
    createTopic(request: CreateTopicRequest): Promise<CreateTopicResponse>;
    /**
     * Get topic info for a conversation
     */
    getTopic(request: GetTopicRequest): Promise<GetTopicResponse>;
    /**
     * Get participants for a topic from its ChannelInfo
     * @param topicId - The Topic's computed idHash (as string)
     */
    private getParticipantsForTopic;
    /**
     * Get participants for a topic
     */
    getTopicParticipants(request: GetTopicParticipantsRequest): Promise<GetTopicParticipantsResponse>;
    /**
     * Add participants to an existing topic
     * @param request.topicId - The Topic's computed idHash (as string)
     */
    addParticipants(request: AddParticipantsRequest): Promise<AddParticipantsResponse>;
    /**
     * Get cached topic ID hash
     */
    getCachedTopicForConversation(topicId: string): SHA256IdHash<Topic> | undefined;
}
//# sourceMappingURL=GroupPlan.d.ts.map
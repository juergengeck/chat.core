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
import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person, HashGroup } from '@refinio/one.core/lib/recipes.js';
import type { Topic } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import type { ChannelInfo } from '@refinio/one.models/lib/recipes/ChannelRecipes.js';
import type { TopicGroupManager } from '../models/TopicGroupManager.js';
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
 * - topicGroupManager: Topic/ChannelInfo operations
 */
export declare class GroupPlan {
    static get planId(): string;
    static get planName(): string;
    static get description(): string;
    static get version(): string;
    private topicGroupManager;
    constructor(topicGroupManager: TopicGroupManager);
    /**
     * Create a conversation topic with participants
     */
    createTopic(request: CreateTopicRequest): Promise<CreateTopicResponse>;
    /**
     * Get topic info for a conversation
     */
    getTopic(request: GetTopicRequest): Promise<GetTopicResponse>;
    /**
     * Get participants for a topic
     */
    getTopicParticipants(request: GetTopicParticipantsRequest): Promise<GetTopicParticipantsResponse>;
    /**
     * Add participants to an existing topic
     */
    addParticipants(request: AddParticipantsRequest): Promise<AddParticipantsResponse>;
}
//# sourceMappingURL=GroupPlan.d.ts.map
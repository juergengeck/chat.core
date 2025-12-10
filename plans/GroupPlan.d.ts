/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation group operations.
 * Delegates to TopicGroupManager for low-level Group creation.
 */
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Group, Person } from '@refinio/one.core/lib/recipes.js';
import type { TopicGroupManager } from '../models/TopicGroupManager.js';
export interface CreateGroupRequest {
    topicId: string;
    topicName: string;
    participants: SHA256IdHash<Person>[];
    autoAddChumConnections?: boolean;
}
export interface CreateGroupResponse {
    success: boolean;
    groupIdHash?: SHA256IdHash<Group>;
    error?: string;
}
export interface GetGroupForTopicRequest {
    topicId: string;
}
export interface GetGroupForTopicResponse {
    success: boolean;
    groupIdHash?: SHA256IdHash<Group>;
    participants?: string[];
    error?: string;
}
export interface GetTopicParticipantsRequest {
    topicId: string;
}
export interface GetTopicParticipantsResponse {
    success: boolean;
    participants?: string[];
    error?: string;
}
/**
 * GroupPlan - Pure business logic for conversation group operations
 *
 * Dependencies injected via constructor:
 * - topicGroupManager: Low-level Group/Topic operations
 * - nodeOneCore: ONE.core instance for owner/instanceVersion
 */
export declare class GroupPlan {
    static get planId(): string;
    static get planName(): string;
    static get description(): string;
    static get version(): string;
    private topicGroupManager;
    private nodeOneCore;
    constructor(topicGroupManager: TopicGroupManager, nodeOneCore: any);
    /**
     * Create a conversation group for a topic
     */
    createGroup(request: CreateGroupRequest): Promise<CreateGroupResponse>;
    /**
     * Get group for a topic
     */
    getGroupForTopic(request: GetGroupForTopicRequest): Promise<GetGroupForTopicResponse>;
    /**
     * Get participants for a topic
     */
    getTopicParticipants(request: GetTopicParticipantsRequest): Promise<GetTopicParticipantsResponse>;
}
//# sourceMappingURL=GroupPlan.d.ts.map
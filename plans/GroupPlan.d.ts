/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation group operations with Story/Assembly tracking.
 * Delegates to TopicGroupManager for low-level Group creation.
 * Creates Stories/Assemblies to document Group-Topic relationships.
 *
 * Uses StoryFactory from @refinio/api for proper Story creation with SHA-256 hash references.
 */
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Group, Person } from '@refinio/one.core/lib/recipes.js';
import type { TopicGroupManager } from '../models/TopicGroupManager.js';
import type { StoryFactory as RefinioStoryFactory, ExecutionMetadata, OperationResult, ExecutionResult } from '@refinio/api/plan-system';
export type { ExecutionMetadata, OperationResult, ExecutionResult };
export interface CreateGroupRequest {
    topicId: string;
    topicName: string;
    participants: SHA256IdHash<Person>[];
    autoAddChumConnections?: boolean;
}
export interface CreateGroupResponse {
    success: boolean;
    groupIdHash?: SHA256IdHash<Group>;
    assemblyIdHash?: string;
    storyIdHash?: string;
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
 * Dependencies for GroupPlan initialization
 */
export interface GroupPlanDependencies {
    topicGroupManager: TopicGroupManager;
    storyFactory: RefinioStoryFactory;
    ownerId: SHA256IdHash<Person>;
    getInstanceVersion: () => string;
}
/**
 * GroupPlan - Pure business logic for conversation group operations
 *
 * Uses StoryFactory from @refinio/api for proper Story creation.
 * Must call init() before using createGroup() to register the Plan.
 */
export declare class GroupPlan {
    static readonly PLAN_ID = "GroupPlan";
    static readonly PLAN_NAME = "Group";
    static readonly PLAN_DESCRIPTION = "Manages conversation groups with Story/Assembly tracking";
    static readonly PLAN_DOMAIN = "conversation";
    private topicGroupManager;
    private storyFactory;
    private ownerId;
    private getInstanceVersion;
    private planIdHash;
    constructor(deps: GroupPlanDependencies);
    /**
     * Initialize the plan by registering it with StoryFactory
     * Must be called before createGroup()
     */
    init(): Promise<void>;
    /**
     * Create a conversation group for a topic with Story/Assembly tracking
     */
    createGroup(request: CreateGroupRequest): Promise<CreateGroupResponse>;
    /**
     * Create group without Story/Assembly (fallback when not initialized)
     */
    private createGroupDirect;
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
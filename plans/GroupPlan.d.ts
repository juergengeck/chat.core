/**
 * Group Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for conversation group operations with Story/Assembly tracking.
 * Delegates to TopicGroupManager for low-level Group creation.
 * Creates Assemblies to document Group-Topic relationships (supply/demand semantics).
 *
 * Pattern based on refinio.api StoryFactory architecture.
 *
 * SELF-SUFFICIENT: GroupPlan creates its own StoryFactory and AssemblyPlan internally.
 * Platform code just needs to pass fundamental dependencies (oneCore, topicGroupManager, storage).
 */
import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Group, Person } from '@refinio/one.core/lib/recipes.js';
import type { TopicGroupManager } from '../models/TopicGroupManager.js';
export interface ExecutionContext {
    title: string;
    description: string;
    planId: SHA256IdHash<any>;
    owner: string;
    domain: string;
    instanceVersion: string;
    demand?: Demand;
    supply?: Supply;
    metadata?: Map<string, string>;
    matchScore?: number;
}
export interface Demand {
    domain: string;
    keywords: string[];
    trustLevel: 'me' | 'trusted' | 'group' | 'public';
    groupHash?: string;
    credentialFilters: Array<{
        type: string;
    }>;
}
export interface Supply {
    domain: string;
    keywords: string[];
    subjects: string[];
    ownerId: string;
    verifiableCredentials?: any[];
}
/**
 * Result of recordExecution - wraps operation result with Story/Assembly tracking.
 * On error, recordExecution throws - no error property needed.
 */
export interface ExecutionResult<T> {
    result: T;
    story?: {
        idHash: string;
        hash: string;
    };
    assembly?: {
        idHash: string;
        hash: string;
    };
}
export interface StoryFactory {
    recordExecution<T>(context: ExecutionContext, operation: () => Promise<T>): Promise<ExecutionResult<T>>;
}
/**
 * Storage functions required for Assembly/Story tracking
 */
export interface StorageFunctions {
    storeVersionedObject: (obj: any) => Promise<{
        hash: SHA256Hash<any>;
        idHash: SHA256IdHash<any>;
        versionHash: SHA256Hash<any>;
    }>;
    getObjectByIdHash: (idHash: SHA256IdHash<any>) => Promise<any>;
    getObject: (hash: SHA256Hash<any>) => Promise<any>;
}
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
 * GroupPlan - Pure business logic for conversation group operations
 *
 * SELF-SUFFICIENT: Creates its own StoryFactory and AssemblyPlan internally.
 *
 * Dependencies injected via constructor:
 * - topicGroupManager: Low-level Group/Topic operations
 * - nodeOneCore: ONE.core instance for owner/instanceVersion
 * - storage: Storage functions for Assembly/Story tracking (optional - enables Story/Assembly)
 * - storyFactory: Advanced override for custom StoryFactory (optional - for power users)
 */
export declare class GroupPlan {
    static get planId(): string;
    static get name(): string;
    static get description(): string;
    static get version(): string;
    private topicGroupManager;
    private nodeOneCore;
    private storyFactory?;
    private assemblyPlan?;
    private topicAssemblies;
    constructor(topicGroupManager: TopicGroupManager, nodeOneCore: any, storageOrStoryFactory?: StorageFunctions | StoryFactory, assemblyPlan?: any);
    /**
     * Create StoryFactory with AssemblyPlan (internal wiring)
     */
    private createStoryFactory;
    /**
     * Set StoryFactory after initialization (for gradual adoption or advanced customization)
     */
    setStoryFactory(factory: StoryFactory): void;
    /**
     * Get current instance version hash for Story/Assembly tracking
     */
    private getCurrentInstanceVersion;
    /**
     * Create a conversation group for a topic
     *
     * ASSEMBLY SEMANTICS:
     * - Demand: Topic needs a group with specific participants
     * - Supply: Group provides participant management and access control
     * - Match: Group creation satisfies topic's participant requirements
     */
    createGroup(request: CreateGroupRequest): Promise<CreateGroupResponse>;
    /**
     * Create group with Story/Assembly tracking
     */
    private createGroupWithStory;
    /**
     * Create group without Story/Assembly (fallback)
     */
    private createGroupDirect;
    /**
     * Get group for a topic
     *
     * FUTURE: Query Assemblies by metadata.topicId when Assembly query API is available
     * CURRENT: Delegates to TopicGroupManager.getGroupForTopic() (IdAccess query)
     */
    getGroupForTopic(request: GetGroupForTopicRequest): Promise<GetGroupForTopicResponse>;
    /**
     * Get participants for a topic
     */
    getTopicParticipants(request: GetTopicParticipantsRequest): Promise<GetTopicParticipantsResponse>;
}
//# sourceMappingURL=GroupPlan.d.ts.map
/**
 * StoryTopicPlan - Topic operations using Story + Cube architecture
 *
 * This plan creates and manages Topics wrapped with StoryFactory for:
 * - Full provenance tracking (who created/modified, when)
 * - Cube indexing for efficient queries
 * - Edit history via Story versioning
 *
 * Topics are conversation containers with:
 * - Stable UUID identity (allows renaming)
 * - Display name (mutable)
 * - Participants via HashGroup (for access control)
 *
 * @see docs/designs/STORY-CUBE-CHAT-ARCHITECTURE.md
 */
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person, HashGroup } from '@refinio/one.core/lib/recipes.js';
import type { VersionedObjectResult } from '@refinio/one.core/lib/storage-versioned-objects.js';
import type { Topic } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
/**
 * StoryFactory interface from refinio.api
 * Wraps operations to create Story objects for audit trail
 */
export interface StoryFactory {
    registerPlan(params: RegisterPlanParams): Promise<SHA256IdHash<Plan>>;
    wrapExecution<T>(metadata: ExecutionMetadata, operation: () => Promise<OperationResult<T>>): Promise<ExecutionResult<T>>;
}
export interface RegisterPlanParams {
    id: string;
    name: string;
    description?: string;
    domain?: string;
    demandPatterns?: any[];
    supplyPatterns?: any[];
}
export interface ExecutionMetadata {
    title: string;
    planId: SHA256IdHash<Plan>;
    planTypeName: string;
    owner: SHA256IdHash<Person>;
    instanceVersion: string;
}
export interface OperationResult<T> {
    result: T;
    productHash: SHA256Hash<any>;
}
export interface ExecutionResult<T> {
    result: T;
    storyId?: SHA256IdHash<Story>;
    assemblyId?: SHA256IdHash<Assembly>;
}
interface Plan {
    $type$: 'Plan';
    id: string;
}
interface Story {
    $type$: 'Story';
    id: string;
}
interface Assembly {
    $type$: 'Assembly';
}
/**
 * Storage dependencies injected from platform
 */
export interface StoryTopicPlanDeps {
    storeVersionedObject: <T>(obj: T) => Promise<VersionedObjectResult<T>>;
    storeUnversionedObject: <T>(obj: T) => Promise<{
        hash: SHA256Hash<T>;
    }>;
    getObjectByIdHash: <T>(idHash: SHA256IdHash<T>) => Promise<{
        obj: T;
    }>;
    getObject: <T>(hash: SHA256Hash<T>) => Promise<T>;
    calculateIdHashOfObj: <T>(obj: T) => Promise<SHA256IdHash<T>>;
}
/**
 * Topic Plan definition for StoryFactory registration
 */
export declare const TOPIC_PLAN: RegisterPlanParams;
export interface CreateTopicRequest {
    name: string;
    participants: SHA256IdHash<Person>[];
}
export interface CreateTopicResponse {
    topicHash: SHA256Hash<Topic>;
    topicIdHash: SHA256IdHash<Topic>;
    participantsHash: SHA256Hash<HashGroup<Person>>;
    storyIdHash: SHA256IdHash<Story>;
}
export interface RenameTopicRequest {
    topicIdHash: SHA256IdHash<Topic>;
    newName: string;
}
export interface RenameTopicResponse {
    topicHash: SHA256Hash<Topic>;
    storyIdHash: SHA256IdHash<Story>;
}
export interface AddParticipantRequest {
    topicIdHash: SHA256IdHash<Topic>;
    participant: SHA256IdHash<Person>;
}
export interface AddParticipantResponse {
    topicHash: SHA256Hash<Topic>;
    participantsHash: SHA256Hash<HashGroup<Person>>;
    storyIdHash: SHA256IdHash<Story>;
}
export interface RemoveParticipantRequest {
    topicIdHash: SHA256IdHash<Topic>;
    participant: SHA256IdHash<Person>;
}
export interface RemoveParticipantResponse {
    topicHash: SHA256Hash<Topic>;
    participantsHash: SHA256Hash<HashGroup<Person>>;
    storyIdHash: SHA256IdHash<Story>;
}
export interface GetParticipantsRequest {
    topicIdHash: SHA256IdHash<Topic>;
}
export interface GetParticipantsResponse {
    participants: SHA256IdHash<Person>[];
}
/**
 * StoryTopicPlan - Topic operations with Story tracking
 *
 * Usage:
 * ```typescript
 * const topicPlan = new StoryTopicPlan(storyFactory, deps, ownerIdHash, '1.0.0');
 * await topicPlan.init();
 *
 * const result = await topicPlan.createTopic({
 *     name: 'Project Discussion',
 *     participants: [person1IdHash, person2IdHash]
 * });
 * ```
 */
export declare class StoryTopicPlan {
    private storyFactory;
    private deps;
    private owner;
    private instanceVersion;
    private planIdHash;
    constructor(storyFactory: StoryFactory, deps: StoryTopicPlanDeps, owner: SHA256IdHash<Person>, instanceVersion?: string);
    /**
     * Initialize the plan - must be called before other methods
     */
    init(): Promise<void>;
    /**
     * Generate a UUID for topic identity
     */
    private generateId;
    /**
     * Ensure plan is initialized
     */
    private ensureInitialized;
    /**
     * Create a new conversation topic
     *
     * Creates a Topic with HashGroup for participants, wrapped with StoryFactory.
     * The owner is automatically added to participants if not already included.
     */
    createTopic(request: CreateTopicRequest): Promise<CreateTopicResponse>;
    /**
     * Rename an existing topic
     *
     * Creates a new version with updated name.
     * The Story chain tracks rename history.
     */
    renameTopic(request: RenameTopicRequest): Promise<RenameTopicResponse>;
    /**
     * Add a participant to a topic
     *
     * Creates a new HashGroup with the additional participant,
     * then creates a new Topic version referencing it.
     */
    addParticipant(request: AddParticipantRequest): Promise<AddParticipantResponse>;
    /**
     * Remove a participant from a topic
     *
     * Creates a new HashGroup without the participant,
     * then creates a new Topic version referencing it.
     *
     * Note: Cannot remove the last participant or the owner.
     */
    removeParticipant(request: RemoveParticipantRequest): Promise<RemoveParticipantResponse>;
    /**
     * Get participants for a topic
     *
     * Note: This is a read-only query, not wrapped with StoryFactory
     */
    getParticipants(request: GetParticipantsRequest): Promise<GetParticipantsResponse>;
}
export {};
//# sourceMappingURL=StoryTopicPlan.d.ts.map
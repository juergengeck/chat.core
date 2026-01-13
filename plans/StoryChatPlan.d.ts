/**
 * StoryChatPlan - Chat operations using Story + Cube architecture
 *
 * This plan creates chat messages wrapped with StoryFactory for:
 * - Full provenance tracking (who, when, what)
 * - Cube indexing for efficient queries
 * - Edit/delete history via Story versioning
 *
 * @see docs/designs/STORY-CUBE-CHAT-ARCHITECTURE.md
 */
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { VersionedObjectResult } from '@refinio/one.core/lib/storage-versioned-objects.js';
import type { ChatMessage } from '../recipes/ChatMessageRecipe.js';
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
export interface StoryChatPlanDeps {
    storeVersionedObject: <T>(obj: T) => Promise<VersionedObjectResult<T>>;
    getObjectByIdHash: <T>(idHash: SHA256IdHash<T>) => Promise<{
        obj: T;
    }>;
    getObject: <T>(hash: SHA256Hash<T>) => Promise<T>;
    calculateIdHashOfObj: <T>(obj: T) => Promise<SHA256IdHash<T>>;
}
/**
 * Chat Plan definition for StoryFactory registration
 */
export declare const CHAT_PLAN: RegisterPlanParams;
export interface CreateMessageRequest {
    topicIdHash: SHA256IdHash<Topic>;
    content: string;
    replyTo?: SHA256Hash<ChatMessage>;
    attachments?: SHA256Hash<any>[];
}
export interface CreateMessageResponse {
    messageHash: SHA256Hash<ChatMessage>;
    messageIdHash: SHA256IdHash<ChatMessage>;
    storyIdHash: SHA256IdHash<Story>;
}
export interface CreateReactionRequest {
    topicIdHash: SHA256IdHash<Topic>;
    targetMessageHash: SHA256Hash<ChatMessage>;
    reaction: string;
}
export interface CreateReactionResponse {
    reactionHash: SHA256Hash<ChatMessage>;
    reactionIdHash: SHA256IdHash<ChatMessage>;
    storyIdHash: SHA256IdHash<Story>;
}
export interface EditMessageRequest {
    messageIdHash: SHA256IdHash<ChatMessage>;
    newContent: string;
}
export interface EditMessageResponse {
    messageHash: SHA256Hash<ChatMessage>;
    storyIdHash: SHA256IdHash<Story>;
}
export interface DeleteMessageRequest {
    messageIdHash: SHA256IdHash<ChatMessage>;
    reason?: string;
}
export interface DeleteMessageResponse {
    messageHash: SHA256Hash<ChatMessage>;
    storyIdHash: SHA256IdHash<Story>;
}
export interface RemoveReactionRequest {
    reactionIdHash: SHA256IdHash<ChatMessage>;
}
export interface RemoveReactionResponse {
    messageHash: SHA256Hash<ChatMessage>;
    storyIdHash: SHA256IdHash<Story>;
}
/**
 * StoryChatPlan - Chat operations with Story tracking
 *
 * Usage:
 * ```typescript
 * const chatPlan = new StoryChatPlan(storyFactory, deps, ownerIdHash, '1.0.0');
 * await chatPlan.init();
 *
 * const result = await chatPlan.createMessage({
 *     topicIdHash,
 *     content: 'Hello world!'
 * });
 * ```
 */
export declare class StoryChatPlan {
    private storyFactory;
    private deps;
    private owner;
    private instanceVersion;
    private planIdHash;
    constructor(storyFactory: StoryFactory, deps: StoryChatPlanDeps, owner: SHA256IdHash<Person>, instanceVersion?: string);
    /**
     * Initialize the plan - must be called before other methods
     */
    init(): Promise<void>;
    /**
     * Generate a UUID for message identity
     */
    private generateId;
    /**
     * Ensure plan is initialized
     */
    private ensureInitialized;
    /**
     * Create a new chat message
     *
     * Creates a ChatMessage and wraps with StoryFactory for provenance tracking.
     * The Story captures who created the message and when.
     */
    createMessage(request: CreateMessageRequest): Promise<CreateMessageResponse>;
    /**
     * Create a reaction to a message
     *
     * Reactions are ChatMessages with:
     * - reaction field set (emoji)
     * - replyTo pointing to target message
     * - no content
     */
    createReaction(request: CreateReactionRequest): Promise<CreateReactionResponse>;
    /**
     * Edit an existing message
     *
     * Creates a new version of the message with updated content.
     * The Story chain tracks edit history.
     */
    editMessage(request: EditMessageRequest): Promise<EditMessageResponse>;
    /**
     * Delete a message (soft delete via tombstone)
     *
     * Creates a new version with deleted=true and content cleared.
     * Original content preserved in earlier Story versions.
     */
    deleteMessage(request: DeleteMessageRequest): Promise<DeleteMessageResponse>;
    /**
     * Remove a reaction
     *
     * Creates a new version with reaction cleared.
     */
    removeReaction(request: RemoveReactionRequest): Promise<RemoveReactionResponse>;
}
export {};
//# sourceMappingURL=StoryChatPlan.d.ts.map
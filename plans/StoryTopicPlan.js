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
/**
 * Topic Plan definition for StoryFactory registration
 */
export const TOPIC_PLAN = {
    id: 'TopicPlan',
    name: 'Topic Plan',
    description: 'Creates and manages conversation topics using Story + Cube architecture',
    domain: 'chat',
    supplyPatterns: [
        { type: 'Topic', description: 'Conversation topics' }
    ]
};
// ============================================================================
// StoryTopicPlan Implementation
// ============================================================================
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
export class StoryTopicPlan {
    storyFactory;
    deps;
    owner;
    instanceVersion;
    planIdHash;
    constructor(storyFactory, deps, owner, instanceVersion = '1.0.0') {
        this.storyFactory = storyFactory;
        this.deps = deps;
        this.owner = owner;
        this.instanceVersion = instanceVersion;
    }
    /**
     * Initialize the plan - must be called before other methods
     */
    async init() {
        this.planIdHash = await this.storyFactory.registerPlan(TOPIC_PLAN);
    }
    /**
     * Generate a UUID for topic identity
     */
    generateId() {
        return crypto.randomUUID();
    }
    /**
     * Ensure plan is initialized
     */
    ensureInitialized() {
        if (!this.planIdHash) {
            throw new Error('StoryTopicPlan not initialized. Call init() first.');
        }
    }
    // ========================================================================
    // Create Topic
    // ========================================================================
    /**
     * Create a new conversation topic
     *
     * Creates a Topic with HashGroup for participants, wrapped with StoryFactory.
     * The owner is automatically added to participants if not already included.
     */
    async createTopic(request) {
        this.ensureInitialized();
        const result = await this.storyFactory.wrapExecution({
            title: `Create topic: ${request.name}`,
            planId: this.planIdHash,
            planTypeName: 'TopicPlan',
            owner: this.owner,
            instanceVersion: this.instanceVersion
        }, async () => {
            // Ensure owner is in participants
            const allParticipants = new Set(request.participants);
            allParticipants.add(this.owner);
            // Create HashGroup for participants
            const hashGroup = {
                $type$: 'HashGroup',
                person: allParticipants
            };
            const hashGroupResult = await this.deps.storeUnversionedObject(hashGroup);
            const participantsHash = hashGroupResult.hash;
            // Grant access to the HashGroup object itself so it can sync via CHUM
            const { createAccess } = await import('@refinio/one.core/lib/access.js');
            const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js');
            await createAccess([{
                    object: participantsHash,
                    person: [],
                    hashGroup: [participantsHash],
                    mode: SET_ACCESS_MODE.ADD
                }]);
            // Create Topic
            // NOTE: Story+Cube architecture creates Topics without channels.
            // The one.models Topic requires a channel for full functionality.
            // This simplified Topic works for Story+Cube but may need channel
            // integration for full one.models compatibility.
            const topic = {
                $type$: 'Topic',
                participants: participantsHash,
                originalName: request.name,
                displayName: request.name
            };
            const stored = await this.deps.storeVersionedObject(topic);
            return {
                result: {
                    topicHash: stored.hash,
                    topicIdHash: stored.idHash,
                    participantsHash
                },
                productHash: stored.hash
            };
        });
        return {
            topicHash: result.result.topicHash,
            topicIdHash: result.result.topicIdHash,
            participantsHash: result.result.participantsHash,
            storyIdHash: result.storyId
        };
    }
    // ========================================================================
    // Rename Topic
    // ========================================================================
    /**
     * Rename an existing topic
     *
     * Creates a new version with updated name.
     * The Story chain tracks rename history.
     */
    async renameTopic(request) {
        this.ensureInitialized();
        const result = await this.storyFactory.wrapExecution({
            title: `Rename topic to: ${request.newName}`,
            planId: this.planIdHash,
            planTypeName: 'TopicPlan',
            owner: this.owner,
            instanceVersion: this.instanceVersion
        }, async () => {
            // Load current topic
            const current = await this.deps.getObjectByIdHash(request.topicIdHash);
            // Create new version with updated displayName
            // NOTE: originalName is part of identity and should not change
            const updated = {
                ...current.obj,
                displayName: request.newName
            };
            const stored = await this.deps.storeVersionedObject(updated);
            return {
                result: { topicHash: stored.hash },
                productHash: stored.hash
            };
        });
        return {
            topicHash: result.result.topicHash,
            storyIdHash: result.storyId
        };
    }
    // ========================================================================
    // Add Participant
    // ========================================================================
    /**
     * Add a participant to a topic
     *
     * Creates a new HashGroup with the additional participant,
     * then creates a new Topic version referencing it.
     */
    async addParticipant(request) {
        this.ensureInitialized();
        const result = await this.storyFactory.wrapExecution({
            title: `Add participant to topic`,
            planId: this.planIdHash,
            planTypeName: 'TopicPlan',
            owner: this.owner,
            instanceVersion: this.instanceVersion
        }, async () => {
            // Load current topic
            const current = await this.deps.getObjectByIdHash(request.topicIdHash);
            // Load current HashGroup
            const currentHashGroup = await this.deps.getObject(current.obj.participants);
            // Create new HashGroup with added participant
            const newParticipants = new Set(currentHashGroup.person);
            newParticipants.add(request.participant);
            const newHashGroup = {
                $type$: 'HashGroup',
                person: newParticipants
            };
            const hashGroupResult = await this.deps.storeUnversionedObject(newHashGroup);
            const participantsHash = hashGroupResult.hash;
            // Create new Topic version with updated participants
            const updated = {
                ...current.obj,
                participants: participantsHash
            };
            const stored = await this.deps.storeVersionedObject(updated);
            return {
                result: {
                    topicHash: stored.hash,
                    participantsHash
                },
                productHash: stored.hash
            };
        });
        return {
            topicHash: result.result.topicHash,
            participantsHash: result.result.participantsHash,
            storyIdHash: result.storyId
        };
    }
    // ========================================================================
    // Remove Participant
    // ========================================================================
    /**
     * Remove a participant from a topic
     *
     * Creates a new HashGroup without the participant,
     * then creates a new Topic version referencing it.
     *
     * Note: Cannot remove the last participant or the owner.
     */
    async removeParticipant(request) {
        this.ensureInitialized();
        const result = await this.storyFactory.wrapExecution({
            title: `Remove participant from topic`,
            planId: this.planIdHash,
            planTypeName: 'TopicPlan',
            owner: this.owner,
            instanceVersion: this.instanceVersion
        }, async () => {
            // Load current topic
            const current = await this.deps.getObjectByIdHash(request.topicIdHash);
            // Load current HashGroup
            const currentHashGroup = await this.deps.getObject(current.obj.participants);
            // Validate removal
            if (String(request.participant) === String(this.owner)) {
                throw new Error('Cannot remove topic owner from participants');
            }
            const newParticipants = new Set(currentHashGroup.person);
            if (!newParticipants.has(request.participant)) {
                throw new Error('Participant not in topic');
            }
            newParticipants.delete(request.participant);
            if (newParticipants.size === 0) {
                throw new Error('Cannot remove last participant from topic');
            }
            // Create new HashGroup without the participant
            const newHashGroup = {
                $type$: 'HashGroup',
                person: newParticipants
            };
            const hashGroupResult = await this.deps.storeUnversionedObject(newHashGroup);
            const participantsHash = hashGroupResult.hash;
            // Create new Topic version with updated participants
            const updated = {
                ...current.obj,
                participants: participantsHash
            };
            const stored = await this.deps.storeVersionedObject(updated);
            return {
                result: {
                    topicHash: stored.hash,
                    participantsHash
                },
                productHash: stored.hash
            };
        });
        return {
            topicHash: result.result.topicHash,
            participantsHash: result.result.participantsHash,
            storyIdHash: result.storyId
        };
    }
    // ========================================================================
    // Query Helpers
    // ========================================================================
    /**
     * Get participants for a topic
     *
     * Note: This is a read-only query, not wrapped with StoryFactory
     */
    async getParticipants(request) {
        const topic = await this.deps.getObjectByIdHash(request.topicIdHash);
        const hashGroup = await this.deps.getObject(topic.obj.participants);
        return {
            participants: Array.from(hashGroup.person)
        };
    }
}
//# sourceMappingURL=StoryTopicPlan.js.map
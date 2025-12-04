/**
 * Chat Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for chat operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Pattern based on refinio.api architecture.
 *
 * SELF-SUFFICIENT: Creates GroupPlan internally using nodeOneCore.topicGroupManager.
 * Platform code just needs to pass fundamental dependencies.
 */
import { GroupPlan as GroupPlanImpl } from './GroupPlan.js';
import { createP2PTopic } from '../services/P2PTopicService.js';
/**
 * ChatPlan - Pure business logic for chat operations
 *
 * SELF-SUFFICIENT: Automatically creates GroupPlan using nodeOneCore.topicGroupManager.
 * GroupPlan internally creates StoryFactory and AssemblyPlan for Story/Assembly tracking.
 *
 * Dependencies injected via constructor:
 * - nodeOneCore: The ONE.core instance with topicModel, leuteModel, topicGroupManager, storage functions
 * - stateManager: State management service (optional)
 * - messageVersionManager: Message versioning manager (optional)
 * - messageAssertionManager: Message assertion/certificate manager (optional)
 * - groupPlan: Advanced override for custom GroupPlan (optional - for power users)
 * - storyFactory: Story/Assembly automation (optional - for compatibility)
 *
 * Platform code can now simply:
 * ```typescript
 * const chatPlan = new ChatPlan(nodeOneCore);
 * ```
 * All internal wiring (GroupPlan → StoryFactory → AssemblyPlan) happens automatically.
 */
export class ChatPlan {
    static get planId() { return 'chat'; }
    static get name() { return 'Chat'; }
    static get description() { return 'Manages chat conversations, messages, and participants'; }
    static get version() { return '1.0.0'; }
    nodeOneCore;
    stateManager;
    messageVersionManager;
    messageAssertionManager;
    groupPlan;
    storyFactory;
    constructor(nodeOneCore, stateManager, messageVersionManager, messageAssertionManager, groupPlan, storyFactory) {
        this.nodeOneCore = nodeOneCore;
        this.stateManager = stateManager;
        this.messageVersionManager = messageVersionManager;
        this.messageAssertionManager = messageAssertionManager;
        this.storyFactory = storyFactory;
        // Create GroupPlan if not provided (using topicGroupManager from nodeOneCore)
        if (groupPlan) {
            // Use provided GroupPlan (backward compatibility or power user override)
            this.groupPlan = groupPlan;
        }
        else if (nodeOneCore.topicGroupManager) {
            // Auto-create GroupPlan with storage functions from nodeOneCore
            const storage = nodeOneCore.storeVersionedObject && nodeOneCore.getObjectByIdHash && nodeOneCore.getObject
                ? {
                    storeVersionedObject: nodeOneCore.storeVersionedObject.bind(nodeOneCore),
                    getObjectByIdHash: nodeOneCore.getObjectByIdHash.bind(nodeOneCore),
                    getObject: nodeOneCore.getObject.bind(nodeOneCore)
                }
                : undefined;
            this.groupPlan = new GroupPlanImpl(nodeOneCore.topicGroupManager, nodeOneCore, storage);
            console.log('[ChatPlan] ✅ Auto-created GroupPlan with Story/Assembly tracking');
        }
    }
    /**
     * Set message managers after initialization
     */
    setMessageManagers(versionManager, assertionManager) {
        this.messageVersionManager = versionManager;
        this.messageAssertionManager = assertionManager;
    }
    /**
     * Set GroupPlan after initialization (for gradual adoption)
     */
    setGroupPlan(plan) {
        this.groupPlan = plan;
    }
    /**
     * Set StoryFactory after initialization (for gradual adoption)
     */
    setStoryFactory(factory) {
        this.storyFactory = factory;
    }
    /**
     * Get current instance version hash for Story/Assembly tracking
     */
    getCurrentInstanceVersion() {
        // Try to get from nodeOneCore, fallback to timestamp if not available
        return this.nodeOneCore.instanceVersion || `instance-${Date.now()}`;
    }
    /**
     * Initialize default chats
     */
    async initializeDefaultChats(_request) {
        try {
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                return { success: false, error: 'Node not ready' };
            }
            // Don't create any chats here - they should only be created when we have an AI model
            return { success: true };
        }
        catch (error) {
            console.error('[ChatPlan] Error initializing default chats:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * UI ready signal
     */
    async uiReady(_request) {
        try {
            // Notify the PeerMessageListener that UI is ready (platform-specific)
            if (this.nodeOneCore.peerMessageListener) {
                // This will be handled by the platform-specific adapter
            }
            return { success: true };
        }
        catch (error) {
            console.error('[ChatPlan] Error in uiReady:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Send a message to a conversation
     */
    async sendMessage(request) {
        // Disabled: Pollutes JSON-RPC stdout in MCP server
        // console.error('[ChatPlan] Send message:', { conversationId: request.conversationId, content: request.content, senderId: request.senderId });
        // Use provided senderId or default to owner
        const userId = request.senderId || this.nodeOneCore.ownerId || this.stateManager?.getState('user.id');
        // StoryFactory disabled - Story requires product (Assembly) reference which isn't implemented yet
        // TODO: Re-enable when Assembly/Story integration is complete
        return await this.sendMessageInternal(request, userId);
    }
    /**
     * Internal implementation of sendMessage (wrapped by Story recording)
     */
    async sendMessageInternal(request, userId) {
        try {
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                throw new Error('TopicModel not initialized');
            }
            if (!userId) {
                throw new Error('User not authenticated');
            }
            // Validate conversationId
            if (!request.conversationId || typeof request.conversationId !== 'string') {
                throw new Error(`Invalid conversationId: ${request.conversationId}`);
            }
            // Allow empty content if attachments are present
            const hasContent = request.content && request.content.trim().length > 0;
            const hasAttachments = request.attachments && request.attachments.length > 0;
            if (!hasContent && !hasAttachments) {
                throw new Error('Message content cannot be empty');
            }
            // Get topic room
            let topicRoom;
            try {
                topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
            }
            catch (error) {
                console.error('[ChatPlan] Topic does not exist for conversation:', request.conversationId);
                throw new Error(`Topic ${request.conversationId} not found. Topics should be created before sending messages.`);
            }
            // Determine if P2P or group
            const isP2P = request.conversationId.includes('<->');
            // For group chats, use the sender as channel owner (each participant owns their channel)
            const channelOwner = isP2P ? null : userId;
            // Send message with or without attachments
            if (request.attachments && request.attachments.length > 0) {
                // Transform attachments to the format expected by sendMessageWithAttachmentAsHash
                const attachmentObjects = request.attachments.map(att => {
                    // If it's already an object with hash and type, use it
                    if (typeof att === 'object' && att.hash && att.type) {
                        return {
                            hash: att.hash,
                            type: att.type,
                            metadata: att.mimeType || att.name || att.size ? {
                                name: att.name,
                                mimeType: att.mimeType,
                                size: att.size
                            } : undefined
                        };
                    }
                    // Legacy: If it's a string, assume it's a BLOB hash
                    if (typeof att === 'string') {
                        return { hash: att, type: 'BLOB' };
                    }
                    // Fallback: Extract hash and assume BLOB
                    return { hash: att.hash || att.id, type: 'BLOB' };
                }).filter(att => att.hash); // Filter out any attachments without hashes
                await topicRoom.sendMessageWithAttachmentAsHash(request.content || '', attachmentObjects, undefined, channelOwner);
            }
            else {
                await topicRoom.sendMessage(request.content, undefined, channelOwner);
            }
            // AI response is handled by AIMessageListener (not here)
            // AIMessageListener detects the channel update and triggers processMessage
            return {
                success: true,
                data: {
                    id: `msg-${Date.now()}`,
                    conversationId: request.conversationId,
                    content: request.content,
                    sender: this.nodeOneCore.ownerId,
                    senderName: 'You',
                    timestamp: Date.now(),
                    attachments: request.attachments || []
                }
            };
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Get messages for a conversation
     */
    async getMessages(request) {
        try {
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                throw new Error('TopicModel not initialized');
            }
            const limit = request.limit || 50;
            const offset = request.offset || 0;
            // Get topic room - may not exist yet if topic is being created
            let topicRoom;
            try {
                topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
            }
            catch (error) {
                // Topic doesn't exist yet - return empty messages (valid during topic creation)
                if (error.message?.includes('does not exist')) {
                    return {
                        success: true,
                        messages: [],
                        hasMore: false,
                        total: 0
                    };
                }
                throw error; // Re-throw other errors
            }
            if (!topicRoom) {
                throw new Error(`Topic not found: ${request.conversationId}`);
            }
            const allMessages = await topicRoom.retrieveAllMessages();
            // Map ObjectData to UI format - extract the actual message data and look up sender names
            const formattedMessages = await Promise.all(allMessages.map(async (msg) => {
                let senderName = 'Unknown';
                // Get sender from either author or data.sender
                const sender = msg.author || msg.data?.sender;
                // Detect if sender is an AI using AIAssistantModel (check FIRST)
                let isAI = false;
                if (sender && this.nodeOneCore.aiAssistantModel) {
                    try {
                        isAI = this.nodeOneCore.aiAssistantModel.isAIPerson(sender);
                        // If it's an AI, try to get the model name as display name
                        if (isAI) {
                            const modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(sender);
                            if (modelId) {
                                senderName = modelId; // Use model ID as display name (e.g., "gpt-oss:20b")
                            }
                        }
                    }
                    catch (e) {
                        // If detection fails, default to false
                        isAI = false;
                    }
                }
                // Look up sender name from LeuteModel (works for ALL participants)
                // Only do this if we haven't already set a name (e.g., from AI model)
                if (sender && senderName === 'Unknown') {
                    try {
                        if (this.nodeOneCore.leuteModel) {
                            // First check if sender is the current user
                            if (sender.toString() === this.nodeOneCore.ownerId?.toString()) {
                                try {
                                    const me = await this.nodeOneCore.leuteModel.me();
                                    if (me) {
                                        const profile = await me.mainProfile();
                                        if (profile) {
                                            const personName = profile.personDescriptions?.find((d) => d.$type$ === 'PersonName');
                                            senderName = personName?.name || profile.name || 'You';
                                        }
                                    }
                                }
                                catch (e) {
                                    console.error('[ChatPlan] Failed to get current user name:', e);
                                }
                            }
                            else {
                                // Check other contacts
                                const others = await this.nodeOneCore.leuteModel.others();
                                for (const someone of others) {
                                    try {
                                        const personId = await someone.mainIdentity();
                                        if (personId && sender && personId.toString() === sender.toString()) {
                                            const profile = await someone.mainProfile();
                                            if (profile) {
                                                const personName = profile.personDescriptions?.find((d) => d.$type$ === 'PersonName');
                                                senderName = personName?.name || profile.name || 'Unknown';
                                                break;
                                            }
                                        }
                                    }
                                    catch (e) {
                                        // Continue to next person
                                    }
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.error('[ChatPlan] Failed to get sender name:', error);
                    }
                }
                const thinking = msg.data?.thinking || msg.thinking;
                if (thinking) {
                    console.log(`[ChatPlan] 🧠 Message ${msg.id?.substring(0, 8)} has thinking (${thinking.length} chars)`);
                }
                // Attachments are stored as references to ONE objects (BLOB, Certificate, CLOB, etc.)
                // Transform to UI format: array of hashes -> array of {hash} objects
                const rawAttachments = msg.data?.attachments || [];
                const attachments = rawAttachments.map((att) => ({
                    hash: att
                }));
                return {
                    id: msg.id,
                    content: msg.data?.text || msg.text || '', // Check both data.text and text (matches Electron)
                    sender,
                    senderName,
                    timestamp: msg.creationTime ? new Date(msg.creationTime).getTime() : Date.now(),
                    attachments,
                    creationTime: msg.creationTime,
                    thinking, // Include thinking/reasoning trace (for DeepSeek R1, etc.)
                    isAI, // Flag to identify AI messages
                    isOwn: sender?.toString() === this.nodeOneCore.ownerId?.toString() // Ownership flag for UI alignment
                };
            }));
            // Sort by timestamp ascending (oldest first in array)
            const sortedMessages = formattedMessages.sort((a, b) => {
                return a.timestamp - b.timestamp;
            });
            // Apply pagination from the END (most recent messages first)
            // Chat apps show newest messages when you open a conversation
            const totalMessages = sortedMessages.length;
            const endIndex = Math.max(0, totalMessages - offset);
            const startIndex = Math.max(0, endIndex - limit);
            const paginatedMessages = sortedMessages.slice(startIndex, endIndex);
            const hasMore = startIndex > 0;
            return {
                success: true,
                messages: paginatedMessages,
                total: sortedMessages.length,
                hasMore
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error getting messages:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Create a new conversation
     */
    async createConversation(request) {
        const userId = this.nodeOneCore.ownerId || this.stateManager?.getState('user.id');
        // StoryFactory disabled - Story requires product (Assembly) reference which isn't implemented yet
        // TODO: Re-enable when Assembly/Story integration is complete
        return await this.createConversationInternal(request, userId);
    }
    /**
     * Internal implementation of createConversation (wrapped by Story+Assembly recording)
     */
    async createConversationInternal(request, userId) {
        try {
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                throw new Error('Models not initialized');
            }
            if (!this.nodeOneCore.topicGroupManager) {
                throw new Error('TopicGroupManager not initialized');
            }
            if (!userId) {
                throw new Error('User not authenticated');
            }
            const type = request.type || 'direct';
            const participants = request.participants || [];
            const name = request.name || `Conversation ${Date.now()}`;
            console.error(`[ChatPlan] 🔍 BEFORE createGroup - participants.length: ${participants.length}`);
            console.error(`[ChatPlan] 🔍 BEFORE createGroup - participants:`, participants);
            // Content-addressed topic ID: Deterministic based on participants + owner
            // Same participants → Same topic ID → Natural deduplication
            const allParticipants = [userId, ...participants].sort();
            // Use crypto.subtle.digest for deterministic hashing
            const participantString = allParticipants.join(',');
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(participantString));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            const topicId = `group-${hashHex.substring(0, 24)}`;
            console.log(`[ChatPlan] Content-addressed topic ID: ${topicId}`);
            // Create group using GroupPlan (creates Story/Assembly, delegates to TopicGroupManager)
            if (this.groupPlan) {
                const result = await this.groupPlan.createGroup({
                    topicId,
                    topicName: name,
                    participants,
                    autoAddChumConnections: false
                });
                if (!result.success) {
                    throw new Error(result.error || 'Group creation failed');
                }
                console.error(`[ChatPlan] ✅ Created group via GroupPlan - Story: ${result.storyIdHash?.substring(0, 8)}, Assembly: ${result.assemblyIdHash?.substring(0, 8)}`);
            }
            else {
                // Fallback: Direct TopicGroupManager call (no Story/Assembly)
                await this.nodeOneCore.topicGroupManager.createGroupTopic(name, topicId, participants);
                console.error(`[ChatPlan] ⚠️ Created group via TopicGroupManager (no GroupPlan - no Story/Assembly)`);
            }
            console.error(`[ChatPlan] 🔍 AFTER createGroup - participants.length: ${participants.length}`);
            console.error(`[ChatPlan] 🔍 AFTER createGroup - participants:`, participants);
            // Configure channel for group conversations (one.leute pattern)
            // This ensures Person/Profile objects arriving via CHUM are automatically registered
            if (this.nodeOneCore.channelManager) {
                this.nodeOneCore.channelManager.setChannelSettingsAppendSenderProfile(topicId, true);
                this.nodeOneCore.channelManager.setChannelSettingsRegisterSenderProfileAtLeute(topicId, true);
            }
            // Enrich participants with names (same format as getConversations)
            const enrichedParticipants = await Promise.all(participants.map(async (participantId) => {
                let name = 'Unknown';
                let isAI = false;
                let modelId;
                if (this.nodeOneCore.leuteModel) {
                    try {
                        // Check if it's current user
                        if (participantId === this.nodeOneCore.ownerId) {
                            const me = await this.nodeOneCore.leuteModel.me();
                            if (me) {
                                const profile = await me.mainProfile();
                                if (profile) {
                                    const personName = profile.personDescriptions?.find((d) => d.$type$ === 'PersonName');
                                    name = personName?.name || profile.name || 'You';
                                }
                            }
                        }
                        else {
                            // Check if AI participant
                            if (this.nodeOneCore.aiAssistantModel?.isAIPerson(participantId)) {
                                isAI = true;
                                modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(participantId);
                                if (modelId && this.nodeOneCore.llmManager) {
                                    const modelInfo = await this.nodeOneCore.llmManager.getModel(modelId);
                                    name = modelInfo?.name || modelId;
                                }
                            }
                            else {
                                // Other contact
                                const others = await this.nodeOneCore.leuteModel.others();
                                for (const someone of others) {
                                    const identity = await someone.mainIdentity();
                                    if (identity === participantId) {
                                        const profile = await someone.mainProfile();
                                        if (profile) {
                                            const personName = profile.personDescriptions?.find((d) => d.$type$ === 'PersonName');
                                            name = personName?.name || profile.name || 'Contact';
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.warn(`[ChatPlan] Failed to get name for participant ${String(participantId).substring(0, 8)}:`, error);
                    }
                }
                return {
                    id: String(participantId),
                    name,
                    isAI,
                    modelId
                };
            }));
            // Detect AI participants and register topic automatically
            console.error(`[ChatPlan] createConversation checking ${participants.length} participants for AI:`, participants);
            if (this.nodeOneCore.aiAssistantModel) {
                try {
                    for (const participantId of participants) {
                        console.error(`[ChatPlan] Checking participant: ${participantId}`);
                        if (this.nodeOneCore.aiAssistantModel.isAIPerson(participantId)) {
                            const modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(participantId);
                            if (modelId) {
                                this.nodeOneCore.aiAssistantModel.registerAITopic(topicId, participantId);
                                console.error(`[ChatPlan] Detected AI participant ${participantId.substring(0, 8)} with model: ${modelId}`);
                                // Default chats (hi/lama) are handled by AITopicManager callback
                                // User-created chats need welcome message triggered here
                                const isDefaultChat = topicId === 'hi' || topicId === 'lama';
                                if (!isDefaultChat) {
                                    this.nodeOneCore.aiAssistantModel.handleNewTopic(topicId).catch((error) => {
                                        console.error('[ChatPlan] Failed to generate welcome message:', error);
                                    });
                                }
                                break; // Only register first AI participant
                            }
                        }
                    }
                }
                catch (error) {
                    console.error('[ChatPlan] Failed to detect/register AI participants:', error);
                    // Non-fatal - conversation creation succeeded
                }
            }
            return {
                success: true,
                data: {
                    id: topicId,
                    name,
                    type,
                    participants: enrichedParticipants, // Enriched with names to match getConversations format
                    created: Date.now()
                }
            };
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Get all conversations
     */
    async getConversations(request) {
        try {
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                throw new Error('TopicModel not initialized');
            }
            const limit = request.limit || 20;
            const offset = request.offset || 0;
            const topics = await this.nodeOneCore.topicModel.topics.all();
            console.log(`[ChatPlan] getConversations: Found ${topics.length} topics:`, topics.map((t) => ({ id: t.id, name: t.name })));
            // Convert to conversation format
            const conversations = await Promise.all(topics.map(async (topic) => {
                const topicId = topic.id;
                const name = topic.name;
                console.log(`[ChatPlan] Processing topic: ${topicId} (${name})`);
                // Get participants from topic group with enriched data (names)
                // ALSO extract AI model info from participants (if any AI contact is found)
                let participants = [];
                let aiModelId;
                try {
                    let groupIdHash = null;
                    if (this.nodeOneCore.topicGroupManager) {
                        groupIdHash = await this.nodeOneCore.topicGroupManager.getGroupForTopic(topicId);
                        console.log(`[ChatPlan] Topic ${topicId} (${name}) - groupIdHash:`, groupIdHash);
                    }
                    if (!groupIdHash) {
                        console.warn(`[ChatPlan] ⚠️ Topic ${topicId} (${name}) has NO GROUP - participants will be empty`);
                        // Skip topics without groups - they're from old implementations
                        // Set empty participants array and continue
                        participants = [];
                    }
                    else {
                        console.log(`[ChatPlan] Topic ${topicId} (${name}) - Loading group participants...`);
                        const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
                        const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
                        const groupResult = await getObjectByIdHash(groupIdHash);
                        const group = groupResult.obj;
                        if (group.hashGroup) {
                            const hashGroup = await getObject(group.hashGroup);
                            if (hashGroup.person) {
                                const participantIds = Array.from(hashGroup.person).map(id => String(id));
                                if (participantIds.length > 0) {
                                    // Enrich each participant with name and avatar color from Leute model
                                    participants = await Promise.all(participantIds.map(async (participantId) => {
                                        let name = 'Unknown';
                                        let color;
                                        let isAI = false;
                                        // Load avatar color from AvatarPreference storage
                                        try {
                                            const result = await getObjectByIdHash(participantId);
                                            if (result && result.obj && typeof result.obj === 'object' && '$type$' in result.obj && result.obj.$type$ === 'AvatarPreference') {
                                                color = result.obj.color;
                                            }
                                        }
                                        catch (e) {
                                            // No avatar preference exists, color will be undefined
                                        }
                                        // Get name from Leute model for ALL participants
                                        if (this.nodeOneCore.leuteModel) {
                                            try {
                                                // Check if it's current user
                                                if (participantId === this.nodeOneCore.ownerId) {
                                                    const me = await this.nodeOneCore.leuteModel.me();
                                                    if (me) {
                                                        const profile = await me.mainProfile();
                                                        if (profile) {
                                                            const personName = profile.personDescriptions?.find((d) => d.$type$ === 'PersonName');
                                                            name = personName?.name || profile.name || 'You';
                                                        }
                                                    }
                                                }
                                                else {
                                                    // Check if it's an AI participant by reading LLM objects from storage
                                                    if (this.nodeOneCore.llmObjectManager) {
                                                        try {
                                                            // CRITICAL: Ensure LLMObjectManager is initialized before querying
                                                            // Defensive check to prevent silent failures if initialization order changes
                                                            if (!this.nodeOneCore.llmObjectManager.initialized) {
                                                                console.warn(`[ChatPlan] ⚠️  LLMObjectManager not initialized - initializing now...`);
                                                                await this.nodeOneCore.llmObjectManager.initialize();
                                                                console.log(`[ChatPlan] ✅ LLMObjectManager initialized (late init)`);
                                                            }
                                                            // Query LLM objects to find one with this personId
                                                            const allLLMs = this.nodeOneCore.llmObjectManager.getAllLLMObjects();
                                                            console.log(`[ChatPlan] 🔍 DEBUG: Checking ${allLLMs.length} LLM objects for participant ${participantId.substring(0, 8)}...`);
                                                            for (const llm of allLLMs) {
                                                                const llmData = llm;
                                                                console.log(`[ChatPlan] 🔍 DEBUG: Checking LLM - personId: ${llmData.personId?.toString().substring(0, 8)}, modelId: ${llmData.modelId}`);
                                                                if (llmData.personId && llmData.personId.toString() === participantId) {
                                                                    // Found AI contact - use modelId from LLM object (from storage)
                                                                    const modelId = llmData.modelId;
                                                                    console.log(`[ChatPlan] 🔍 DEBUG: ✅ FOUND AI CONTACT! modelId:`, modelId);
                                                                    if (modelId) {
                                                                        name = modelId; // Use model ID as name (e.g., "gpt-oss:20b")
                                                                        isAI = true; // Mark as AI participant
                                                                        // CAPTURE the AI model ID for this conversation
                                                                        aiModelId = modelId;
                                                                        console.log(`[ChatPlan] 🔍 DEBUG: Set aiModelId to:`, aiModelId);
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        catch (e) {
                                                            console.warn(`[ChatPlan] Failed to check if participant is AI:`, e);
                                                        }
                                                    }
                                                    // If not AI or AI check failed, check other contacts
                                                    if (name === 'Unknown') {
                                                        const others = await this.nodeOneCore.leuteModel.others();
                                                        for (const someone of others) {
                                                            try {
                                                                const personId = await someone.mainIdentity();
                                                                if (personId && personId.toString() === participantId) {
                                                                    const profile = await someone.mainProfile();
                                                                    if (profile) {
                                                                        const personName = profile.personDescriptions?.find((d) => d.$type$ === 'PersonName');
                                                                        name = personName?.name || profile.name || 'User';
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                            catch (e) {
                                                                // Continue to next person
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            catch (error) {
                                                console.warn(`[ChatPlan] Could not get name for participant ${participantId}:`, error);
                                            }
                                        }
                                        return {
                                            id: participantId,
                                            name,
                                            isAI,
                                            color
                                        };
                                    }));
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`[ChatPlan] Error fetching participants for topic ${topicId}:`, error);
                    // Fallback on error: Add current user as participant
                    if (participants.length === 0) {
                        const currentUserId = this.nodeOneCore.ownerId;
                        if (currentUserId) {
                            participants = [{
                                    id: String(currentUserId),
                                    name: 'You',
                                    isAI: false
                                }];
                        }
                    }
                }
                // Fetch last message for preview
                let lastMessage = '';
                let lastMessageTime = Date.now();
                try {
                    const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(topicId);
                    const messages = await topicRoom.retrieveAllMessages();
                    if (messages.length > 0) {
                        // Get the most recent message
                        const sortedMessages = messages.sort((a, b) => {
                            const timeA = a.creationTime ? new Date(a.creationTime).getTime() : 0;
                            const timeB = b.creationTime ? new Date(b.creationTime).getTime() : 0;
                            return timeB - timeA; // Descending order (newest first)
                        });
                        const recentMessage = sortedMessages[0];
                        lastMessage = recentMessage.data?.text || recentMessage.text || '';
                        lastMessageTime = recentMessage.creationTime ? new Date(recentMessage.creationTime).getTime() : Date.now();
                        // Truncate message preview to 100 characters
                        if (lastMessage.length > 100) {
                            lastMessage = lastMessage.substring(0, 100) + '...';
                        }
                    }
                }
                catch (error) {
                    // If we can't fetch messages, just continue without preview
                    console.warn(`[ChatPlan] Could not fetch last message for topic ${topicId}:`, error);
                }
                // Check if this is an AI topic using AITopicManager (authoritative source)
                let modelName;
                let isAITopic = false;
                // AUTHORITATIVE CHECK: Use topicManager to determine if this is an AI topic
                if (this.nodeOneCore.aiAssistantModel?.topicManager?.isAITopic) {
                    isAITopic = this.nodeOneCore.aiAssistantModel.topicManager.isAITopic(topicId);
                }
                // Get AI model ID if it's an AI topic
                if (isAITopic) {
                    // Use aiModelId from participants if found, otherwise get from topicManager
                    if (!aiModelId && this.nodeOneCore.aiAssistantModel?.topicManager?.getAIPersonForTopic) {
                        const aiPersonId = this.nodeOneCore.aiAssistantModel.topicManager.getAIPersonForTopic(topicId);
                        if (aiPersonId && this.nodeOneCore.aiAssistantModel?.aiManager?.getLLMId) {
                            aiModelId = await this.nodeOneCore.aiAssistantModel.aiManager.getLLMId(aiPersonId);
                        }
                    }
                    // Get model name from LLM manager
                    if (aiModelId && this.nodeOneCore.llmManager) {
                        const modelInfo = await this.nodeOneCore.llmManager.getModel(aiModelId);
                        modelName = modelInfo?.name || aiModelId;
                    }
                }
                return {
                    id: topicId,
                    name: name || topicId,
                    type: 'chat',
                    participants,
                    lastActivity: lastMessageTime,
                    lastMessage,
                    unreadCount: 0,
                    isAITopic,
                    aiModelId,
                    modelName
                };
            }));
            // Sort by last activity
            const sortedConversations = conversations.sort((a, b) => b.lastActivity - a.lastActivity);
            console.log(`[ChatPlan] After conversion: ${conversations.length} conversations:`, conversations.map(c => ({ id: c.id, name: c.name, participants: c.participants.length, isAITopic: c.isAITopic })));
            // Apply pagination
            const paginatedConversations = sortedConversations.slice(offset, offset + limit);
            console.log(`[ChatPlan] Returning ${paginatedConversations.length} conversations (offset: ${offset}, limit: ${limit})`);
            return {
                success: true,
                data: paginatedConversations
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error getting conversations:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get a single conversation
     */
    async getConversation(request) {
        try {
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                throw new Error('Node not initialized');
            }
            // Try to get the topic
            const topic = await this.nodeOneCore.topicModel.topics.queryById(request.conversationId);
            if (!topic) {
                throw new Error(`Conversation not found: ${request.conversationId}`);
            }
            // Convert to conversation format
            const conversation = {
                id: topic.id,
                name: topic.name || topic.id,
                createdAt: topic.creationTime ? new Date(topic.creationTime).toISOString() : new Date().toISOString(),
                participants: topic.members || []
            };
            return {
                success: true,
                data: conversation
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error getting conversation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Create a P2P (one-to-one) conversation
     *
     * Uses P2PTopicService internally to create topic with proper channel setup.
     * All P2P topic creation MUST go through this method - platform code should NOT
     * call P2PTopicService or TopicModel directly.
     */
    async createP2PConversation(request) {
        try {
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                throw new Error('Node not initialized');
            }
            const { localPersonId, remotePersonId } = request;
            console.log('[ChatPlan] Creating P2P conversation');
            console.log('[ChatPlan]   Local person:', localPersonId?.substring(0, 8));
            console.log('[ChatPlan]   Remote person:', remotePersonId?.substring(0, 8));
            // Use P2PTopicService to create the topic
            const { topicRoom, wasCreated } = await createP2PTopic(this.nodeOneCore.topicModel, localPersonId, remotePersonId);
            // Generate P2P topic ID (lexicographically sorted)
            const topicId = localPersonId < remotePersonId
                ? `${localPersonId}<->${remotePersonId}`
                : `${remotePersonId}<->${localPersonId}`;
            if (wasCreated) {
                console.log('[ChatPlan] ✅ Created new P2P conversation:', topicId);
            }
            else {
                console.log('[ChatPlan] ✅ Using existing P2P conversation:', topicId);
            }
            return {
                success: true,
                topicId,
                topicRoom
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error creating P2P conversation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get current user
     */
    async getCurrentUser(_request) {
        try {
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.ownerId) {
                // Fallback to state manager
                const userId = this.stateManager?.getState('user.id');
                const userName = this.stateManager?.getState('user.name');
                if (userId) {
                    return {
                        success: true,
                        user: {
                            id: userId,
                            name: userName || 'User'
                        }
                    };
                }
                return {
                    success: false,
                    error: 'User not authenticated'
                };
            }
            // Get from ONE.core instance
            const ownerId = this.nodeOneCore.ownerId;
            let userName = 'User';
            // Try to get name from LeuteModel
            if (this.nodeOneCore.leuteModel) {
                try {
                    const me = await this.nodeOneCore.leuteModel.me();
                    if (me) {
                        const profile = await me.mainProfile();
                        if (profile?.personDescriptions?.length > 0) {
                            const nameDesc = profile.personDescriptions.find((d) => d.$type$ === 'PersonName' && d.name);
                            if (nameDesc?.name) {
                                userName = nameDesc.name;
                            }
                        }
                    }
                }
                catch (e) {
                    console.warn('[ChatPlan] Could not get user profile:', e);
                }
            }
            return {
                success: true,
                user: {
                    id: String(ownerId),
                    name: userName
                }
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error getting current user:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Add participants to a conversation
     *
     * ARCHITECTURE: Different group = Different chat
     * When participants change, we create a NEW chat with a NEW topicId.
     * This provides conversation continuity from a user perspective while
     * maintaining proper group/topic separation.
     */
    async addParticipants(request) {
        try {
            console.log('[ChatPlan] ========== ADD PARTICIPANTS START ==========');
            console.log('[ChatPlan] Original conversation:', request.conversationId);
            console.log('[ChatPlan] Participant IDs to add:', request.participantIds);
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                throw new Error('Models not initialized');
            }
            if (!this.nodeOneCore.topicGroupManager) {
                throw new Error('TopicGroupManager not initialized');
            }
            // Verify original topic exists
            const originalTopicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
            if (!originalTopicRoom) {
                throw new Error(`Topic not found: ${request.conversationId}`);
            }
            // Get current participants from the original group
            let currentParticipants = [];
            try {
                currentParticipants = await this.nodeOneCore.topicGroupManager.getTopicParticipants(request.conversationId);
                console.log('[ChatPlan] Current participants:', currentParticipants.map((p) => p.substring(0, 8)));
            }
            catch (error) {
                console.log('[ChatPlan] No existing group for topic (legacy topic)');
                // For legacy topics without groups, assume just the owner
                currentParticipants = [this.nodeOneCore.ownerId];
            }
            // Calculate new participant list (current + new)
            const allParticipants = [...new Set([...currentParticipants, ...request.participantIds])];
            console.log('[ChatPlan] New participant list:', allParticipants.map((p) => p.substring(0, 8)));
            // Content-addressed topic ID: Deterministic based on participant set
            // Same participants → Same topic ID → Natural deduplication
            const sortedParticipants = [...allParticipants].sort();
            // Use crypto.subtle.digest for deterministic hashing
            const participantString = sortedParticipants.join(',');
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(participantString));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            const newTopicId = `group-${hashHex.substring(0, 24)}`;
            console.log('[ChatPlan] Content-addressed topic ID:', newTopicId);
            // Check if topic already exists (CAS deduplication)
            const existingTopic = await this.nodeOneCore.topicModel.topics.queryById(newTopicId);
            if (existingTopic) {
                console.log('[ChatPlan] ✅ Topic with these participants already exists - using existing conversation');
                console.log('[ChatPlan] ========== ADD PARTICIPANTS END (content-addressed match) ==========');
                return {
                    success: true,
                    data: {
                        conversationId: request.conversationId,
                        addedParticipants: request.participantIds,
                        newConversationId: newTopicId // Switch to existing conversation
                    }
                };
            }
            console.log('[ChatPlan] Creating new conversation with', allParticipants.length, 'participants');
            // Get original topic name
            const originalTopic = await this.nodeOneCore.topicModel.topics.queryById(request.conversationId);
            const topicName = originalTopic?.name || `Chat ${newTopicId}`;
            // Create NEW topic with the new group (all participants)
            // Remove current owner from participantIds since createGroup adds owner automatically
            const participantsExcludingOwner = allParticipants.filter((p) => p !== this.nodeOneCore.ownerId);
            if (this.groupPlan) {
                const result = await this.groupPlan.createGroup({
                    topicId: newTopicId,
                    topicName,
                    participants: participantsExcludingOwner,
                    autoAddChumConnections: false
                });
                if (!result.success) {
                    throw new Error(result.error || 'Group creation failed');
                }
                console.log(`[ChatPlan] ✅ Created new topic via GroupPlan: ${newTopicId} - Story: ${result.storyIdHash?.substring(0, 8)}`);
            }
            else {
                // Fallback: Direct TopicGroupManager call
                await this.nodeOneCore.topicGroupManager.createGroupTopic(topicName, newTopicId, participantsExcludingOwner);
                console.log('[ChatPlan] ✅ Created new topic via TopicGroupManager:', newTopicId);
            }
            // Detect AI participants and register the new topic
            // CRITICAL: Check ALL participants (existing + new), not just request.participantIds
            let hasAI = false;
            if (this.nodeOneCore.aiAssistantModel) {
                for (const participantId of allParticipants) {
                    const isAI = this.nodeOneCore.aiAssistantModel.isAIPerson(participantId);
                    if (isAI) {
                        hasAI = true;
                        const modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(participantId);
                        console.log('[ChatPlan] Detected AI participant in new conversation - PersonId:', participantId.substring(0, 8), 'ModelId:', modelId);
                        // Register the topic with the AI Person's ID hash (not the model ID string)
                        this.nodeOneCore.aiAssistantModel.registerAITopic(newTopicId, participantId);
                        // Trigger introduction message from AI in the NEW chat (fire and forget)
                        this.nodeOneCore.aiAssistantModel.handleNewTopic(newTopicId).catch((error) => {
                            console.error('[ChatPlan] Failed to generate AI introduction message:', error);
                        });
                        // Only register the first AI participant (one AI per topic)
                        break;
                    }
                }
            }
            console.log('[ChatPlan] ========== ADD PARTICIPANTS END ==========');
            console.log('[ChatPlan] ✅ Result: Created NEW conversation:', newTopicId);
            console.log('[ChatPlan] ✅ Original conversation remains unchanged:', request.conversationId);
            return {
                success: true,
                data: {
                    conversationId: request.conversationId,
                    addedParticipants: request.participantIds,
                    newConversationId: newTopicId // Signal to UI that a new chat was created
                }
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error adding participants:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Clear a conversation
     */
    async clearConversation(request) {
        try {
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                throw new Error('Models not initialized');
            }
            // Get topic room
            const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
            if (!topicRoom) {
                throw new Error(`Topic not found: ${request.conversationId}`);
            }
            // Clear conversation
            // TODO: Implement actual clear logic
            return { success: true };
        }
        catch (error) {
            console.error('[ChatPlan] Error clearing conversation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Edit a message
     */
    async editMessage(request) {
        try {
            if (!this.messageVersionManager) {
                throw new Error('Message version manager not initialized');
            }
            // Create new version
            const result = await this.messageVersionManager.createNewVersion(request.messageId, request.newText, request.editReason);
            return {
                success: true,
                data: {
                    messageId: request.messageId,
                    newVersion: result.newVersionHash,
                    editedAt: Date.now()
                }
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error editing message:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Delete a message
     */
    async deleteMessage(request) {
        try {
            if (!this.messageVersionManager) {
                throw new Error('Message version manager not initialized');
            }
            // Mark as deleted
            await this.messageVersionManager.markAsDeleted(request.messageId, request.reason);
            return { success: true };
        }
        catch (error) {
            console.error('[ChatPlan] Error deleting message:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get message history
     */
    async getMessageHistory(request) {
        try {
            if (!this.messageVersionManager) {
                throw new Error('Message version manager not initialized');
            }
            const history = await this.messageVersionManager.getVersionHistory(request.messageId);
            return {
                success: true,
                history
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error getting message history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Export message credential
     */
    async exportMessageCredential(request) {
        try {
            if (!this.messageAssertionManager) {
                throw new Error('Message assertion manager not initialized');
            }
            const credential = await this.messageAssertionManager.exportCredential(request.messageId);
            return {
                success: true,
                credential
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error exporting credential:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Verify message assertion
     */
    async verifyMessageAssertion(request) {
        try {
            if (!this.messageAssertionManager) {
                throw new Error('Message assertion manager not initialized');
            }
            const valid = await this.messageAssertionManager.verifyAssertion(request.certificateHash, request.messageHash);
            return {
                success: true,
                valid
            };
        }
        catch (error) {
            console.error('[ChatPlan] Error verifying assertion:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
//# sourceMappingURL=ChatPlan.js.map
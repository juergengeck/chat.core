/**
 * Chat Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for chat operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Pattern based on refinio.api architecture.
 *
 * SELF-SUFFICIENT: Creates GroupPlan internally using nodeOneCore.topicModel.
 * Platform code just needs to pass fundamental dependencies.
 */
import { getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import { GroupPlan as GroupPlanImpl } from './GroupPlan.js';
import { createP2PTopic } from '../services/P2PTopicService.js';
/**
 * ChatPlan - Pure business logic for chat operations
 *
 * SELF-SUFFICIENT: Automatically creates GroupPlan using nodeOneCore.topicModel.
 * For group conversations with proper Group/HashGroup structure, use createGroupConversation().
 *
 * Dependencies injected via constructor:
 * - nodeOneCore: The ONE.core instance with topicModel, leuteModel, storage functions
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
 */
export class ChatPlan {
    static get planId() { return 'chat'; }
    static get planName() { return 'Chat'; }
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
        // Create GroupPlan if not provided (using topicModel from nodeOneCore)
        if (groupPlan) {
            // Use provided GroupPlan (backward compatibility or power user override)
            this.groupPlan = groupPlan;
        }
        else if (nodeOneCore.topicModel && nodeOneCore.ownerId) {
            // Auto-create GroupPlan with TopicModel
            const storageDeps = {
                getObjectByIdHash: nodeOneCore.getObjectByIdHash || (async (idHash) => {
                    const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
                    return getObjectByIdHash(idHash);
                }),
                getObject: nodeOneCore.getObject || (async (hash) => {
                    const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
                    return getObject(hash);
                }),
                calculateIdHashOfObj: nodeOneCore.calculateIdHashOfObj || (async (obj) => {
                    const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js');
                    return calculateIdHashOfObj(obj);
                }),
                storeUnversionedObject: nodeOneCore.storeUnversionedObject || (async (obj) => {
                    const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
                    return storeUnversionedObject(obj);
                }),
                storeVersionedObject: nodeOneCore.storeVersionedObject || (async (obj) => {
                    const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
                    return storeVersionedObject(obj);
                })
            };
            this.groupPlan = new GroupPlanImpl(nodeOneCore.topicModel, storageDeps, nodeOneCore.ownerId);
            console.log('[ChatPlan] Auto-created GroupPlan with TopicModel');
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
            console.log('[ChatPlan.sendMessage] 📤 Sending to:', request.conversationId?.substring(0, 20) + '...');
            // Get topic room
            let topicRoom;
            try {
                topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
            }
            catch (error) {
                console.error('[ChatPlan] Topic does not exist for conversation:', request.conversationId);
                throw new Error(`Topic ${request.conversationId} not found. Topics should be created before sending messages.`);
            }
            // Debug: log topic and channel info
            const topicChannel = topicRoom.topic?.channel;
            console.log('[ChatPlan.sendMessage] 📋 Topic found:', {
                id: topicRoom.topic?.id?.substring(0, 20),
                channel: topicChannel?.substring(0, 16)
            });
            // Send message with or without attachments
            // Channel identity is based on participants only (no owner)
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
                await topicRoom.sendMessageWithAttachmentAsHash(request.content || '', attachmentObjects);
            }
            else {
                await topicRoom.sendMessage(request.content);
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
            console.log('[ChatPlan.getMessages] 📥 Request:', request.conversationId?.substring(0, 20) + '...');
            // Get topic room - may not exist yet if topic is being created
            let topicRoom;
            try {
                topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
            }
            catch (error) {
                // Topic doesn't exist yet - return empty messages (valid during topic creation)
                if (error.message?.includes('does not exist')) {
                    console.log('[ChatPlan.getMessages] ⚠️ Topic does not exist:', request.conversationId?.substring(0, 20));
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
            // Debug: log topic and channel info
            const topicChannel = topicRoom.topic?.channel;
            console.log('[ChatPlan.getMessages] 📋 Topic found:', {
                id: topicRoom.topic?.id?.substring(0, 20),
                name: topicRoom.topic?.name?.substring(0, 20),
                channel: topicChannel?.substring(0, 16)
            });
            const allMessages = await topicRoom.retrieveAllMessages();
            console.log('[ChatPlan.getMessages] 📨 Retrieved messages:', allMessages.length);
            // DEBUG: Log raw message structure
            if (allMessages.length > 0) {
                console.log('[ChatPlan.getMessages] 🔍 DEBUG: First message raw:', JSON.stringify({
                    id: allMessages[0].id,
                    dataKeys: allMessages[0].data ? Object.keys(allMessages[0].data) : 'no data',
                    dataType: allMessages[0].data?.$type$,
                    dataText: allMessages[0].data?.text?.substring(0, 50),
                    hasData: !!allMessages[0].data,
                    author: allMessages[0].author
                }));
                // Log last message if different
                if (allMessages.length > 1) {
                    const last = allMessages[allMessages.length - 1];
                    console.log('[ChatPlan.getMessages] 🔍 DEBUG: Last message raw:', JSON.stringify({
                        id: last.id,
                        dataKeys: last.data ? Object.keys(last.data) : 'no data',
                        dataType: last.data?.$type$,
                        dataText: last.data?.text?.substring(0, 50),
                        hasData: !!last.data,
                        author: last.author
                    }));
                }
            }
            // Map ObjectData to UI format - extract the actual message data and look up sender names
            const formattedMessages = await Promise.all(allMessages.map(async (msg) => {
                let senderName = 'Unknown';
                // Get sender from either author or data.sender
                const sender = msg.author || msg.data?.sender;
                // Detect if sender is an AI using AIAssistantModel (check FIRST)
                // AI Persons have profiles in LeuteModel like any other contact - name lookup happens below
                let isAI = false;
                if (sender && this.nodeOneCore.aiAssistantModel) {
                    try {
                        isAI = this.nodeOneCore.aiAssistantModel.isAIPerson(sender);
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
                // Attachments are stored as references to ChatAttachment objects which contain metadata
                // Fetch each ChatAttachment to get type, name, size, mimeType, etc.
                const rawAttachments = msg.data?.attachments || [];
                const attachments = await Promise.all(rawAttachments.map(async (attHash) => {
                    try {
                        const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
                        const chatAttachment = await getObject(attHash);
                        return {
                            hash: chatAttachment.hash, // The actual BLOB/object hash
                            type: chatAttachment.type,
                            name: chatAttachment.metadata?.name,
                            size: chatAttachment.metadata?.size,
                            mimeType: chatAttachment.metadata?.mimeType,
                            preview: chatAttachment.metadata?.preview,
                            thumbnailHash: chatAttachment.metadata?.thumbnailHash
                        };
                    }
                    catch (error) {
                        console.error('[ChatPlan] Failed to fetch ChatAttachment:', attHash, error);
                        // Fallback: return just the hash if fetch fails
                        return { hash: attHash };
                    }
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
            if (!this.groupPlan) {
                throw new Error('GroupPlan not initialized');
            }
            if (!userId) {
                throw new Error('User not authenticated');
            }
            const type = request.type || 'direct';
            const participants = request.participants || [];
            const name = request.name || `Conversation ${Date.now()}`;
            console.error(`[ChatPlan] 🔍 BEFORE createGroup - participants.length: ${participants.length}`);
            console.error(`[ChatPlan] 🔍 BEFORE createGroup - participants:`, participants);
            // Topic ID: Unique based on owner + name + timestamp
            // Each conversation gets a unique ID even with the same name
            const timestamp = Date.now();
            const topicIdSource = `${userId}:${name}:${timestamp}`;
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(topicIdSource));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            const topicId = `topic-${hashHex.substring(0, 24)}`;
            console.log(`[ChatPlan] Unique topic ID: ${topicId} (from: ${userId.substring(0, 8)}:${name}:${timestamp})`);
            // Create topic using GroupPlan (uses TopicModel internally)
            const result = await this.groupPlan.createTopic({
                topicId,
                topicName: name,
                participants
            });
            if (!result.success) {
                throw new Error(result.error || 'Topic creation failed');
            }
            console.log(`[ChatPlan] Created topic via GroupPlan - topicIdHash: ${result.topicIdHash?.substring(0, 8)}`);
            console.log(`[ChatPlan] Topic created with ${participants.length} participants`);
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
                                await this.nodeOneCore.aiAssistantModel.registerAITopic(topicId, participantId);
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
            // Convert to conversation format
            const conversations = await Promise.all(topics.map(async (topic) => {
                // Calculate topic ID hash from Topic object
                const topicId = await calculateIdHashOfObj(topic);
                const name = topic.displayName ?? topic.originalName ?? topicId.substring(0, 16);
                console.log(`[ChatPlan] Processing topic: ${name} (${topicId.substring(0, 16)})`);
                // topicId is already the idHash (calculated from Topic object above)
                const topicIdHash = String(topicId);
                // Get participants from topic's ChannelInfo with enriched data (names)
                // ALSO extract AI model info from participants (if any AI contact is found)
                let participants = [];
                let aiModelId;
                try {
                    // Get participants directly from Topic → ChannelInfo → HashGroup
                    let participantIds = [];
                    try {
                        // Load ChannelInfo from topic.channel
                        const channelResult = await getObjectByIdHash(topic.channel);
                        const channelInfo = channelResult.obj;
                        if (channelInfo.participants) {
                            // Load HashGroup to get actual participant IDs
                            const hashGroup = await getObject(channelInfo.participants);
                            if (hashGroup.person) {
                                participantIds = Array.from(hashGroup.person).map((id) => String(id));
                            }
                        }
                        console.log(`[ChatPlan] Topic ${topicId} (${name}) - ${participantIds.length} participants from ChannelInfo`);
                    }
                    catch (e) {
                        console.warn(`[ChatPlan] Topic ${topicId} (${name}) - failed to get participants from ChannelInfo:`, e);
                    }
                    if (participantIds.length === 0) {
                        // Last resort fallback - shouldn't happen if ChannelInfo exists
                        console.warn(`[ChatPlan] Topic ${topicId} (${name}) - no participants in ChannelInfo, using owner only`);
                        const currentUserId = this.nodeOneCore.ownerId;
                        if (currentUserId) {
                            participantIds = [String(currentUserId)];
                        }
                    }
                    console.log(`[ChatPlan] Topic ${topicId} (${name}) - enriching ${participantIds.length} participants...`);
                    // Enrich each participant with name and avatar color
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
                                                        name = modelId;
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
                // Resolve display name for P2P topics (HashGroup-based ID)
                // P2P topics should show the OTHER participant's name, not the raw hash format
                let displayName = name || topicId;
                const isP2P = await this.nodeOneCore.topicModel?.isOneToOneChatAsync?.(topic) ?? false;
                if (isP2P && this.nodeOneCore.leuteModel && this.nodeOneCore.topicModel) {
                    // Extract participant IDs from HashGroup and find the OTHER one
                    let personA, personB;
                    try {
                        [personA, personB] = await this.nodeOneCore.topicModel.getOneToOneChatParticipants(topic);
                    }
                    catch {
                        // Not a valid P2P topic
                        personA = '';
                        personB = '';
                    }
                    const myId = String(this.nodeOneCore.ownerId);
                    const otherId = (personA === myId) ? personB : personA;
                    // Look up the other participant's name from contacts
                    try {
                        const others = await this.nodeOneCore.leuteModel.others();
                        for (const someone of others) {
                            const personId = await someone.mainIdentity();
                            if (personId && String(personId) === otherId) {
                                const profile = await someone.mainProfile();
                                if (profile) {
                                    // Try descriptionsOfType first (method), then fall back to array search
                                    let personName = null;
                                    if (typeof profile.descriptionsOfType === 'function') {
                                        const personNames = profile.descriptionsOfType('PersonName');
                                        if (personNames && personNames.length > 0) {
                                            personName = personNames[0];
                                        }
                                    }
                                    if (!personName && profile.personDescriptions) {
                                        personName = profile.personDescriptions.find((d) => d.$type$ === 'PersonName');
                                    }
                                    if (personName?.name) {
                                        displayName = personName.name;
                                    }
                                    else {
                                        // No PersonName - try email from Person object (may not be synced yet)
                                        try {
                                            const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
                                            const personResult = await getObjectByIdHash(personId);
                                            const personObj = personResult?.obj;
                                            if (personObj?.email) {
                                                // Extract name part from email (before @)
                                                const emailName = personObj.email.split('@')[0];
                                                displayName = emailName || `Contact ${otherId.substring(0, 8)}`;
                                            }
                                        }
                                        catch {
                                            // Person object not synced yet - fallback handled below
                                        }
                                    }
                                }
                                break;
                            }
                        }
                        // If not found in contacts, use truncated hash as fallback
                        if (displayName === name || displayName === topicId) {
                            displayName = `Contact ${otherId.substring(0, 8)}`;
                        }
                    }
                    catch (e) {
                        console.warn(`[ChatPlan] Could not resolve P2P contact name for ${otherId.substring(0, 8)}:`, e);
                        displayName = `Contact ${otherId.substring(0, 8)}`;
                    }
                }
                return {
                    id: topicId,
                    topicIdHash, // For version history lookup
                    name: displayName,
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
            // Calculate topic ID hash from Topic object
            const topicIdHash = await calculateIdHashOfObj(topic);
            const topicDisplayName = topic.displayName ?? topic.originalName ?? topicIdHash.substring(0, 16);
            // Convert to conversation format
            const conversation = {
                id: topicIdHash,
                name: topicDisplayName,
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
            // Use P2PTopicService to create the topic (returns HashGroup-based topicId)
            const { topicRoom, wasCreated, topicId } = await createP2PTopic(this.nodeOneCore.topicModel, localPersonId, remotePersonId);
            if (wasCreated) {
                console.log('[ChatPlan] ✅ Created new P2P conversation:', topicId.substring(0, 16));
            }
            else {
                console.log('[ChatPlan] ✅ Using existing P2P conversation:', topicId.substring(0, 16));
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
     * Create a group conversation with proper Group/HashGroup structure.
     *
     * This method implements the new group chat architecture:
     * 1. Creates HashGroup with participants
     * 2. Uses GroupChatPlan to create Group referencing HashGroup
     * 3. Uses TopicModel to create Topic referencing Group
     * 4. Grants access via HashGroup (CHUM handles automatic distribution)
     *
     * @param name - Name of the group conversation
     * @param participants - Person IDs of all participants (owner is auto-included)
     * @returns The created Topic
     */
    async createGroupConversation(name, participants) {
        if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
            throw new Error('TopicModel not initialized');
        }
        if (!this.nodeOneCore.ownerId) {
            throw new Error('Owner ID not set');
        }
        console.log(`[ChatPlan] Creating group conversation "${name}" with ${participants.length} participants`);
        // Ensure owner is included in participants
        const allParticipants = [...participants];
        if (!allParticipants.includes(this.nodeOneCore.ownerId)) {
            allParticipants.unshift(this.nodeOneCore.ownerId);
        }
        // Import storage functions
        const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
        const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js');
        const { createAccess } = await import('@refinio/one.core/lib/access.js');
        // Step 1: Create HashGroup with participants
        const hashGroup = {
            $type$: 'HashGroup',
            person: new Set(allParticipants)
        };
        const hashGroupResult = await storeUnversionedObject(hashGroup);
        const hashGroupHash = hashGroupResult.hash;
        // Grant access to the HashGroup object itself so it can sync via CHUM
        const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js');
        await createAccess([{
                object: hashGroupHash,
                person: [],
                hashGroup: [hashGroupHash],
                mode: SET_ACCESS_MODE.ADD
            }]);
        console.log(`[ChatPlan] Created HashGroup: ${hashGroupHash.substring(0, 8)}`);
        // Step 2: Create Group referencing HashGroup
        const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
        const group = {
            $type$: 'Group',
            name,
            hashGroup: hashGroupHash,
            participants: hashGroupHash
        };
        const groupResult = await storeVersionedObject(group);
        const groupIdHash = groupResult.idHash;
        console.log(`[ChatPlan] Created Group: ${groupIdHash.substring(0, 8)}`);
        // Step 3: Create Topic referencing Group
        // Channel identity is based on participants only (no owner)
        const topic = await this.nodeOneCore.topicModel.createGroupTopic(name, groupIdHash
        // topicId auto-generated
        );
        const topicIdHash = await calculateIdHashOfObj(topic);
        console.log(`[ChatPlan] Created Topic: ${topicIdHash.substring(0, 8)}`);
        // Step 4: Grant access via HashGroup
        // Note: We only grant access to Topic, NOT to ChannelInfo separately.
        // CHUM follows Topic.channel (referenceToId) automatically, fetching ChannelInfo
        // as a child of Topic. This ensures ChannelInfo is available before Topic is
        // processed by listeners (children fetched before root).
        const accessRequests = [
            {
                id: topicIdHash,
                person: [],
                hashGroup: [hashGroupHash],
                mode: SET_ACCESS_MODE.ADD
            }
        ];
        await createAccess(accessRequests);
        console.log(`[ChatPlan] Granted access via HashGroup`);
        // Configure channel for group conversations
        // Use topicIdHash which was already computed earlier
        if (this.nodeOneCore.channelManager) {
            this.nodeOneCore.channelManager.setChannelSettingsAppendSenderProfile(topicIdHash, true);
            this.nodeOneCore.channelManager.setChannelSettingsRegisterSenderProfileAtLeute(topicIdHash, true);
        }
        const topicDisplayName = topic.displayName ?? topic.originalName ?? topicIdHash.substring(0, 16);
        console.log(`[ChatPlan] Group conversation created: ${topicDisplayName}`);
        return topic;
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
     * Updates access rights for the existing topic - does NOT create a new topic.
     * Topic versions are tracked via ONE.core's versioning system.
     */
    async addParticipants(request) {
        try {
            console.log('[ChatPlan] ========== ADD PARTICIPANTS START ==========');
            console.log('[ChatPlan] Conversation:', request.conversationId);
            console.log('[ChatPlan] Participant IDs to add:', request.participantIds);
            if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
                throw new Error('Models not initialized');
            }
            // Get the existing topic
            const topic = await this.nodeOneCore.topicModel.topics.queryById(request.conversationId);
            if (!topic) {
                throw new Error(`Topic not found: ${request.conversationId}`);
            }
            // Add participants to the topic (grants access rights via HashGroup)
            // Note: addPersonsToTopic returns void - it modifies access rights in place
            await this.nodeOneCore.topicModel.addPersonsToTopic(request.participantIds, // SHA256IdHash<Person>[]
            topic);
            console.log('[ChatPlan] ✅ Added participants to topic, channel:', topic.channel?.substring(0, 8));
            // Update GroupPlan to add participants (updates Topic → ChannelInfo → HashGroup)
            if (this.groupPlan) {
                console.log('[ChatPlan] Updating GroupPlan with new participants');
                await this.groupPlan.addParticipants({
                    topicId: request.conversationId,
                    participants: request.participantIds
                });
                console.log('[ChatPlan] GroupPlan updated');
            }
            // Detect if any new participant is AI and register the topic
            if (this.nodeOneCore.aiAssistantModel) {
                for (const participantId of request.participantIds) {
                    const isAI = this.nodeOneCore.aiAssistantModel.isAIPerson(participantId);
                    if (isAI) {
                        const modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(participantId);
                        console.log('[ChatPlan] Detected new AI participant - PersonId:', participantId.substring(0, 8), 'ModelId:', modelId);
                        // Register the topic with the AI Person's ID hash
                        await this.nodeOneCore.aiAssistantModel.registerAITopic(request.conversationId, participantId);
                        // Trigger introduction message from AI (fire and forget)
                        this.nodeOneCore.aiAssistantModel.handleNewTopic(request.conversationId).catch((error) => {
                            console.error('[ChatPlan] Failed to generate AI introduction message:', error);
                        });
                        break; // Only register the first AI participant
                    }
                }
            }
            console.log('[ChatPlan] ========== ADD PARTICIPANTS END ==========');
            return {
                success: true,
                data: {
                    conversationId: request.conversationId,
                    addedParticipants: request.participantIds
                    // No newConversationId - same topic, just updated participants
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
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

import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person, Group, HashGroup, SetAccessParam } from '@refinio/one.core/lib/recipes.js';
import type { Topic } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
import { GroupPlan as GroupPlanImpl, GroupPlanStorageDeps } from './GroupPlan.js';
import { createP2PTopic } from '../services/P2PTopicService.js';

// StoryFactory interface for optional Story/Assembly tracking
export interface StoryFactory {
  recordExecution(metadata: any, operation: () => Promise<any>): Promise<any>;
}

// GroupPlan interface for topic operations
export interface GroupPlan {
  createTopic(request: any): Promise<any>;
  getTopic(request: any): Promise<any>;
  getTopicParticipants(request: any): Promise<any>;
  addParticipants(request: any): Promise<any>;
}

// Request/Response types
export interface InitializeDefaultChatsRequest {
  // No parameters
}

export interface InitializeDefaultChatsResponse {
  success: boolean;
  error?: string;
}

export interface UIReadyRequest {
  // No parameters
}

export interface UIReadyResponse {
  success: boolean;
  error?: string;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;  // Changed from 'text' to match response format
  attachments?: any[];
  senderId?: any;  // Optional: Person ID of the sender (defaults to nodeOneCore.ownerId)
}

export interface SendMessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface GetMessagesRequest {
  conversationId: string;
  limit?: number;
  offset?: number;
}

export interface GetMessagesResponse {
  success: boolean;
  messages?: any[];
  total?: number;
  hasMore?: boolean;
  error?: string;
}

export interface CreateConversationRequest {
  type?: string;
  participants?: any[];
  name?: string | null;
}

export interface CreateConversationResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface CreateP2PConversationRequest {
  localPersonId: any;
  remotePersonId: any;
}

export interface CreateP2PConversationResponse {
  success: boolean;
  topicId?: string;
  topicRoom?: any;
  error?: string;
}

export interface GetConversationsRequest {
  limit?: number;
  offset?: number;
}

export interface GetConversationsResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

export interface GetConversationRequest {
  conversationId: string;
}

export interface GetConversationResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface GetCurrentUserRequest {
  // No parameters
}

export interface GetCurrentUserResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
  };
  error?: string;
}

export interface AddParticipantsRequest {
  conversationId: string;
  participantIds: string[];
}

export interface AddParticipantsResponse {
  success: boolean;
  data?: {
    conversationId: string;
    addedParticipants: string[];
    newConversationId?: string;  // Present when a new chat is created (different group)
  };
  error?: string;
}

export interface ClearConversationRequest {
  conversationId: string;
}

export interface ClearConversationResponse {
  success: boolean;
  error?: string;
}

export interface EditMessageRequest {
  messageId: string;
  conversationId: string;
  newText: string;
  editReason?: string;
}

export interface EditMessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface DeleteMessageRequest {
  messageId: string;
  conversationId: string;
  reason?: string;
}

export interface DeleteMessageResponse {
  success: boolean;
  error?: string;
}

export interface GetMessageHistoryRequest {
  messageId: string;
}

export interface GetMessageHistoryResponse {
  success: boolean;
  history?: any[];
  error?: string;
}

export interface ExportMessageCredentialRequest {
  messageId: string;
}

export interface ExportMessageCredentialResponse {
  success: boolean;
  credential?: string;
  error?: string;
}

export interface VerifyMessageAssertionRequest {
  certificateHash: string;
  messageHash: string;
}

export interface VerifyMessageAssertionResponse {
  success: boolean;
  valid?: boolean;
  error?: string;
}

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
  static get planId(): string { return 'chat'; }
  static get planName(): string { return 'Chat'; }
  static get description(): string { return 'Manages chat conversations, messages, and participants'; }
  static get version(): string { return '1.0.0'; }

  private nodeOneCore: any;
  private stateManager: any;
  private messageVersionManager: any;
  private messageAssertionManager: any;
  private groupPlan?: GroupPlan;
  private storyFactory?: StoryFactory;

  constructor(
    nodeOneCore: any,
    stateManager?: any,
    messageVersionManager?: any,
    messageAssertionManager?: any,
    groupPlan?: GroupPlan,
    storyFactory?: StoryFactory
  ) {
    this.nodeOneCore = nodeOneCore;
    this.stateManager = stateManager;
    this.messageVersionManager = messageVersionManager;
    this.messageAssertionManager = messageAssertionManager;
    this.storyFactory = storyFactory;

    // Create GroupPlan if not provided (using topicModel from nodeOneCore)
    if (groupPlan) {
      // Use provided GroupPlan (backward compatibility or power user override)
      this.groupPlan = groupPlan;
    } else if (nodeOneCore.topicModel && nodeOneCore.ownerId) {
      // Auto-create GroupPlan with TopicModel
      const storageDeps: GroupPlanStorageDeps = {
        getObjectByIdHash: nodeOneCore.getObjectByIdHash || (async (idHash: any) => {
          const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
          return getObjectByIdHash(idHash);
        }),
        getObject: nodeOneCore.getObject || (async (hash: any) => {
          const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
          return getObject(hash);
        }),
        calculateIdHashOfObj: nodeOneCore.calculateIdHashOfObj || (async (obj: any) => {
          const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/object.js');
          return calculateIdHashOfObj(obj);
        })
      };
      this.groupPlan = new GroupPlanImpl(nodeOneCore.topicModel, storageDeps, nodeOneCore.ownerId);
      console.log('[ChatPlan] Auto-created GroupPlan with TopicModel');
    }
  }

  /**
   * Set message managers after initialization
   */
  setMessageManagers(versionManager: any, assertionManager: any): void {
    this.messageVersionManager = versionManager;
    this.messageAssertionManager = assertionManager;
  }

  /**
   * Set GroupPlan after initialization (for gradual adoption)
   */
  setGroupPlan(plan: GroupPlan): void {
    this.groupPlan = plan;
  }

  /**
   * Set StoryFactory after initialization (for gradual adoption)
   */
  setStoryFactory(factory: StoryFactory): void {
    this.storyFactory = factory;
  }

  /**
   * Get current instance version hash for Story/Assembly tracking
   */
  private getCurrentInstanceVersion(): string {
    // Try to get from nodeOneCore, fallback to timestamp if not available
    return this.nodeOneCore.instanceVersion || `instance-${Date.now()}`;
  }

  /**
   * Initialize default chats
   */
  async initializeDefaultChats(_request: InitializeDefaultChatsRequest): Promise<InitializeDefaultChatsResponse> {
    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        return { success: false, error: 'Node not ready' };
      }

      // Don't create any chats here - they should only be created when we have an AI model
      return { success: true };
    } catch (error) {
      console.error('[ChatPlan] Error initializing default chats:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * UI ready signal
   */
  async uiReady(_request: UIReadyRequest): Promise<UIReadyResponse> {
    try {
      // Notify the PeerMessageListener that UI is ready (platform-specific)
      if (this.nodeOneCore.peerMessageListener) {
        // This will be handled by the platform-specific adapter
      }
      return { success: true };
    } catch (error) {
      console.error('[ChatPlan] Error in uiReady:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
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
  private async sendMessageInternal(request: SendMessageRequest, userId: string | null): Promise<SendMessageResponse> {
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
      let topicRoom: any;
      try {
        topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
      } catch (error) {
        console.error('[ChatPlan] Topic does not exist for conversation:', request.conversationId);
        throw new Error(`Topic ${request.conversationId} not found. Topics should be created before sending messages.`);
      }

      // Debug: log topic and channel info
      const topicChannel = topicRoom.topic?.channel;
      console.log('[ChatPlan.sendMessage] 📋 Topic found:', {
        id: topicRoom.topic?.id?.substring(0, 20),
        channel: topicChannel?.substring(0, 16)
      });

      // Determine if P2P or group
      const isP2P = request.conversationId.includes('<->');
      // For group chats, use the sender as channel owner (each participant owns their channel)
      const channelOwner = isP2P ? null : userId;
      console.log('[ChatPlan.sendMessage] 🔑 isP2P:', isP2P, 'channelOwner:', channelOwner ? 'user' : 'null (shared)');

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

        await topicRoom.sendMessageWithAttachmentAsHash(
          request.content || '',
          attachmentObjects,
          undefined,
          channelOwner
        );
      } else {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(request: GetMessagesRequest): Promise<GetMessagesResponse> {
    try{
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
      } catch (error: any) {
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

      // Map ObjectData to UI format - extract the actual message data and look up sender names
      const formattedMessages = await Promise.all(allMessages.map(async (msg: any) => {
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
                senderName = modelId;
              }
            }
          } catch (e) {
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
                  const me: any = await this.nodeOneCore.leuteModel.me();
                  if (me) {
                    const profile: any = await me.mainProfile();
                    if (profile) {
                      const personName = profile.personDescriptions?.find((d: any) => d.$type$ === 'PersonName');
                      senderName = personName?.name || profile.name || 'You';
                    }
                  }
                } catch (e) {
                  console.error('[ChatPlan] Failed to get current user name:', e);
                }
              } else {
                // Check other contacts
                const others: any = await this.nodeOneCore.leuteModel.others();
                for (const someone of others) {
                  try {
                    const personId: any = await someone.mainIdentity();
                    if (personId && sender && personId.toString() === sender.toString()) {
                      const profile: any = await someone.mainProfile();
                      if (profile) {
                        const personName = profile.personDescriptions?.find((d: any) => d.$type$ === 'PersonName');
                        senderName = personName?.name || profile.name || 'Unknown';
                        break;
                      }
                    }
                  } catch (e) {
                    // Continue to next person
                  }
                }
              }
            }
          } catch (error) {
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
        const attachments = await Promise.all(rawAttachments.map(async (attHash: SHA256Hash) => {
          try {
            const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
            const chatAttachment = await getObject(attHash) as any;
            return {
              hash: chatAttachment.hash as string,  // The actual BLOB/object hash
              type: chatAttachment.type,
              name: chatAttachment.metadata?.name,
              size: chatAttachment.metadata?.size,
              mimeType: chatAttachment.metadata?.mimeType,
              preview: chatAttachment.metadata?.preview,
              thumbnailHash: chatAttachment.metadata?.thumbnailHash
            };
          } catch (error) {
            console.error('[ChatPlan] Failed to fetch ChatAttachment:', attHash, error);
            // Fallback: return just the hash if fetch fails
            return { hash: attHash as string };
          }
        }));

        return {
          id: msg.id,
          content: msg.data?.text || msg.text || '',  // Check both data.text and text (matches Electron)
          sender,
          senderName,
          timestamp: msg.creationTime ? new Date(msg.creationTime).getTime() : Date.now(),
          attachments,
          creationTime: msg.creationTime,
          thinking,  // Include thinking/reasoning trace (for DeepSeek R1, etc.)
          isAI,  // Flag to identify AI messages
          isOwn: sender?.toString() === this.nodeOneCore.ownerId?.toString()  // Ownership flag for UI alignment
        };
      }));

      // Sort by timestamp ascending (oldest first in array)
      const sortedMessages = formattedMessages.sort((a: any, b: any) => {
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
    } catch (error) {
      console.error('[ChatPlan] Error getting messages:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(request: CreateConversationRequest): Promise<CreateConversationResponse> {
    const userId = this.nodeOneCore.ownerId || this.stateManager?.getState('user.id');

    // StoryFactory disabled - Story requires product (Assembly) reference which isn't implemented yet
    // TODO: Re-enable when Assembly/Story integration is complete
    return await this.createConversationInternal(request, userId);
  }

  /**
   * Internal implementation of createConversation (wrapped by Story+Assembly recording)
   */
  private async createConversationInternal(request: CreateConversationRequest, userId: string | null): Promise<CreateConversationResponse> {
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

      console.log(`[ChatPlan] Created topic via GroupPlan - topicIdHash: ${result.topicIdHash?.substring(0, 8)}`)

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
        let modelId: string | undefined;

        if (this.nodeOneCore.leuteModel) {
          try {
            // Check if it's current user
            if (participantId === this.nodeOneCore.ownerId) {
              const me: any = await this.nodeOneCore.leuteModel.me();
              if (me) {
                const profile: any = await me.mainProfile();
                if (profile) {
                  const personName = profile.personDescriptions?.find((d: any) => d.$type$ === 'PersonName');
                  name = personName?.name || profile.name || 'You';
                }
              }
            } else {
              // Check if AI participant
              if (this.nodeOneCore.aiAssistantModel?.isAIPerson(participantId)) {
                isAI = true;
                modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(participantId);
                if (modelId && this.nodeOneCore.llmManager) {
                  const modelInfo = await this.nodeOneCore.llmManager.getModel(modelId);
                  name = modelInfo?.name || modelId;
                }
              } else {
                // Other contact
                const others = await this.nodeOneCore.leuteModel.others();
                for (const someone of others) {
                  const identity = await someone.mainIdentity();
                  if (identity === participantId) {
                    const profile: any = await someone.mainProfile();
                    if (profile) {
                      const personName = profile.personDescriptions?.find((d: any) => d.$type$ === 'PersonName');
                      name = personName?.name || profile.name || 'Contact';
                    }
                    break;
                  }
                }
              }
            }
          } catch (error) {
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
                  this.nodeOneCore.aiAssistantModel.handleNewTopic(topicId).catch((error: Error) => {
                    console.error('[ChatPlan] Failed to generate welcome message:', error);
                  });
                }
                break; // Only register first AI participant
              }
            }
          }
        } catch (error) {
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
          participants: enrichedParticipants,  // Enriched with names to match getConversations format
          created: Date.now()
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all conversations
   */
  async getConversations(request: GetConversationsRequest): Promise<GetConversationsResponse> {
    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        throw new Error('TopicModel not initialized');
      }

      const limit = request.limit || 20;
      const offset = request.offset || 0;

      const topics = await this.nodeOneCore.topicModel.topics.all();
      console.log(`[ChatPlan] getConversations: Found ${topics.length} topics:`, topics.map((t: any) => ({ id: t.id, name: t.name })));

      // Convert to conversation format
      const conversations = await Promise.all(
        topics.map(async (topic: any) => {
          const topicId = topic.id;
          const name = topic.name;
          console.log(`[ChatPlan] Processing topic: ${topicId} (${name})`);

          // Get topic idHash for version history lookup
          let topicIdHash: string | undefined;
          try {
            const idHash = await this.nodeOneCore.topicModel.topics.queryIdHashById(topicId);
            topicIdHash = idHash ? String(idHash) : undefined;
            console.log(`[ChatPlan] Topic ${topicId} idHash: ${topicIdHash?.substring(0, 16) || 'undefined'}`);
          } catch (e) {
            console.warn(`[ChatPlan] Failed to get idHash for ${topicId}:`, e);
          }

          // Get participants from topic's ChannelInfo with enriched data (names)
          // ALSO extract AI model info from participants (if any AI contact is found)
          let participants: any[] = [];
          let aiModelId: string | undefined;
          try {
            // Get participants directly from GroupPlan (uses ChannelInfo → HashGroup)
            let participantIds: string[] = [];

            if (this.groupPlan) {
              try {
                const result = await this.groupPlan.getTopicParticipants({ topicId });
                if (result.success && result.participants) {
                  participantIds = result.participants.map((id: any) => String(id));
                }
                console.log(`[ChatPlan] Topic ${topicId} (${name}) - ${participantIds.length} participants`);
              } catch (e) {
                console.log(`[ChatPlan] Topic ${topicId} (${name}) - no participants found`);
              }
            }

            if (participantIds.length === 0) {
              console.log(`[ChatPlan] Topic ${topicId} (${name}) - using fallback participants`);
              // Fallback: Add current user as participant
              const currentUserId = this.nodeOneCore.ownerId;
              if (currentUserId) {
                let ownerName = 'You';

                // Try to get the owner's name from LeuteModel
                if (this.nodeOneCore.leuteModel) {
                  try {
                    const me = await this.nodeOneCore.leuteModel.me();
                    if (me) {
                      const profile = await me.mainProfile();
                      if (profile) {
                        const personName = (profile as any).personDescriptions?.find((d: any) => d.$type$ === 'PersonName');
                        ownerName = personName?.name || (profile as any).name || 'You';
                      }
                    }
                  } catch (e) {
                    // Use default name
                  }
                }

                // Check if this is an AI topic and get the AI participant
                if (this.nodeOneCore.aiAssistantModel) {
                  const aiPersonId = this.nodeOneCore.aiAssistantModel.getAIPersonForTopic(topicId);
                  if (aiPersonId) {
                    const modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(aiPersonId);
                    if (modelId) {
                      participants = [
                        { id: currentUserId, name: ownerName, isLLM: false },
                        { id: aiPersonId, name: modelId, isLLM: true }
                      ];
                      aiModelId = modelId;
                    } else {
                      participants = [{ id: currentUserId, name: ownerName, isLLM: false }];
                    }
                  } else {
                    participants = [{ id: currentUserId, name: ownerName, isLLM: false }];
                  }
                } else {
                  participants = [{ id: currentUserId, name: ownerName, isLLM: false }];
                }
              }
            } else {
              console.log(`[ChatPlan] Topic ${topicId} (${name}) - enriching ${participantIds.length} participants...`);
              const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');

              // Enrich each participant with name and avatar color
              participants = await Promise.all(participantIds.map(async (participantId) => {
                    let name = 'Unknown';
                    let color: string | undefined;
                    let isAI = false;

                    // Load avatar color from AvatarPreference storage
                    try {
                      const result = await getObjectByIdHash(participantId as any);
                      if (result && result.obj && typeof result.obj === 'object' && '$type$' in result.obj && (result.obj as any).$type$ === 'AvatarPreference') {
                        color = (result.obj as any).color;
                      }
                    } catch (e) {
                      // No avatar preference exists, color will be undefined
                    }

                    // Get name from Leute model for ALL participants
                    if (this.nodeOneCore.leuteModel) {
                      try {
                        // Check if it's current user
                        if (participantId === this.nodeOneCore.ownerId) {
                          const me: any = await this.nodeOneCore.leuteModel.me();
                          if (me) {
                            const profile: any = await me.mainProfile();
                            if (profile) {
                              const personName = profile.personDescriptions?.find((d: any) => d.$type$ === 'PersonName');
                              name = personName?.name || profile.name || 'You';
                            }
                          }
                        } else {
                          // Check if it's an AI participant by reading LLM objects from storage
                          if (this.nodeOneCore.llmObjectManager) {
                            try {
                              // CRITICAL: Ensure LLMObjectManager is initialized before querying
                              // Defensive check to prevent silent failures if initialization order changes
                              if (!(this.nodeOneCore.llmObjectManager as any).initialized) {
                                console.warn(`[ChatPlan] ⚠️  LLMObjectManager not initialized - initializing now...`);
                                await this.nodeOneCore.llmObjectManager.initialize();
                                console.log(`[ChatPlan] ✅ LLMObjectManager initialized (late init)`);
                              }

                              // Query LLM objects to find one with this personId
                              const allLLMs = this.nodeOneCore.llmObjectManager.getAllLLMObjects();
                              console.log(`[ChatPlan] 🔍 DEBUG: Checking ${allLLMs.length} LLM objects for participant ${participantId.substring(0, 8)}...`);
                              for (const llm of allLLMs) {
                                const llmData = llm as any;
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
                            } catch (e) {
                              console.warn(`[ChatPlan] Failed to check if participant is AI:`, e);
                            }
                          }

                          // If not AI or AI check failed, check other contacts
                          if (name === 'Unknown') {
                            const others: any = await this.nodeOneCore.leuteModel.others();
                            for (const someone of others) {
                              try {
                                const personId: any = await someone.mainIdentity();
                                if (personId && personId.toString() === participantId) {
                                  const profile: any = await someone.mainProfile();
                                  if (profile) {
                                    const personName = profile.personDescriptions?.find((d: any) => d.$type$ === 'PersonName');
                                    name = personName?.name || profile.name || 'User';
                                    break;
                                  }
                                }
                              } catch (e) {
                                // Continue to next person
                              }
                            }
                          }
                        }
                      } catch (error) {
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
          } catch (error) {
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
              const sortedMessages = messages.sort((a: any, b: any) => {
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
          } catch (error) {
            // If we can't fetch messages, just continue without preview
            console.warn(`[ChatPlan] Could not fetch last message for topic ${topicId}:`, error);
          }

          // Check if this is an AI topic using AITopicManager (authoritative source)
          let modelName: string | undefined;
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

          // Resolve display name for P2P topics (format: hash1<->hash2)
          // P2P topics should show the OTHER participant's name, not the raw hash format
          let displayName = name || topicId;
          const p2pRegex = /^([0-9a-f]{64})<->([0-9a-f]{64})$/;
          const p2pMatch = topicId.match(p2pRegex);
          if (p2pMatch && this.nodeOneCore.leuteModel) {
            // Extract both participant IDs and find the OTHER one
            const [, personA, personB] = p2pMatch;
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
                    let personName: any = null;
                    if (typeof profile.descriptionsOfType === 'function') {
                      const personNames = profile.descriptionsOfType('PersonName');
                      if (personNames && personNames.length > 0) {
                        personName = personNames[0];
                      }
                    }
                    if (!personName && profile.personDescriptions) {
                      personName = profile.personDescriptions.find((d: any) => d.$type$ === 'PersonName');
                    }

                    if (personName?.name) {
                      displayName = personName.name;
                    } else {
                      // No PersonName - try email from Person object (may not be synced yet)
                      try {
                        const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
                        const personResult = await getObjectByIdHash(personId);
                        const personObj = personResult?.obj as any;
                        if (personObj?.email) {
                          // Extract name part from email (before @)
                          const emailName = personObj.email.split('@')[0];
                          displayName = emailName || `Contact ${otherId.substring(0, 8)}`;
                        }
                      } catch {
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
            } catch (e) {
              console.warn(`[ChatPlan] Could not resolve P2P contact name for ${otherId.substring(0, 8)}:`, e);
              displayName = `Contact ${otherId.substring(0, 8)}`;
            }
          }

          return {
            id: topicId,
            topicIdHash,  // For version history lookup
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
        })
      );

      // Sort by last activity
      const sortedConversations = conversations.sort((a, b) => b.lastActivity - a.lastActivity);
      console.log(`[ChatPlan] After conversion: ${conversations.length} conversations:`,
        conversations.map(c => ({ id: c.id, name: c.name, participants: c.participants.length, isAITopic: c.isAITopic })));

      // Apply pagination
      const paginatedConversations = sortedConversations.slice(offset, offset + limit);
      console.log(`[ChatPlan] Returning ${paginatedConversations.length} conversations (offset: ${offset}, limit: ${limit})`);

      return {
        success: true,
        data: paginatedConversations
      };
    } catch (error) {
      console.error('[ChatPlan] Error getting conversations:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get a single conversation
   */
  async getConversation(request: GetConversationRequest): Promise<GetConversationResponse> {
    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        throw new Error('Node not initialized');
      }

      // Try to get the topic
      const topic: any = await this.nodeOneCore.topicModel.topics.queryById(request.conversationId);

      if (!topic) {
        throw new Error(`Conversation not found: ${request.conversationId}`);
      }

      // Convert to conversation format
      const conversation: any = {
        id: topic.id,
        name: topic.name || topic.id,
        createdAt: topic.creationTime ? new Date(topic.creationTime).toISOString() : new Date().toISOString(),
        participants: topic.members || []
      };

      return {
        success: true,
        data: conversation
      };
    } catch (error) {
      console.error('[ChatPlan] Error getting conversation:', error);
      return {
        success: false,
        error: (error as Error).message
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
  async createP2PConversation(request: CreateP2PConversationRequest): Promise<CreateP2PConversationResponse> {
    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        throw new Error('Node not initialized');
      }

      const { localPersonId, remotePersonId } = request;

      console.log('[ChatPlan] Creating P2P conversation');
      console.log('[ChatPlan]   Local person:', localPersonId?.substring(0, 8));
      console.log('[ChatPlan]   Remote person:', remotePersonId?.substring(0, 8));

      // Use P2PTopicService to create the topic
      const { topicRoom, wasCreated } = await createP2PTopic(
        this.nodeOneCore.topicModel,
        localPersonId,
        remotePersonId
      );

      // Generate P2P topic ID (lexicographically sorted)
      const topicId = localPersonId < remotePersonId
        ? `${localPersonId}<->${remotePersonId}`
        : `${remotePersonId}<->${localPersonId}`;

      if (wasCreated) {
        console.log('[ChatPlan] ✅ Created new P2P conversation:', topicId);
      } else {
        console.log('[ChatPlan] ✅ Using existing P2P conversation:', topicId);
      }

      return {
        success: true,
        topicId,
        topicRoom
      };
    } catch (error) {
      console.error('[ChatPlan] Error creating P2P conversation:', error);
      return {
        success: false,
        error: (error as Error).message
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
  async createGroupConversation(
    name: string,
    participants: SHA256IdHash<Person>[]
  ): Promise<Topic> {
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
    const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/object.js');
    const { createAccess } = await import('@refinio/one.core/lib/access.js');

    // Step 1: Create HashGroup with participants
    const hashGroup: HashGroup<Person> = {
      $type$: 'HashGroup',
      person: new Set(allParticipants)
    };
    const hashGroupResult = await storeUnversionedObject(hashGroup);
    const hashGroupHash = hashGroupResult.hash as SHA256Hash<HashGroup<Person>>;

    console.log(`[ChatPlan] Created HashGroup: ${hashGroupHash.substring(0, 8)}`);

    // Step 2: Create Group referencing HashGroup via GroupChatPlan (if available)
    // Otherwise create via TopicModel directly
    let groupIdHash: SHA256IdHash<Group> | undefined;

    if (this.nodeOneCore.groupChatPlan) {
      // Use GroupChatPlan from connection.core
      const groupResult = await this.nodeOneCore.groupChatPlan.createGroup(name, hashGroupHash);
      groupIdHash = groupResult.groupIdHash as SHA256IdHash<Group>;
      console.log(`[ChatPlan] Created Group via GroupChatPlan: ${groupIdHash.substring(0, 8)}`);
    }

    // Step 3: Create Topic referencing Group (if created)
    // TopicModel.createGroupTopic now accepts Group reference
    const topic = await this.nodeOneCore.topicModel.createGroupTopic(
      name,
      groupIdHash || allParticipants, // Pass Group reference or participants
      undefined, // topicId (auto-generated)
      this.nodeOneCore.ownerId
    );
    const topicIdHash = await calculateIdHashOfObj(topic);

    console.log(`[ChatPlan] Created Topic: ${topicIdHash.substring(0, 8)}`);

    // Step 4: Grant access via HashGroup
    const accessRequests: SetAccessParam[] = [
      {
        id: topicIdHash,
        hashGroup: [hashGroupHash],
        mode: SET_ACCESS_MODE.ADD
      },
      {
        id: topic.channel,
        hashGroup: [hashGroupHash],
        mode: SET_ACCESS_MODE.ADD
      }
    ];

    await createAccess(accessRequests);
    console.log(`[ChatPlan] Granted access via HashGroup`);

    // Configure channel for group conversations
    if (this.nodeOneCore.channelManager) {
      this.nodeOneCore.channelManager.setChannelSettingsAppendSenderProfile(topic.id, true);
      this.nodeOneCore.channelManager.setChannelSettingsRegisterSenderProfileAtLeute(topic.id, true);
    }

    console.log(`[ChatPlan] Group conversation created: ${topic.id}`);

    return topic;
  }

  /**
   * Get current user
   */
  async getCurrentUser(_request: GetCurrentUserRequest): Promise<GetCurrentUserResponse> {
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
          const me: any = await this.nodeOneCore.leuteModel.me();
          if (me) {
            const profile: any = await me.mainProfile();
            if (profile?.personDescriptions?.length > 0) {
              const nameDesc = profile.personDescriptions.find((d: any) =>
                d.$type$ === 'PersonName' && d.name
              );
              if (nameDesc?.name) {
                userName = nameDesc.name;
              }
            }
          }
        } catch (e) {
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
    } catch (error) {
      console.error('[ChatPlan] Error getting current user:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Add participants to a conversation
   *
   * Updates access rights for the existing topic - does NOT create a new topic.
   * Topic versions are tracked via ONE.core's versioning system.
   */
  async addParticipants(request: AddParticipantsRequest): Promise<AddParticipantsResponse> {
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

      // Add participants to the topic (creates new channel, stores new Topic version)
      const updatedTopic = await this.nodeOneCore.topicModel.addPersonsToTopic(
        request.participantIds as any[], // SHA256IdHash<Person>[]
        topic
      );

      console.log('[ChatPlan] ✅ Added participants to topic, new channel:', updatedTopic.channel?.substring(0, 8));

      // Update GroupPlan to add participants (updates Topic → ChannelInfo → HashGroup)
      if (this.groupPlan) {
        console.log('[ChatPlan] Updating GroupPlan with new participants');
        await this.groupPlan.addParticipants({
          topicId: request.conversationId,
          participants: request.participantIds as any[]
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
            this.nodeOneCore.aiAssistantModel.registerAITopic(request.conversationId, participantId as any);

            // Trigger introduction message from AI (fire and forget)
            this.nodeOneCore.aiAssistantModel.handleNewTopic(request.conversationId).catch((error: Error) => {
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
    } catch (error) {
      console.error('[ChatPlan] Error adding participants:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Clear a conversation
   */
  async clearConversation(request: ClearConversationRequest): Promise<ClearConversationResponse> {
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
    } catch (error) {
      console.error('[ChatPlan] Error clearing conversation:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Edit a message
   */
  async editMessage(request: EditMessageRequest): Promise<EditMessageResponse> {
    try {
      if (!this.messageVersionManager) {
        throw new Error('Message version manager not initialized');
      }

      // Create new version
      const result = await this.messageVersionManager.createNewVersion(
        request.messageId,
        request.newText,
        request.editReason
      );

      return {
        success: true,
        data: {
          messageId: request.messageId,
          newVersion: result.newVersionHash,
          editedAt: Date.now()
        }
      };
    } catch (error) {
      console.error('[ChatPlan] Error editing message:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(request: DeleteMessageRequest): Promise<DeleteMessageResponse> {
    try {
      if (!this.messageVersionManager) {
        throw new Error('Message version manager not initialized');
      }

      // Mark as deleted
      await this.messageVersionManager.markAsDeleted(request.messageId, request.reason);

      return { success: true };
    } catch (error) {
      console.error('[ChatPlan] Error deleting message:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get message history
   */
  async getMessageHistory(request: GetMessageHistoryRequest): Promise<GetMessageHistoryResponse> {
    try {
      if (!this.messageVersionManager) {
        throw new Error('Message version manager not initialized');
      }

      const history = await this.messageVersionManager.getVersionHistory(request.messageId);

      return {
        success: true,
        history
      };
    } catch (error) {
      console.error('[ChatPlan] Error getting message history:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Export message credential
   */
  async exportMessageCredential(request: ExportMessageCredentialRequest): Promise<ExportMessageCredentialResponse> {
    try {
      if (!this.messageAssertionManager) {
        throw new Error('Message assertion manager not initialized');
      }

      const credential = await this.messageAssertionManager.exportCredential(request.messageId);

      return {
        success: true,
        credential
      };
    } catch (error) {
      console.error('[ChatPlan] Error exporting credential:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Verify message assertion
   */
  async verifyMessageAssertion(request: VerifyMessageAssertionRequest): Promise<VerifyMessageAssertionResponse> {
    try {
      if (!this.messageAssertionManager) {
        throw new Error('Message assertion manager not initialized');
      }

      const valid = await this.messageAssertionManager.verifyAssertion(
        request.certificateHash,
        request.messageHash
      );

      return {
        success: true,
        valid
      };
    } catch (error) {
      console.error('[ChatPlan] Error verifying assertion:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
}

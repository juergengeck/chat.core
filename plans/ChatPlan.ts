/**
 * Chat Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for chat operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Pattern based on refinio.api architecture.
 */

import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Group, HashGroup } from '@refinio/one.core/lib/recipes.js';

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
  data?: any;
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
 * Dependencies injected via constructor:
 * - nodeOneCore: The ONE.core instance with topicModel, leuteModel, etc.
 * - stateManager: State management service
 * - messageVersionManager: Message versioning manager
 * - messageAssertionManager: Message assertion/certificate manager
 */
export class ChatPlan {
  private nodeOneCore: any;
  private stateManager: any;
  private messageVersionManager: any;
  private messageAssertionManager: any;

  constructor(
    nodeOneCore: any,
    stateManager?: any,
    messageVersionManager?: any,
    messageAssertionManager?: any
  ) {
    this.nodeOneCore = nodeOneCore;
    this.stateManager = stateManager;
    this.messageVersionManager = messageVersionManager;
    this.messageAssertionManager = messageAssertionManager;
  }

  /**
   * Set message managers after initialization
   */
  setMessageManagers(versionManager: any, assertionManager: any): void {
    this.messageVersionManager = versionManager;
    this.messageAssertionManager = assertionManager;
  }

  /**
   * Initialize default chats
   */
  async initializeDefaultChats(request: InitializeDefaultChatsRequest): Promise<InitializeDefaultChatsResponse> {
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
  async uiReady(request: UIReadyRequest): Promise<UIReadyResponse> {
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

    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        throw new Error('TopicModel not initialized');
      }

      // Use provided senderId or default to owner
      const userId = request.senderId || this.nodeOneCore.ownerId || this.stateManager?.getState('user.id');
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
      let topicRoom: any;
      try {
        topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
      } catch (error) {
        console.error('[ChatPlan] Topic does not exist for conversation:', request.conversationId);
        throw new Error(`Topic ${request.conversationId} not found. Topics should be created before sending messages.`);
      }

      // Determine if P2P or group
      const isP2P = request.conversationId.includes('<->');
      // For group chats, use the sender as channel owner (each participant owns their channel)
      const channelOwner = isP2P ? null : userId;

      // Send message with or without attachments
      if (request.attachments && request.attachments.length > 0) {
        const attachmentHashes = request.attachments.map(att => {
          if (typeof att === 'string') return att;
          return att.hash || att.id;
        }).filter(Boolean);

        await topicRoom.sendMessageWithAttachmentAsHash(
          request.content || '',
          attachmentHashes,
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
          content: request.content,  // Fixed: use request.content to match interface
          sender: this.nodeOneCore.ownerId,
          senderName: 'You',
          timestamp: Date.now(),
          attachments: request.attachments || []
        }
      };
    } catch (error) {
      console.error('[ChatPlan] Error sending message:', error);
      return {
        success: false,
        error: (error as Error).message
      };
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

      // Get topic room - may not exist yet if topic is being created
      let topicRoom;
      try {
        topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
      } catch (error: any) {
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
      const formattedMessages = await Promise.all(allMessages.map(async (msg: any) => {
        let senderName = 'Unknown';

        // Get sender from either author or data.sender
        const sender = msg.author || msg.data?.sender;

        // Look up sender name from LeuteModel (works for ALL participants)
        if (sender) {
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
                        senderName = personName?.name || profile.name || 'User';
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

        // Detect if sender is an AI using AIAssistantModel
        let isAI = false;
        if (sender && this.nodeOneCore.aiAssistantModel) {
          try {
            isAI = this.nodeOneCore.aiAssistantModel.isAIPerson(sender);
          } catch (e) {
            // If detection fails, default to false
            isAI = false;
          }
        }

        return {
          id: msg.id,
          content: msg.data?.text || msg.text || '',  // Check both data.text and text (matches Electron)
          sender,
          senderName,
          timestamp: msg.creationTime ? new Date(msg.creationTime).getTime() : Date.now(),
          attachments: msg.data?.attachments || [],
          creationTime: msg.creationTime,
          thinking,  // Include thinking/reasoning trace (for DeepSeek R1, etc.)
          isAI  // Flag to identify AI messages
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
    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        throw new Error('Models not initialized');
      }

      if (!this.nodeOneCore.topicGroupManager) {
        throw new Error('TopicGroupManager not initialized');
      }

      const userId = this.nodeOneCore.ownerId || this.stateManager?.getState('user.id');
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const type = request.type || 'direct';
      const participants = request.participants || [];
      const name = request.name || `Conversation ${Date.now()}`;

      console.error(`[ChatPlan] 🔍 BEFORE createGroupTopic - participants.length: ${participants.length}`);
      console.error(`[ChatPlan] 🔍 BEFORE createGroupTopic - participants:`, participants);

      // Generate deterministic topic ID for the conversation
      // Use Date.now() + random component to prevent burst collisions
      const randomComponent = Math.random().toString(36).substring(2, 8);
      const topicId = `group-${Date.now()}-${randomComponent}-${String(userId).substring(0, 8)}`;

      // Create topic using TopicGroupManager (creates group, grants access, creates owner's channel)
      const topic = await this.nodeOneCore.topicGroupManager.createGroupTopic(
        name,
        topicId,
        participants
      );

      console.error(`[ChatPlan] 🔍 AFTER createGroupTopic - participants.length: ${participants.length}`);
      console.error(`[ChatPlan] 🔍 AFTER createGroupTopic - participants:`, participants);

      // Configure channel for group conversations (one.leute pattern)
      // This ensures Person/Profile objects arriving via CHUM are automatically registered
      if (this.nodeOneCore.channelManager) {
        this.nodeOneCore.channelManager.setChannelSettingsAppendSenderProfile(topicId, true);
        this.nodeOneCore.channelManager.setChannelSettingsRegisterSenderProfileAtLeute(topicId, true);
      }

      // Detect AI participants and register topic automatically
      console.error(`[ChatPlan] createConversation checking ${participants.length} participants for AI:`, participants);
      if (this.nodeOneCore.aiAssistantModel) {
        try {
          for (const participantId of participants) {
            console.error(`[ChatPlan] Checking participant: ${participantId}`);
            if (this.nodeOneCore.aiAssistantModel.isAIPerson(participantId)) {
              const modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(participantId);
              if (modelId) {
                this.nodeOneCore.aiAssistantModel.registerAITopic(topicId, modelId);
                console.error(`[ChatPlan] Detected AI participant ${participantId.substring(0, 8)} with model: ${modelId}`);

                // Trigger welcome message - don't await, but start it NOW (not via setImmediate)
                // This ensures the thinking event fires before IPC returns
                this.nodeOneCore.aiAssistantModel.handleNewTopic(topicId).catch((error: Error) => {
                  console.error('[ChatPlan] Failed to generate welcome message:', error);
                });
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
          participants: [String(userId), ...participants],
          created: Date.now()
        }
      };
    } catch (error) {
      console.error('[ChatPlan] Error creating conversation:', error);
      return {
        success: false,
        error: (error as Error).message
      };
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

      // Convert to conversation format
      const conversations = await Promise.all(
        topics.map(async (topic: any) => {
          const topicId = topic.id;
          const name = topic.name;

          // Get participants from topic group with enriched data (names)
          let participants: any[] = [];
          try {
            let groupIdHash = null;

            if (this.nodeOneCore.topicGroupManager) {
              groupIdHash = await this.nodeOneCore.topicGroupManager.getGroupForTopic(topicId);
            }

            if (!groupIdHash) {
              console.warn(`[ChatPlan] Topic ${topicId} has no group - skipping participant retrieval (old/broken topic)`);
              // Skip topics without groups - they're from old implementations
              // Set empty participants array and continue
              participants = [];
            } else {
              const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
              const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
              const groupResult = await getObjectByIdHash(groupIdHash);
              const group = groupResult.obj as Group;

              if (group.hashGroup) {
                const hashGroup = await getObject(group.hashGroup) as HashGroup;
                if (hashGroup.person) {
                  const participantIds = Array.from(hashGroup.person).map(id => String(id));

                  if (participantIds.length > 0) {
                // Enrich each participant with name from Leute model
                participants = await Promise.all(participantIds.map(async (participantId) => {
                    let name = 'Unknown';

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
                          // Check other contacts
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
                      } catch (error) {
                        console.warn(`[ChatPlan] Could not get name for participant ${participantId}:`, error);
                      }
                    }

                    return {
                      id: participantId,
                      name
                    };
                  }));
                }
              }
            }
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

          // Get AI model info if this is an AI topic
          let aiModelId: string | undefined;
          let modelName: string | undefined;
          let isAITopic = false;

          // Check if topic has an AI model registered
          if (this.nodeOneCore.aiAssistantModel?.topicManager) {
            aiModelId = this.nodeOneCore.aiAssistantModel.topicManager.getModelIdForTopic(topicId);
            if (aiModelId) {
              isAITopic = true;
              // Get model name from LLM manager
              if (this.nodeOneCore.llmManager) {
                const modelInfo = this.nodeOneCore.llmManager.getModel(aiModelId);
                modelName = modelInfo?.name || aiModelId;
              }
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
        })
      );

      // Sort by last activity
      const sortedConversations = conversations.sort((a, b) => b.lastActivity - a.lastActivity);

      // Apply pagination
      const paginatedConversations = sortedConversations.slice(offset, offset + limit);

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
   * Get current user
   */
  async getCurrentUser(request: GetCurrentUserRequest): Promise<GetCurrentUserResponse> {
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
   */
  async addParticipants(request: AddParticipantsRequest): Promise<AddParticipantsResponse> {
    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        throw new Error('Models not initialized');
      }

      // Get topic room
      const topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
      if (!topicRoom) {
        throw new Error(`Topic not found: ${request.conversationId}`);
      }

      // Add participants
      // TODO: Implement actual participant addition logic

      return {
        success: true,
        data: {
          conversationId: request.conversationId,
          addedParticipants: request.participantIds
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

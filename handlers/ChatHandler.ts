/**
 * Chat Handler (Pure Business Logic)
 *
 * Transport-agnostic handler for chat operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Pattern based on refinio.api handler architecture.
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
 * ChatHandler - Pure business logic for chat operations
 *
 * Dependencies injected via constructor:
 * - nodeOneCore: The ONE.core instance with topicModel, leuteModel, etc.
 * - stateManager: State management service
 * - messageVersionManager: Message versioning manager
 * - messageAssertionManager: Message assertion/certificate manager
 */
export class ChatHandler {
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
    console.log('[ChatHandler] Initializing default chats');

    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        return { success: false, error: 'Node not ready' };
      }

      // Don't create any chats here - they should only be created when we have an AI model
      console.log('[ChatHandler] Skipping chat creation - will create when model is selected');

      return { success: true };
    } catch (error) {
      console.error('[ChatHandler] Error initializing default chats:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * UI ready signal
   */
  async uiReady(request: UIReadyRequest): Promise<UIReadyResponse> {
    console.log('[ChatHandler] UI signaled ready for messages');

    try {
      // Notify the PeerMessageListener that UI is ready (platform-specific)
      if (this.nodeOneCore.peerMessageListener) {
        // This will be handled by the platform-specific adapter
        console.log('[ChatHandler] PeerMessageListener available');
      }
      return { success: true };
    } catch (error) {
      console.error('[ChatHandler] Error in uiReady:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    console.log('[ChatHandler] Send message:', { conversationId: request.conversationId, content: request.content });

    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        throw new Error('TopicModel not initialized');
      }

      const userId = this.nodeOneCore.ownerId || this.stateManager?.getState('user.id');
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Validate conversationId
      if (!request.conversationId || typeof request.conversationId !== 'string') {
        throw new Error(`Invalid conversationId: ${request.conversationId}`);
      }

      if (!request.content || request.content.trim().length === 0) {
        throw new Error('Message content cannot be empty');
      }

      // Get topic room
      let topicRoom: any;
      try {
        topicRoom = await this.nodeOneCore.topicModel.enterTopicRoom(request.conversationId);
      } catch (error) {
        console.error('[ChatHandler] Topic does not exist for conversation:', request.conversationId);
        throw new Error(`Topic ${request.conversationId} not found. Topics should be created before sending messages.`);
      }

      // Determine if P2P or group
      const isP2P = request.conversationId.includes('<->');
      const channelOwner = isP2P ? null : this.nodeOneCore.ownerId;

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

      //  **CRITICAL**: Trigger AI response if conversation has AI participant
      // This must happen AFTER the user's message is sent
      if (this.nodeOneCore.aiAssistantModel) {
        const isAITopic = this.nodeOneCore.aiAssistantModel.isAITopic(request.conversationId);
        console.log('[ChatHandler] AI topic check:', { conversationId: request.conversationId, isAITopic });

        if (isAITopic) {
          console.log('[ChatHandler] 🤖 Triggering AI response for topic:', request.conversationId);

          // Trigger AI response in background (don't await - let it stream independently)
          // Using setTimeout(0) for browser compatibility (equivalent to setImmediate in Node.js)
          setTimeout(async () => {
            try {
              await this.nodeOneCore.aiAssistantModel.processMessage(
                request.conversationId,
                request.content,
                userId as any
              );
              console.log('[ChatHandler] ✅ AI response triggered successfully');
            } catch (aiError) {
              console.error('[ChatHandler] ❌ AI response failed:', aiError);
            }
          }, 0);
        }
      }

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
      console.error('[ChatHandler] Error sending message:', error);
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
    console.log('[ChatHandler] Get messages:', request.conversationId);

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
      } catch (error: any) {
        // Topic doesn't exist yet - return empty messages (valid during topic creation)
        if (error.message?.includes('does not exist')) {
          console.log(`[ChatHandler] Topic ${request.conversationId} doesn't exist yet, returning empty messages`);
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

      // Retrieve all messages
      const allMessages = await topicRoom.retrieveAllMessages();
      console.log(`[ChatHandler] 📨 Retrieved ${allMessages.length} messages for topic: ${request.conversationId}`);

      // Debug: Log channel info
      try {
        const channels = this.nodeOneCore.channelManager.getMatchingChannelInfos({channelId: request.conversationId});
        console.log(`[ChatHandler] 📡 Found ${channels.length} channels for topic ${request.conversationId}:`,
          channels.map((ch: any) => ({id: ch.id, owner: ch.owner})));
      } catch (e) {
        console.log('[ChatHandler] ⚠️ Could not query channels:', e);
      }

      // Map ObjectData to UI format - extract the actual message data and look up sender names
      const formattedMessages = await Promise.all(allMessages.map(async (msg: any) => {
        let senderName = 'Unknown';

        // Get sender from either author or data.sender (matches Electron pattern)
        const sender = msg.author || msg.data?.sender;

        // Look up sender name - check AI first (matches Electron pattern at chat.ts:367-420)
        if (sender) {
          try {
            // Check if sender is an AI contact FIRST
            let isAI = false;
            if (this.nodeOneCore.aiAssistantModel) {
              isAI = this.nodeOneCore.aiAssistantModel.isAIPerson(sender);

              if (isAI) {
                // Get the LLM object to find the name
                const llmObjects = this.nodeOneCore.llmObjectManager?.getAllLLMObjects() || [];
                const llmObject = llmObjects.find((obj: any) => {
                  try {
                    return this.nodeOneCore.aiAssistantModel?.matchesLLM(sender, obj);
                  } catch {
                    return false;
                  }
                });

                if (llmObject) {
                  senderName = llmObject.name || llmObject.modelName || llmObject.modelId;
                  if (!senderName) {
                    console.error(`[ChatHandler] LLM object exists but has no name fields: ${JSON.stringify(llmObject)}`);
                    senderName = 'AI Assistant';
                  }
                } else {
                  // LLM object not found - log error but don't crash
                  console.error(`[ChatHandler] AI sender detected but no LLM object found for: ${sender}`);
                  // Try to get modelId from aiAssistantModel
                  const modelId = this.nodeOneCore.aiAssistantModel?.getModelIdForPersonId?.(sender);
                  senderName = modelId || 'AI Assistant';
                }
              }
            }

            // For non-AI senders, get their name from profiles
            if (!isAI && this.nodeOneCore.leuteModel) {
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
                  console.error('[ChatHandler] Failed to get current user name:', e);
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
            console.error('[ChatHandler] Failed to get sender name:', error);
          }
        }

        return {
          id: msg.id,
          content: msg.data?.text || msg.text || '',  // Check both data.text and text (matches Electron)
          sender,
          senderName,
          timestamp: msg.creationTime ? new Date(msg.creationTime).getTime() : Date.now(),
          attachments: msg.data?.attachments || [],
          creationTime: msg.creationTime
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
      console.error('[ChatHandler] Error getting messages:', error);
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
    console.log('[ChatHandler] Create conversation:', request);

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

      // Generate deterministic topic ID for the conversation
      const topicId = `group-${Date.now()}-${String(userId).substring(0, 8)}`;

      // Create topic using TopicGroupManager (creates group, grants access, creates owner's channel)
      const topic = await this.nodeOneCore.topicGroupManager.createGroupTopic(
        name,
        topicId,
        participants
      );

      console.log('[ChatHandler] Created topic with group access:', topicId);

      // Configure channel for group conversations (one.leute pattern)
      // This ensures Person/Profile objects arriving via CHUM are automatically registered
      if (this.nodeOneCore.channelManager) {
        this.nodeOneCore.channelManager.setChannelSettingsAppendSenderProfile(topicId, true);
        this.nodeOneCore.channelManager.setChannelSettingsRegisterSenderProfileAtLeute(topicId, true);
        console.log('[ChatHandler] ✅ Channel settings configured for automatic Person/Profile registration');
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
      console.error('[ChatHandler] Error creating conversation:', error);
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
    console.log('[ChatHandler] Get conversations');

    try {
      if (!this.nodeOneCore.initialized || !this.nodeOneCore.topicModel) {
        throw new Error('TopicModel not initialized');
      }

      const limit = request.limit || 20;
      const offset = request.offset || 0;

      // Get all topics
      const topics = await this.nodeOneCore.topicModel.topics.all();
      console.log(`[ChatHandler] Retrieved ${topics.length} topics:`, topics.map((t: any) => t.id));

      // Convert to conversation format
      const conversations = await Promise.all(
        topics.map(async (topic: any) => {
          const topicId = topic.id;
          const name = topic.name;

          // Check if AI topic
          let isAITopic = false;
          let aiModelId = null;
          if (this.nodeOneCore.aiAssistantModel) {
            isAITopic = this.nodeOneCore.aiAssistantModel.isAITopic(topicId);
            if (isAITopic) {
              aiModelId = this.nodeOneCore.aiAssistantModel.getModelIdForTopic(topicId);
            }
          }

          // Get participants from topic group with enriched data (names, AI info)
          let participants: any[] = [];
          try {
            if (topic.group) {
              // Import getIdObject dynamically to avoid module issues
              const { getIdObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
              const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
              const group = await getIdObject(topic.group) as Group;

              // CRITICAL: NEW one.core structure has hashGroup → HashGroup.members
              if (group.hashGroup) {
                const hashGroup = await getObject(group.hashGroup) as HashGroup;
                if (hashGroup.members) {
                  const participantIds = Array.from(hashGroup.members).map(id => String(id));

                  // Enrich each participant with name and AI info
                  participants = await Promise.all(participantIds.map(async (participantId) => {
                    let name = 'Unknown';
                    let isAI = false;

                    // Check if AI participant
                    if (this.nodeOneCore.aiAssistantModel) {
                      isAI = this.nodeOneCore.aiAssistantModel.isAIPerson(participantId);

                      if (isAI) {
                        // Get AI name from LLM object
                        const llmObjects = this.nodeOneCore.llmObjectManager?.getAllLLMObjects() || [];
                        const llmObject = llmObjects.find((obj: any) => {
                          try {
                            return this.nodeOneCore.aiAssistantModel?.matchesLLM(participantId, obj);
                          } catch {
                            return false;
                          }
                        });

                        if (llmObject) {
                          name = llmObject.name || llmObject.modelName || llmObject.modelId || 'AI Assistant';
                        } else {
                          // Fallback: try to get model ID from aiAssistantModel
                          const modelId = this.nodeOneCore.aiAssistantModel?.getModelIdForPersonId?.(participantId);
                          name = modelId || 'AI Assistant';
                        }
                      }
                    }

                    // Get name from Leute model for non-AI participants
                    if (!isAI && this.nodeOneCore.leuteModel) {
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
                        console.warn(`[ChatHandler] Could not get name for participant ${participantId}:`, error);
                      }
                    }

                    return {
                      id: participantId,
                      name,
                      isAI
                    };
                  }));
                }
              }
            }
          } catch (error) {
            console.warn(`[ChatHandler] Could not fetch participants for topic ${topicId}:`, error);
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

              // Strip [THINKING] and [RESPONSE] tags from AI messages for preview
              // Extract only the response content if structured tags exist
              const responseMatch = lastMessage.match(/\[RESPONSE\]\s*([\s\S]*)(?:\[\/RESPONSE\]|$)/);
              if (responseMatch) {
                lastMessage = responseMatch[1].trim();
              } else {
                // Remove any thinking sections that might be present
                lastMessage = lastMessage.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]\s*/g, '').trim();
              }

              // Truncate message preview to 100 characters
              if (lastMessage.length > 100) {
                lastMessage = lastMessage.substring(0, 100) + '...';
              }
            }
          } catch (error) {
            // If we can't fetch messages, just continue without preview
            console.warn(`[ChatHandler] Could not fetch last message for topic ${topicId}:`, error);
          }

          // Check if any participant is AI
          const hasAIParticipant = participants.some((p: any) => p.isAI);

          // Get model name from AI participant if available, otherwise use model ID
          let modelName: string | null = aiModelId || null;
          if (hasAIParticipant) {
            const aiParticipant = participants.find((p: any) => p.isAI);
            if (aiParticipant?.name) {
              modelName = aiParticipant.name;
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
            hasAIParticipant,
            modelName
          };
        })
      );

      // Sort by last activity
      const sortedConversations = conversations.sort((a, b) => b.lastActivity - a.lastActivity);

      // Apply pagination
      const paginatedConversations = sortedConversations.slice(offset, offset + limit);

      console.log(`[ChatHandler] Returning ${paginatedConversations.length} conversations:`, paginatedConversations.map(c => ({ id: c.id, name: c.name })));

      return {
        success: true,
        data: paginatedConversations
      };
    } catch (error) {
      console.error('[ChatHandler] Error getting conversations:', error);
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
    console.log('[ChatHandler] Get conversation:', request.conversationId);

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

      // Add AI participant info
      if (this.nodeOneCore.aiAssistantModel) {
        const aiContacts = this.nodeOneCore.aiAssistantModel.getAllContacts();

        conversation.isAITopic = this.nodeOneCore.aiAssistantModel.isAITopic(conversation.id);
        conversation.hasAIParticipant = conversation.participants?.some((participantId: string) =>
          aiContacts.some((contact: any) => contact.personId === participantId)
        ) || false;

        if (conversation.isAITopic) {
          conversation.aiModelId = this.nodeOneCore.aiAssistantModel.getModelIdForTopic(conversation.id);
        }
      }

      return {
        success: true,
        data: conversation
      };
    } catch (error) {
      console.error('[ChatHandler] Error getting conversation:', error);
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
    console.log('[ChatHandler] Get current user');

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
          console.warn('[ChatHandler] Could not get user profile:', e);
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
      console.error('[ChatHandler] Error getting current user:', error);
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
    console.log('[ChatHandler] Add participants:', request);

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
      console.log('[ChatHandler] Adding participants:', request.participantIds);

      return {
        success: true,
        data: {
          conversationId: request.conversationId,
          addedParticipants: request.participantIds
        }
      };
    } catch (error) {
      console.error('[ChatHandler] Error adding participants:', error);
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
    console.log('[ChatHandler] Clear conversation:', request.conversationId);

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
      console.log('[ChatHandler] Clearing conversation:', request.conversationId);

      return { success: true };
    } catch (error) {
      console.error('[ChatHandler] Error clearing conversation:', error);
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
    console.log('[ChatHandler] Edit message:', request.messageId);

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
      console.error('[ChatHandler] Error editing message:', error);
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
    console.log('[ChatHandler] Delete message:', request.messageId);

    try {
      if (!this.messageVersionManager) {
        throw new Error('Message version manager not initialized');
      }

      // Mark as deleted
      await this.messageVersionManager.markAsDeleted(request.messageId, request.reason);

      return { success: true };
    } catch (error) {
      console.error('[ChatHandler] Error deleting message:', error);
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
    console.log('[ChatHandler] Get message history:', request.messageId);

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
      console.error('[ChatHandler] Error getting message history:', error);
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
    console.log('[ChatHandler] Export message credential:', request.messageId);

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
      console.error('[ChatHandler] Error exporting credential:', error);
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
    console.log('[ChatHandler] Verify message assertion');

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
      console.error('[ChatHandler] Error verifying assertion:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
}

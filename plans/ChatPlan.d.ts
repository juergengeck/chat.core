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
export interface StoryFactory {
    recordExecution(metadata: any, operation: () => Promise<any>): Promise<any>;
}
export interface GroupPlan {
    createGroup(request: any): Promise<any>;
    getGroupForTopic(request: any): Promise<any>;
    getTopicParticipants(request: any): Promise<any>;
}
export interface InitializeDefaultChatsRequest {
}
export interface InitializeDefaultChatsResponse {
    success: boolean;
    error?: string;
}
export interface UIReadyRequest {
}
export interface UIReadyResponse {
    success: boolean;
    error?: string;
}
export interface SendMessageRequest {
    conversationId: string;
    content: string;
    attachments?: any[];
    senderId?: any;
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
        newConversationId?: string;
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
export declare class ChatPlan {
    static get planId(): string;
    static get planName(): string;
    static get description(): string;
    static get version(): string;
    private nodeOneCore;
    private stateManager;
    private messageVersionManager;
    private messageAssertionManager;
    private groupPlan?;
    private storyFactory?;
    constructor(nodeOneCore: any, stateManager?: any, messageVersionManager?: any, messageAssertionManager?: any, groupPlan?: GroupPlan, storyFactory?: StoryFactory);
    /**
     * Set message managers after initialization
     */
    setMessageManagers(versionManager: any, assertionManager: any): void;
    /**
     * Set GroupPlan after initialization (for gradual adoption)
     */
    setGroupPlan(plan: GroupPlan): void;
    /**
     * Set StoryFactory after initialization (for gradual adoption)
     */
    setStoryFactory(factory: StoryFactory): void;
    /**
     * Get current instance version hash for Story/Assembly tracking
     */
    private getCurrentInstanceVersion;
    /**
     * Initialize default chats
     */
    initializeDefaultChats(_request: InitializeDefaultChatsRequest): Promise<InitializeDefaultChatsResponse>;
    /**
     * UI ready signal
     */
    uiReady(_request: UIReadyRequest): Promise<UIReadyResponse>;
    /**
     * Send a message to a conversation
     */
    sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
    /**
     * Internal implementation of sendMessage (wrapped by Story recording)
     */
    private sendMessageInternal;
    /**
     * Get messages for a conversation
     */
    getMessages(request: GetMessagesRequest): Promise<GetMessagesResponse>;
    /**
     * Create a new conversation
     */
    createConversation(request: CreateConversationRequest): Promise<CreateConversationResponse>;
    /**
     * Internal implementation of createConversation (wrapped by Story+Assembly recording)
     */
    private createConversationInternal;
    /**
     * Get all conversations
     */
    getConversations(request: GetConversationsRequest): Promise<GetConversationsResponse>;
    /**
     * Get a single conversation
     */
    getConversation(request: GetConversationRequest): Promise<GetConversationResponse>;
    /**
     * Create a P2P (one-to-one) conversation
     *
     * Uses P2PTopicService internally to create topic with proper channel setup.
     * All P2P topic creation MUST go through this method - platform code should NOT
     * call P2PTopicService or TopicModel directly.
     */
    createP2PConversation(request: CreateP2PConversationRequest): Promise<CreateP2PConversationResponse>;
    /**
     * Get current user
     */
    getCurrentUser(_request: GetCurrentUserRequest): Promise<GetCurrentUserResponse>;
    /**
     * Add participants to a conversation
     *
     * ARCHITECTURE: Different group = Different chat
     * When participants change, we create a NEW chat with a NEW topicId.
     * This provides conversation continuity from a user perspective while
     * maintaining proper group/topic separation.
     */
    addParticipants(request: AddParticipantsRequest): Promise<AddParticipantsResponse>;
    /**
     * Clear a conversation
     */
    clearConversation(request: ClearConversationRequest): Promise<ClearConversationResponse>;
    /**
     * Edit a message
     */
    editMessage(request: EditMessageRequest): Promise<EditMessageResponse>;
    /**
     * Delete a message
     */
    deleteMessage(request: DeleteMessageRequest): Promise<DeleteMessageResponse>;
    /**
     * Get message history
     */
    getMessageHistory(request: GetMessageHistoryRequest): Promise<GetMessageHistoryResponse>;
    /**
     * Export message credential
     */
    exportMessageCredential(request: ExportMessageCredentialRequest): Promise<ExportMessageCredentialResponse>;
    /**
     * Verify message assertion
     */
    verifyMessageAssertion(request: VerifyMessageAssertionRequest): Promise<VerifyMessageAssertionResponse>;
}
//# sourceMappingURL=ChatPlan.d.ts.map
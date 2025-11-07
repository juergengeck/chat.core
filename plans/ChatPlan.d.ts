/**
 * Chat Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for chat operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Pattern based on refinio.api architecture.
 */
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
export declare class ChatPlan {
    private nodeOneCore;
    private stateManager;
    private messageVersionManager;
    private messageAssertionManager;
    constructor(nodeOneCore: any, stateManager?: any, messageVersionManager?: any, messageAssertionManager?: any);
    /**
     * Set message managers after initialization
     */
    setMessageManagers(versionManager: any, assertionManager: any): void;
    /**
     * Initialize default chats
     */
    initializeDefaultChats(request: InitializeDefaultChatsRequest): Promise<InitializeDefaultChatsResponse>;
    /**
     * UI ready signal
     */
    uiReady(request: UIReadyRequest): Promise<UIReadyResponse>;
    /**
     * Send a message to a conversation
     */
    sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
    /**
     * Get messages for a conversation
     */
    getMessages(request: GetMessagesRequest): Promise<GetMessagesResponse>;
    /**
     * Create a new conversation
     */
    createConversation(request: CreateConversationRequest): Promise<CreateConversationResponse>;
    /**
     * Get all conversations
     */
    getConversations(request: GetConversationsRequest): Promise<GetConversationsResponse>;
    /**
     * Get a single conversation
     */
    getConversation(request: GetConversationRequest): Promise<GetConversationResponse>;
    /**
     * Get current user
     */
    getCurrentUser(request: GetCurrentUserRequest): Promise<GetCurrentUserResponse>;
    /**
     * Add participants to a conversation
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
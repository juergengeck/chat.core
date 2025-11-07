/**
 * Feed-Forward Plan (Pure Business Logic)
 *
 * Transport-agnostic plan for feed-forward knowledge sharing operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Wraps FeedForwardManager with standardized request/response interfaces.
 */
export interface CreateSupplyRequest {
    keywords: string[];
    contextLevel: number;
    conversationId: string;
    metadata?: any;
}
export interface CreateSupplyResponse {
    success: boolean;
    error?: string;
    data?: any;
}
export interface CreateDemandRequest {
    keywords: string[];
    urgency: number;
    context: string;
    criteria?: any;
    expires?: number;
    maxResults?: number;
}
export interface CreateDemandResponse {
    success: boolean;
    error?: string;
    data?: any;
}
export interface MatchSupplyDemandRequest {
    demandHash: string;
    minTrust?: number;
    limit?: number;
}
export interface MatchSupplyDemandResponse {
    success: boolean;
    error?: string;
    data?: any;
}
export interface UpdateTrustRequest {
    participantId: string;
    adjustment: number;
    reason: string;
    evidence?: any;
}
export interface UpdateTrustResponse {
    success: boolean;
    error?: string;
    data?: any;
}
export interface GetCorpusStreamRequest {
    since?: number;
    minQuality?: number;
    keywords?: string[];
}
export interface GetCorpusStreamResponse {
    success: boolean;
    error?: string;
    data?: any;
}
export interface EnableSharingRequest {
    conversationId: string;
    enabled: boolean;
    retroactive?: boolean;
}
export interface EnableSharingResponse {
    success: boolean;
    error?: string;
    data?: any;
}
export interface GetTrustScoreRequest {
    participantId: string;
}
export interface GetTrustScoreResponse {
    success: boolean;
    error?: string;
    trustScore?: number;
    data?: any;
}
/**
 * FeedForwardPlan - Pure business logic for feed-forward operations
 *
 * Dependencies are injected via constructor to support both platforms:
 * - feedForwardManager: Platform-specific FeedForwardManager instance
 */
export declare class FeedForwardPlan {
    private feedForwardManager;
    constructor(feedForwardManager: any);
    /**
     * Create Supply object for knowledge sharing
     */
    createSupply(request: CreateSupplyRequest): Promise<CreateSupplyResponse>;
    /**
     * Create Demand object for knowledge needs
     */
    createDemand(request: CreateDemandRequest): Promise<CreateDemandResponse>;
    /**
     * Match Supply with Demand based on keywords and trust
     */
    matchSupplyDemand(request: MatchSupplyDemandRequest): Promise<MatchSupplyDemandResponse>;
    /**
     * Update trust score for a participant
     */
    updateTrust(request: UpdateTrustRequest): Promise<UpdateTrustResponse>;
    /**
     * Get corpus stream of available knowledge
     */
    getCorpusStream(request?: GetCorpusStreamRequest): Promise<GetCorpusStreamResponse>;
    /**
     * Enable or disable sharing for a conversation
     */
    enableSharing(request: EnableSharingRequest): Promise<EnableSharingResponse>;
    /**
     * Get trust score for a participant
     */
    getTrustScore(request: GetTrustScoreRequest): Promise<GetTrustScoreResponse>;
}
//# sourceMappingURL=FeedForwardPlan.d.ts.map
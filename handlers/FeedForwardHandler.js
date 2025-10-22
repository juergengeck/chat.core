/**
 * Feed-Forward Handler (Pure Business Logic)
 *
 * Transport-agnostic handler for feed-forward knowledge sharing operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 * Wraps FeedForwardManager with standardized request/response interfaces.
 */
/**
 * FeedForwardHandler - Pure business logic for feed-forward operations
 *
 * Dependencies are injected via constructor to support both platforms:
 * - feedForwardManager: Platform-specific FeedForwardManager instance
 */
export class FeedForwardHandler {
    feedForwardManager;
    constructor(feedForwardManager) {
        this.feedForwardManager = feedForwardManager;
    }
    /**
     * Create Supply object for knowledge sharing
     */
    async createSupply(request) {
        if (!this.feedForwardManager) {
            return { success: false, error: 'Feed-forward manager not initialized' };
        }
        try {
            const result = await this.feedForwardManager.createSupply(request);
            return result;
        }
        catch (error) {
            console.error('[FeedForwardHandler] Error creating supply:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error creating supply'
            };
        }
    }
    /**
     * Create Demand object for knowledge needs
     */
    async createDemand(request) {
        if (!this.feedForwardManager) {
            return { success: false, error: 'Feed-forward manager not initialized' };
        }
        try {
            const result = await this.feedForwardManager.createDemand(request);
            return result;
        }
        catch (error) {
            console.error('[FeedForwardHandler] Error creating demand:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error creating demand'
            };
        }
    }
    /**
     * Match Supply with Demand based on keywords and trust
     */
    async matchSupplyDemand(request) {
        if (!this.feedForwardManager) {
            return { success: false, error: 'Feed-forward manager not initialized' };
        }
        try {
            const result = await this.feedForwardManager.matchSupplyDemand(request);
            return result;
        }
        catch (error) {
            console.error('[FeedForwardHandler] Error matching supply/demand:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error matching supply/demand'
            };
        }
    }
    /**
     * Update trust score for a participant
     */
    async updateTrust(request) {
        if (!this.feedForwardManager) {
            return { success: false, error: 'Feed-forward manager not initialized' };
        }
        try {
            const result = await this.feedForwardManager.updateTrust(request);
            return result;
        }
        catch (error) {
            console.error('[FeedForwardHandler] Error updating trust:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error updating trust'
            };
        }
    }
    /**
     * Get corpus stream of available knowledge
     */
    async getCorpusStream(request = {}) {
        if (!this.feedForwardManager) {
            return { success: false, error: 'Feed-forward manager not initialized' };
        }
        try {
            const result = await this.feedForwardManager.getCorpusStream(request);
            return result;
        }
        catch (error) {
            console.error('[FeedForwardHandler] Error getting corpus stream:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error getting corpus stream'
            };
        }
    }
    /**
     * Enable or disable sharing for a conversation
     */
    async enableSharing(request) {
        if (!this.feedForwardManager) {
            return { success: false, error: 'Feed-forward manager not initialized' };
        }
        try {
            const result = await this.feedForwardManager.enableSharing(request);
            return result;
        }
        catch (error) {
            console.error('[FeedForwardHandler] Error updating sharing:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error updating sharing'
            };
        }
    }
    /**
     * Get trust score for a participant
     */
    async getTrustScore(request) {
        if (!this.feedForwardManager) {
            return { success: false, error: 'Feed-forward manager not initialized' };
        }
        try {
            const result = await this.feedForwardManager.getTrustScore(request.participantId);
            return { success: true, ...result };
        }
        catch (error) {
            console.error('[FeedForwardHandler] Error getting trust score:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error getting trust score'
            };
        }
    }
}
//# sourceMappingURL=FeedForwardHandler.js.map
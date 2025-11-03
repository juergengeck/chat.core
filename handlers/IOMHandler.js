/**
 * IOM Handler (Pure Business Logic)
 *
 * Transport-agnostic handler for IoM operations.
 * Delegates to one.models ConnectionsModel and ChannelManager.
 * Platform-specific operations (fs, storage) are injected.
 *
 * Can be used from both Electron IPC and Web Worker contexts.
 */
/**
 * IOMHandler - Pure business logic for IoM operations
 *
 * Dependencies are injected via constructor to support both platforms:
 * - nodeOneCore: Platform-specific ONE.core instance
 * - storageProvider: Platform-specific storage info provider (optional)
 * - webUrl: Base URL for invitation web app (e.g., http://localhost:5173 for dev, https://lama.one for prod)
 */
export class IOMHandler {
    nodeOneCore;
    storageProvider;
    webUrl;
    constructor(nodeOneCore, storageProvider, webUrl) {
        this.nodeOneCore = nodeOneCore;
        this.storageProvider = storageProvider;
        this.webUrl = webUrl;
    }
    /**
     * Get IOM instances - delegates to one.models
     */
    async getIOMInstances(request) {
        try {
            const instances = [];
            // Get node instance info from ONE.core
            if (this.nodeOneCore.initialized) {
                const coreInfo = this.nodeOneCore.getInfo();
                // Get connection status from ConnectionsModel
                const connectionStatus = this.getConnectionStatusFromModel();
                const nodeInstance = {
                    id: coreInfo?.ownerId || 'node-' + Date.now(),
                    name: 'Desktop Node',
                    type: 'node',
                    role: 'archive',
                    status: connectionStatus.syncing ? 'syncing' : (coreInfo?.initialized ? 'online' : 'offline'),
                    endpoint: 'local',
                    storage: this.storageProvider ? await this.storageProvider.getNodeStorage() : this.getDefaultStorage(),
                    lastSync: null, // Would come from ChannelManager sync history
                    replication: {
                        inProgress: connectionStatus.syncing,
                        lastCompleted: null,
                        queueSize: 0,
                        failedItems: 0,
                        errors: []
                    }
                };
                instances.push(nodeInstance);
            }
            return { instances };
        }
        catch (error) {
            console.error('[IOMHandler] Failed to get instances:', error);
            throw error;
        }
    }
    /**
     * Create pairing invitation - delegates to ConnectionsModel.pairing
     * Supports both IoM (device) and IoP (partner) invitation types
     */
    async createPairingInvitation(request) {
        try {
            if (!this.nodeOneCore.initialized) {
                return {
                    success: false,
                    error: 'Node instance not initialized. Please login first.'
                };
            }
            if (!this.nodeOneCore.connectionsModel?.pairing) {
                return {
                    success: false,
                    error: 'Pairing not available. Node instance may not be fully initialized.'
                };
            }
            // Default to IoP (partner) if not specified
            const mode = request.mode || 'IoP';
            console.log(`[IOMHandler] Creating ${mode} pairing invitation via ConnectionsModel...`);
            // Use one.models pairing API
            const invitation = await this.nodeOneCore.connectionsModel.pairing.createInvitation();
            if (!invitation) {
                return {
                    success: false,
                    error: 'Failed to create pairing invitation'
                };
            }
            console.log('[IOMHandler] Invitation created:', {
                mode,
                url: invitation.url,
                publicKey: invitation.publicKey
            });
            // Encode the entire invitation object for the URL fragment
            const invitationToken = encodeURIComponent(JSON.stringify(invitation));
            // Use web URL from request, then constructor, then derive from commServer
            let baseUrl;
            if (request.webUrl) {
                baseUrl = request.webUrl;
            }
            else if (this.webUrl) {
                baseUrl = this.webUrl;
            }
            else {
                // Fallback: use lama.one
                baseUrl = 'https://lama.one';
            }
            // Construct the invitation URL with proper path based on mode
            // IoM: /invites/inviteDevice/?invited=true (for device pairing)
            // IoP: /invites/invitePartner/?invited=true (for partner pairing)
            const invitePath = mode === 'IoM' ? 'inviteDevice' : 'invitePartner';
            const invitationUrl = `${baseUrl}/invites/${invitePath}/?invited=true/#${invitationToken}`;
            console.log('[IOMHandler] Generated invitation URL:', {
                webUrl: this.webUrl,
                baseUrl,
                mode,
                invitePath
            });
            return {
                success: true,
                invitation: {
                    url: invitationUrl,
                    token: invitationToken,
                    mode
                }
            };
        }
        catch (error) {
            console.error('[IOMHandler] Failed to create pairing invitation:', error);
            return {
                success: false,
                error: error.message || 'Failed to create pairing invitation'
            };
        }
    }
    /**
     * Accept pairing invitation - delegates to ConnectionsModel.pairing
     * Fails fast on errors (no retries)
     */
    async acceptPairingInvitation(request) {
        try {
            if (!this.nodeOneCore.initialized) {
                return {
                    success: false,
                    error: 'Node instance not initialized. Please login first.'
                };
            }
            if (!this.nodeOneCore.connectionsModel?.pairing) {
                return {
                    success: false,
                    error: 'Pairing not available. Node instance may not be fully initialized.'
                };
            }
            console.log('[IOMHandler] Accepting pairing invitation:', request.invitationUrl);
            // Parse the invitation from the URL fragment
            const hashIndex = request.invitationUrl.indexOf('#');
            if (hashIndex === -1) {
                return {
                    success: false,
                    error: 'Invalid invitation URL: no fragment found'
                };
            }
            const fragment = request.invitationUrl.substring(hashIndex + 1);
            const invitationJson = decodeURIComponent(fragment);
            let invitation;
            try {
                invitation = JSON.parse(invitationJson);
            }
            catch (error) {
                console.error('[IOMHandler] Failed to parse invitation:', error);
                return {
                    success: false,
                    error: 'Invalid invitation format'
                };
            }
            const { token, url } = invitation;
            if (!token || !url) {
                return {
                    success: false,
                    error: 'Invalid invitation: missing token or URL'
                };
            }
            console.log('[IOMHandler] Accepting invitation with token:', String(token).substring(0, 20) + '...');
            console.log('[IOMHandler] Connection URL:', url);
            // Use one.models pairing API - fail fast, no retries
            await this.nodeOneCore.connectionsModel.pairing.connectUsingInvitation(invitation);
            console.log('[IOMHandler] ✅ Connected using invitation');
            return {
                success: true,
                message: 'Invitation accepted successfully'
            };
        }
        catch (error) {
            console.error('[IOMHandler] Failed to accept invitation:', error);
            return {
                success: false,
                error: error.message || 'Failed to accept pairing invitation'
            };
        }
    }
    /**
     * Get connection status - delegates to ConnectionsModel
     */
    async getConnectionStatus(request) {
        try {
            const status = this.getConnectionStatusFromModel();
            return status;
        }
        catch (error) {
            console.error('[IOMHandler] Failed to get connection status:', error);
            return {
                connections: [],
                syncing: false
            };
        }
    }
    /**
     * Helper: Get connection status from ConnectionsModel
     */
    getConnectionStatusFromModel() {
        if (!this.nodeOneCore.connectionsModel) {
            return { connections: [], syncing: false };
        }
        // Use one.models APIs to get connection state
        const connections = [];
        let syncing = false;
        // ConnectionsModel tracks active connections
        if (this.nodeOneCore.connectionsModel.getActiveConnections) {
            const activeConnections = this.nodeOneCore.connectionsModel.getActiveConnections();
            connections.push(...activeConnections);
            syncing = activeConnections.length > 0;
        }
        return { connections, syncing };
    }
    /**
     * Helper: Get default storage info when provider not available
     */
    getDefaultStorage() {
        return {
            used: 0,
            total: 0,
            percentage: 0
        };
    }
}
//# sourceMappingURL=IOMHandler.js.map
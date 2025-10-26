/**
 * Connection Handler (Pure Business Logic)
 *
 * Transport-agnostic handler for connection, pairing, and instance management operations.
 * Handles both device pairing (IoM) and partner pairing (IoP).
 * Delegates to one.models ConnectionsModel and ChannelManager.
 * Platform-specific operations (fs, storage) are injected.
 *
 * Can be used from both Electron IPC and Web Worker contexts.
 */

// Request/Response interfaces
export interface GetInstancesRequest {}

export interface GetInstancesResponse {
  instances: Instance[];
}

export interface Instance {
  id: string;
  name: string;
  type: string;
  role: string;
  status: string;
  endpoint: string;
  storage: StorageInfo;
  lastSync: string | null;
  replication: ReplicationInfo;
}

export interface StorageInfo {
  used: number;
  total: number;
  percentage: number;
}

export interface ReplicationInfo {
  inProgress: boolean;
  lastCompleted: string | null;
  queueSize: number;
  failedItems: number;
  errors: any[];
}

export interface CreatePairingInvitationRequest {
  mode?: 'IoM' | 'IoP'; // IoM = device pairing, IoP = partner pairing (default)
  webUrl?: string; // Base URL for invitation web app (overrides constructor value)
}

export interface CreatePairingInvitationResponse {
  success: boolean;
  invitation?: {
    url: string;
    token: string;
    mode: 'IoM' | 'IoP';
  };
  error?: string;
}

export interface AcceptPairingInvitationRequest {
  invitationUrl: string;
}

export interface AcceptPairingInvitationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface GetConnectionStatusRequest {}

export interface GetConnectionStatusResponse {
  connections: any[];
  syncing: boolean;
}

/**
 * ConnectionHandler - Pure business logic for connection, pairing, and instance management
 *
 * Dependencies are injected via constructor to support both platforms:
 * - nodeOneCore: Platform-specific ONE.core instance
 * - storageProvider: Platform-specific storage info provider (optional)
 * - webUrl: Base URL for invitation web app (e.g., http://localhost:5173 for dev, https://lama.one for prod)
 */
export class ConnectionHandler {
  private nodeOneCore: any;
  private storageProvider: any;
  private webUrl?: string;

  constructor(nodeOneCore: any, storageProvider?: any, webUrl?: string) {
    this.nodeOneCore = nodeOneCore;
    this.storageProvider = storageProvider;
    this.webUrl = webUrl;
  }

  /**
   * Get instances - delegates to one.models
   */
  async getInstances(request: GetInstancesRequest): Promise<GetInstancesResponse> {
    try {
      const instances: Instance[] = [];

      // Get node instance info from ONE.core
      if (this.nodeOneCore.initialized) {
        const coreInfo = this.nodeOneCore.getInfo();

        // Get connection status from ConnectionsModel
        const connectionStatus = this.getConnectionStatusFromModel();

        const nodeInstance: Instance = {
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
    } catch (error) {
      console.error('[ConnectionHandler] Failed to get instances:', error);
      throw error;
    }
  }

  /**
   * Create pairing invitation - delegates to ConnectionsModel.pairing
   * Supports both IoM (device) and IoP (partner) invitation types
   */
  async createPairingInvitation(request: CreatePairingInvitationRequest): Promise<CreatePairingInvitationResponse> {
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

      console.log(`[ConnectionHandler] Creating ${mode} pairing invitation via ConnectionsModel...`);

      // Use one.models pairing API
      const invitation = await this.nodeOneCore.connectionsModel.pairing.createInvitation();

      if (!invitation) {
        return {
          success: false,
          error: 'Failed to create pairing invitation'
        };
      }

      console.log('[ConnectionHandler] Invitation created:', {
        mode,
        url: invitation.url,
        publicKey: invitation.publicKey
      });

      // Encode the entire invitation object for the URL fragment
      const invitationToken = encodeURIComponent(JSON.stringify(invitation));

      // Use web URL from request, then constructor, then derive from commServer
      let baseUrl: string;
      if (request.webUrl) {
        baseUrl = request.webUrl;
      } else if (this.webUrl) {
        baseUrl = this.webUrl;
      } else {
        // Fallback: derive from commServer URL
        const commServerUrl = invitation.url || '';
        const eddaDomain = commServerUrl.includes('dev.refinio.one')
          ? 'edda.dev.refinio.one'
          : 'edda.one';
        baseUrl = `https://${eddaDomain}`;
      }

      // Construct the invitation URL with proper path based on mode
      // IoM: /invites/inviteDevice/?invited=true (for device pairing)
      // IoP: /invites/invitePartner/?invited=true (for partner pairing)
      const invitePath = mode === 'IoM' ? 'inviteDevice' : 'invitePartner';
      const invitationUrl = `${baseUrl}/invites/${invitePath}/?invited=true/#${invitationToken}`;

      console.log('[ConnectionHandler] Generated invitation URL:', {
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
    } catch (error) {
      console.error('[ConnectionHandler] Failed to create pairing invitation:', error);
      return {
        success: false,
        error: (error as Error).message || 'Failed to create pairing invitation'
      };
    }
  }

  /**
   * Accept pairing invitation - delegates to ConnectionsModel.pairing
   * Includes retry logic for reliability (following one.leute pattern)
   */
  async acceptPairingInvitation(request: AcceptPairingInvitationRequest): Promise<AcceptPairingInvitationResponse> {
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

      console.log('[ConnectionHandler] Accepting pairing invitation:', request.invitationUrl);

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

      let invitation: any;
      try {
        invitation = JSON.parse(invitationJson);
      } catch (error) {
        console.error('[ConnectionHandler] Failed to parse invitation:', error);
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

      console.log('[ConnectionHandler] Accepting invitation with token:', String(token).substring(0, 20) + '...');
      console.log('[ConnectionHandler] Connection URL:', url);

      // Retry logic following one.leute pattern
      const maxTries = 4;
      const retryDelay = 2000; // 2 seconds
      let lastError: Error | undefined;

      for (let i = 0; i <= maxTries; i++) {
        try {
          // Use one.models pairing API
          await this.nodeOneCore.connectionsModel.pairing.connectUsingInvitation(invitation);

          console.log('[ConnectionHandler] ✅ Connected using invitation');

          return {
            success: true,
            message: 'Invitation accepted successfully'
          };
        } catch (error) {
          console.error(`[ConnectionHandler] Pairing attempt ${i + 1}/${maxTries + 1} failed:`, error);
          lastError = error as Error;

          // Wait before retry (except on last attempt)
          if (i < maxTries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }

      // All retries failed
      console.error('[ConnectionHandler] ❌ Failed to accept invitation after all retries');
      return {
        success: false,
        error: lastError?.message || 'Failed to accept pairing invitation after all retries'
      };
    } catch (error) {
      console.error('[ConnectionHandler] Failed to accept invitation:', error);
      return {
        success: false,
        error: (error as Error).message || 'Failed to accept pairing invitation'
      };
    }
  }

  /**
   * Get connection status - delegates to ConnectionsModel
   */
  async getConnectionStatus(request: GetConnectionStatusRequest): Promise<GetConnectionStatusResponse> {
    try {
      const status = this.getConnectionStatusFromModel();
      return status;
    } catch (error) {
      console.error('[ConnectionHandler] Failed to get connection status:', error);
      return {
        connections: [],
        syncing: false
      };
    }
  }

  /**
   * Helper: Get connection status from ConnectionsModel
   */
  private getConnectionStatusFromModel(): GetConnectionStatusResponse {
    if (!this.nodeOneCore.connectionsModel) {
      return { connections: [], syncing: false };
    }

    // Use one.models APIs to get connection state
    const connections: any[] = [];
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
  private getDefaultStorage(): StorageInfo {
    return {
      used: 0,
      total: 0,
      percentage: 0
    };
  }
}

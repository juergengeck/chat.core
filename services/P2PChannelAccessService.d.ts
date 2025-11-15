/**
 * Grant access to a P2P channel for the two participants
 *
 * @param {string} channelId - The P2P channel ID (format: id1<->id2)
 * @param {string} person1 - First participant's person ID
 * @param {string} person2 - Second participant's person ID
 * @param {Object} channelManager - The ChannelManager instance
 */
export declare function grantP2PChannelAccess(channelId: any, person1: any, person2: any, channelManager: any): Promise<any>;
/**
 * Handle P2P channel creation with proper access control
 * Called when a P2P topic is created
 *
 * @param {string} channelId - The P2P channel ID
 * @param {Object} leuteModel - The LeuteModel instance
 * @param {Object} channelManager - The ChannelManager instance
 */
export declare function handleP2PChannelCreation(channelId: any, leuteModel: any, channelManager: any): Promise<any>;
/**
 * Monitor for new P2P channels and grant proper access
 *
 * @param {Object} channelManager - The ChannelManager instance
 * @param {Object} leuteModel - The LeuteModel instance
 */
export declare function monitorP2PChannels(channelManager: any, leuteModel: any): any;
//# sourceMappingURL=P2PChannelAccessService.d.ts.map
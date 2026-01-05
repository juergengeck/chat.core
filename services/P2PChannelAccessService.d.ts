/**
 * Grant access to a P2P channel for the two participants
 *
 * @param {string} person1 - First participant's person ID
 * @param {string} person2 - Second participant's person ID
 * @param {Object} channelManager - The ChannelManager instance
 */
export declare function grantP2PChannelAccess(person1: any, person2: any, channelManager: any): Promise<any>;
/**
 * Handle P2P channel creation with proper access control
 * Called when a P2P topic is created
 *
 * @param {string} topicId - The P2P topic ID (format: id1<->id2)
 * @param {Object} leuteModel - The LeuteModel instance
 * @param {Object} channelManager - The ChannelManager instance
 */
export declare function handleP2PChannelCreation(topicId: any, leuteModel: any, channelManager: any): Promise<any>;
/**
 * Monitor for new P2P channels and grant proper access
 *
 * NOTE: With the new participants-based ChannelInfo schema, P2P channels are
 * identified by having exactly 2 participants and null owner. The callback
 * signature has changed to receive participantsHash instead of channelId.
 *
 * @param {Object} channelManager - The ChannelManager instance
 * @param {Object} leuteModel - The LeuteModel instance
 */
export declare function monitorP2PChannels(channelManager: any, leuteModel: any): any;
//# sourceMappingURL=P2PChannelAccessService.d.ts.map
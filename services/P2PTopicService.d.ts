/**
 * P2P Topic Service
 *
 * Platform-agnostic service for creating and managing P2P (one-to-one) topics/channels.
 * Used by platforms after successful pairing to enable immediate messaging.
 */
/**
 * Create a P2P topic for two participants
 *
 * @param topicModel - The TopicModel instance
 * @param localPersonId - Local person ID
 * @param remotePersonId - Remote person ID
 * @returns Object with { topicRoom, wasCreated } where wasCreated is true if newly created
 */
export declare function createP2PTopic(topicModel: any, localPersonId: any, remotePersonId: any): Promise<{
    topicRoom: any;
    wasCreated: boolean;
}>;
/**
 * Automatically create P2P topic after pairing success
 *
 * @param params - Parameters
 * @param params.topicModel - TopicModel instance
 * @param params.channelManager - ChannelManager instance
 * @param params.localPersonId - Local person ID
 * @param params.remotePersonId - Remote person ID
 * @param params.initiatedLocally - Whether we initiated the pairing
 * @param params.sendWelcomeMessage - Whether to send welcome message (default: true for initiator)
 * @returns The created topic room
 */
export declare function autoCreateP2PTopicAfterPairing(params: {
    topicModel: any;
    channelManager: any;
    localPersonId: any;
    remotePersonId: any;
    initiatedLocally: boolean;
    sendWelcomeMessage?: boolean;
}): Promise<any>;
/**
 * Handle incoming messages for P2P topics that don't exist yet
 *
 * @param params - Parameters
 * @param params.topicModel - TopicModel instance
 * @param params.channelManager - ChannelManager instance
 * @param params.leuteModel - LeuteModel instance
 * @param params.channelId - The channel ID where message was received
 * @param params.message - The received message
 * @returns The topic room
 */
export declare function ensureP2PTopicForIncomingMessage(params: {
    topicModel: any;
    channelManager: any;
    leuteModel: any;
    channelId: string;
    message: any;
}): Promise<any>;
//# sourceMappingURL=P2PTopicService.d.ts.map
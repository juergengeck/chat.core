/**
 * P2P Channel Access Manager
 *
 * Handles access control for P2P (peer-to-peer) channels.
 * P2P channels should only be accessible to the two participants,
 * not to groups like "everyone".
 */
import { createAccess } from '@refinio/one.core/lib/access.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
/**
 * Grant access to a P2P channel for the two participants
 *
 * @param {string} person1 - First participant's person ID
 * @param {string} person2 - Second participant's person ID
 * @param {Object} channelManager - The ChannelManager instance
 */
export async function grantP2PChannelAccess(person1, person2, channelManager) {
    console.log('[P2PChannelAccess] Granting access for P2P channel');
    console.log('[P2PChannelAccess]   Person 1:', person1?.substring(0, 8));
    console.log('[P2PChannelAccess]   Person 2:', person2?.substring(0, 8));
    try {
        // P2P channels have null owner (shared channel)
        const channelOwner = null;
        // Sort participants for consistent ordering
        const participants = person1 < person2
            ? [person1, person2]
            : [person2, person1];
        // Ensure the channel exists with participants array
        const channelResult = await channelManager.createChannel(participants, channelOwner);
        // Grant access to both participants individually (not via groups)
        await createAccess([{
                id: channelResult.channelInfoIdHash,
                person: [person1, person2], // Only these two people
                group: [], // NO group access!
                mode: SET_ACCESS_MODE.ADD
            }]);
        console.log('[P2PChannelAccess] ✅ Access granted to P2P channel for both participants');
        // Note: We should NOT try to grant access to Topic object here
        // Topic is a versioned object and access is handled by TopicModel itself
        // when createOneToOneTopic is called
        return channelResult;
    }
    catch (error) {
        // Access might already exist, that's ok
        if (!error.message?.includes('already exists')) {
            console.error('[P2PChannelAccess] Failed to grant P2P channel access:', error);
            throw error;
        }
    }
}
/**
 * Handle P2P channel creation with proper access control
 * Called when a P2P topic is created
 *
 * @param {string} topicId - The P2P topic ID (format: id1<->id2)
 * @param {Object} leuteModel - The LeuteModel instance
 * @param {Object} channelManager - The ChannelManager instance
 */
export async function handleP2PChannelCreation(topicId, leuteModel, channelManager) {
    console.log('[P2PChannelAccess] Handling P2P channel creation for topic:', topicId);
    // Extract person IDs from topic ID (format: id1<->id2)
    if (!topicId.includes('<->')) {
        console.log('[P2PChannelAccess] Not a P2P channel, skipping');
        return;
    }
    const [id1, id2] = topicId.split('<->');
    // Get our own person ID
    const me = await leuteModel.me();
    const myPersonId = await me.mainIdentity();
    // Determine which ID is ours and which is the peer's
    let ourId, peerId;
    if (myPersonId === id1) {
        ourId = id1;
        peerId = id2;
    }
    else if (myPersonId === id2) {
        ourId = id2;
        peerId = id1;
    }
    else {
        console.warn('[P2PChannelAccess] Channel does not include our person ID');
        return;
    }
    // Grant access to both participants
    await grantP2PChannelAccess(ourId, peerId, channelManager);
}
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
export function monitorP2PChannels(channelManager, leuteModel) {
    console.log('[P2PChannelAccess] Monitoring for new P2P channels...');
    // Listen for channel updates
    // New callback signature: (channelInfoIdHash, participantsHash, channelOwner, timeOfEarliestChange, data)
    channelManager.onUpdated(async (channelInfoIdHash, participantsHash, channelOwner, timeOfEarliestChange, data) => {
        // P2P channels have null owner (shared channel)
        // We can't easily determine P2P from participantsHash alone without fetching
        // Skip if owner is set (not a P2P channel)
        if (channelOwner !== null && channelOwner !== undefined) {
            return;
        }
        console.log('[P2PChannelAccess] Null-owner channel update detected, participantsHash:', participantsHash?.substring(0, 8));
        // Note: P2P channel access is now primarily handled during creation
        // in P2PTopicService. This monitor is for catching any missed cases.
        // Since we can't extract person IDs from participantsHash without fetching,
        // we log for debugging purposes.
    });
}
//# sourceMappingURL=P2PChannelAccessService.js.map
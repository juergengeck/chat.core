/**
 * P2P Topic Service
 *
 * Platform-agnostic service for creating and managing P2P (one-to-one) topics/channels.
 * Used by platforms after successful pairing to enable immediate messaging.
 */

// Import ONE.core access functions
import { createAccess } from '@refinio/one.core/lib/access.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
import { storeUnversionedObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';

/**
 * Create a P2P topic for two participants
 *
 * @param topicModel - The TopicModel instance
 * @param localPersonId - Local person ID
 * @param remotePersonId - Remote person ID
 * @returns Object with { topicRoom, wasCreated } where wasCreated is true if newly created
 */
export async function createP2PTopic(topicModel: any, localPersonId: any, remotePersonId: any): Promise<{ topicRoom: any; wasCreated: boolean }> {
  // Generate P2P topic ID (lexicographically sorted for consistency)
  const topicId = localPersonId < remotePersonId
    ? `${localPersonId}<->${remotePersonId}`
    : `${remotePersonId}<->${localPersonId}`

  console.log('[P2PTopicService] Creating P2P topic:', topicId)
  console.log('[P2PTopicService]   Local person:', localPersonId?.substring(0, 8))
  console.log('[P2PTopicService]   Remote person:', remotePersonId?.substring(0, 8))

  try {
    // Check if topic already exists
    const existingTopicRoom = await topicModel.enterTopicRoom(topicId)
    if (existingTopicRoom) {
      console.log('[P2PTopicService] Topic already exists:', topicId)
      return { topicRoom: existingTopicRoom, wasCreated: false }
    }
  } catch (error) {
    // Topic doesn't exist, proceed to create it
    console.log('[P2PTopicService] Topic does not exist yet, creating...')
  }

  try {
    // Create the P2P topic using TopicModel's createOneToOneTopic
    // This method properly handles:
    // - Creating a shared channel (null owner)
    // - Setting up proper access for both participants
    // - Creating the Topic object
    const topic = await topicModel.createOneToOneTopic(localPersonId, remotePersonId)

    console.log('[P2PTopicService] ✅ P2P topic created successfully:', topicId)

    // Enter the topic room to verify it's working
    const topicRoom = await topicModel.enterTopicRoom(topicId)
    console.log('[P2PTopicService] ✅ Successfully entered topic room')

    return { topicRoom, wasCreated: true }
  } catch (error) {
    console.error('[P2PTopicService] Failed to create P2P topic:', error)
    throw error
  }
}

/**
 * Grant access to a P2P channel for the two participants
 *
 * @param channelInfoIdHash - The channel info ID hash from createChannel result
 * @param person1 - First participant's person ID
 * @param person2 - Second participant's person ID
 * @returns Promise<void>
 */
async function grantP2PChannelAccess(channelInfoIdHash: any, person1: any, person2: any): Promise<void> {
  console.log('[P2PTopicService] Granting access for P2P channel:', channelInfoIdHash?.substring(0, 8));
  console.log('[P2PTopicService]   Person 1:', person1?.substring(0, 8));
  console.log('[P2PTopicService]   Person 2:', person2?.substring(0, 8));

  try {
    // Grant access to both participants individually (not via groups)
    await createAccess([{
      id: channelInfoIdHash,
      person: [person1, person2], // Only these two people
      group: [], // NO group access!
      mode: SET_ACCESS_MODE.ADD
    }]);

    console.log('[P2PTopicService] ✅ Access granted to P2P channel for both participants');

  } catch (error) {
    // Access might already exist, that's ok
    if (!(error as Error).message?.includes('already exists')) {
      console.error('[P2PTopicService] Failed to grant P2P channel access:', error);
      throw error;
    }
  }
}

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
export async function autoCreateP2PTopicAfterPairing(params: {
  topicModel: any;
  channelManager: any;
  localPersonId: any;
  remotePersonId: any;
  initiatedLocally: boolean;
  sendWelcomeMessage?: boolean;
}): Promise<any> {
  const {
    topicModel,
    channelManager,
    localPersonId,
    remotePersonId,
    initiatedLocally,
    sendWelcomeMessage = initiatedLocally
  } = params

  console.log('[P2PTopicService] 🤖 Auto-creating P2P topic after pairing')
  console.log('[P2PTopicService]   Initiated locally:', initiatedLocally)
  console.log('[P2PTopicService]   Local:', localPersonId?.substring(0, 8))
  console.log('[P2PTopicService]   Remote:', remotePersonId?.substring(0, 8))

  try {
    // Create the P2P topic
    const { topicRoom, wasCreated } = await createP2PTopic(topicModel, localPersonId, remotePersonId)

    // Generate the P2P channel ID
    const channelId = localPersonId < remotePersonId
      ? `${localPersonId}<->${remotePersonId}`
      : `${remotePersonId}<->${localPersonId}`

    // Only setup channel/access if topic was newly created
    if (wasCreated) {
      // Sort participants for consistent ordering
      const participants = localPersonId < remotePersonId
        ? [localPersonId, remotePersonId]
        : [remotePersonId, localPersonId];

      // Ensure the channel exists in ChannelManager with participants array
      const channelResult = await channelManager.createChannel(participants, null); // null owner for P2P shared channel

      // Grant access rights to both participants (person-based, not group-based)
      await grantP2PChannelAccess(channelResult.channelInfoIdHash, localPersonId, remotePersonId);

      console.log('[P2PTopicService] ✅ P2P topic and channel ready for messaging')

      // If we initiated the pairing, send a welcome message
      if (sendWelcomeMessage) {
        try {
          console.log('[P2PTopicService] Sending welcome message...')
          // Use sendMessage with null channelOwner for P2P (shared channel)
          await topicRoom.sendMessage('👋 Hello! Connection established.', undefined, null)
          console.log('[P2PTopicService] ✅ Welcome message sent')
        } catch (msgError: any) {
          console.log('[P2PTopicService] Could not send welcome message:', msgError.message)
        }
      }
    } else {
      console.log('[P2PTopicService] ✅ Using existing P2P topic (no setup needed)')
    }

    return topicRoom
  } catch (error) {
    console.error('[P2PTopicService] Failed to auto-create P2P topic:', error)

    // If we fail, try to enter the room (other peer may have created it)
    try {
      const channelId = localPersonId < remotePersonId
        ? `${localPersonId}<->${remotePersonId}`
        : `${remotePersonId}<->${localPersonId}`

      const topicRoom = await topicModel.enterTopicRoom(channelId)
      console.log('[P2PTopicService] ✅ Entered existing topic room created by peer')
      return topicRoom
    } catch (retryError: any) {
      console.error('[P2PTopicService] Failed to enter existing topic:', retryError)
      throw retryError
    }
  }
}

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
export async function ensureP2PTopicForIncomingMessage(params: {
  topicModel: any;
  channelManager: any;
  leuteModel: any;
  channelId: string;
  message: any;
}): Promise<any> {
  const {
    topicModel,
    channelManager,
    leuteModel,
    channelId,
    message
  } = params

  // Check if this is a P2P channel
  if (!channelId.includes('<->')) {
    return // Not a P2P channel
  }

  console.log('[P2PTopicService] 📨 Received message in P2P channel:', channelId)

  // Extract person IDs from channel ID
  const [id1, id2] = channelId.split('<->')

  // Determine which is local and which is remote
  const me = await leuteModel.me()
  const localPersonId = await me.mainIdentity()

  let remotePersonId
  if (localPersonId === id1) {
    remotePersonId = id2
  } else if (localPersonId === id2) {
    remotePersonId = id1
  } else {
    console.error('[P2PTopicService] Channel does not include our person ID')
    return
  }

  // Try to enter the topic room
  try {
    const topicRoom = await topicModel.enterTopicRoom(channelId)
    console.log('[P2PTopicService] Topic already exists')
    return topicRoom
  } catch (error) {
    // Topic doesn't exist, create it
    console.log('[P2PTopicService] Topic does not exist, creating for incoming message...')

    try {
      const { topicRoom, wasCreated } = await createP2PTopic(topicModel, localPersonId, remotePersonId)

      // Only setup channel/access if topic was newly created
      if (wasCreated) {
        // Sort participants for consistent ordering
        const participants = localPersonId < remotePersonId
          ? [localPersonId, remotePersonId]
          : [remotePersonId, localPersonId];

        // Ensure channel exists with participants array
        const channelResult = await channelManager.createChannel(participants, null);

        // Grant access rights to both participants
        await grantP2PChannelAccess(channelResult.channelInfoIdHash, localPersonId, remotePersonId);

        console.log('[P2PTopicService] ✅ Created P2P topic for incoming message')
      }

      return topicRoom
    } catch (createError: any) {
      console.error('[P2PTopicService] Failed to create topic for incoming message:', createError)
      throw createError
    }
  }
}

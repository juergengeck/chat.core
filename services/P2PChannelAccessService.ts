import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * P2P Channel Access Manager
 *
 * Handles access control for P2P (peer-to-peer) channels.
 * P2P channels should only be accessible to the two participants,
 * not to groups like "everyone".
 */

import { createAccess } from '@refinio/one.core/lib/access.js'
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js'
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js'

/**
 * Grant access to a P2P channel for the two participants
 *
 * @param {string} channelId - The P2P channel ID (format: id1<->id2)
 * @param {string} person1 - First participant's person ID
 * @param {string} person2 - Second participant's person ID
 * @param {Object} channelManager - The ChannelManager instance
 */
export async function grantP2PChannelAccess(channelId: any, person1: any, person2: any, channelManager: any): Promise<any> {
  console.log('[P2PChannelAccess] Granting access for P2P channel:', channelId)
  console.log('[P2PChannelAccess]   Person 1:', person1?.substring(0, 8))
  console.log('[P2PChannelAccess]   Person 2:', person2?.substring(0, 8))

  try {
    // P2P channels have null owner (shared channel)
    const channelOwner = null

    // Ensure the channel exists
    await channelManager.createChannel(channelId, channelOwner)

    // Calculate channel info hash
    const channelIdHash = await calculateIdHashOfObj({
      $type$: 'ChannelInfo',
      id: channelId,
      owner: undefined // null owner becomes undefined in the hash calculation
    })

    // Grant access to both participants individually (not via groups)
    await createAccess([{
      id: channelIdHash,
      person: [person1, person2], // Only these two people
      group: [], // NO group access!
      mode: SET_ACCESS_MODE.ADD
    }])

    console.log('[P2PChannelAccess] ✅ Access granted to P2P channel for both participants')

    // Note: We should NOT try to grant access to Topic object here
    // Topic is a versioned object and access is handled by TopicModel itself
    // when createOneToOneTopic is called

  } catch (error) {
    // Access might already exist, that's ok
    if (!(error as Error).message?.includes('already exists')) {
      console.error('[P2PChannelAccess] Failed to grant P2P channel access:', error)
      throw error
    }
  }
}

/**
 * Handle P2P channel creation with proper access control
 * Called when a P2P topic is created
 *
 * @param {string} channelId - The P2P channel ID
 * @param {Object} leuteModel - The LeuteModel instance
 * @param {Object} channelManager - The ChannelManager instance
 */
export async function handleP2PChannelCreation(channelId: any, leuteModel: any, channelManager: any): Promise<any> {
  console.log('[P2PChannelAccess] Handling P2P channel creation:', channelId)

  // Extract person IDs from channel ID (format: id1<->id2)
  if (!channelId.includes('<->')) {
    console.log('[P2PChannelAccess] Not a P2P channel, skipping')
    return
  }

  const [id1, id2] = channelId.split('<->')

  // Get our own person ID
  const me = await leuteModel.me()
  const myPersonId = await me.mainIdentity()

  // Determine which ID is ours and which is the peer's
  let ourId, peerId
  if (myPersonId === id1) {
    ourId = id1
    peerId = id2
  } else if (myPersonId === id2) {
    ourId = id2
    peerId = id1
  } else {
    console.warn('[P2PChannelAccess] Channel does not include our person ID')
    return
  }

  // Grant access to both participants
  await grantP2PChannelAccess(channelId, ourId, peerId, channelManager)
}

/**
 * Monitor for new P2P channels and grant proper access
 *
 * @param {Object} channelManager - The ChannelManager instance
 * @param {Object} leuteModel - The LeuteModel instance
 */
export function monitorP2PChannels(channelManager: any, leuteModel: any): any {
  console.log('[P2PChannelAccess] Monitoring for new P2P channels...')

  // Listen for channel updates
  channelManager.onUpdated(async (channelInfoIdHash: any, channelId: any, channelOwner: any, timeOfEarliestChange: any, data: any) => {
    // Only process P2P channels
    if (!channelId.includes('<->')) {
      return
    }

    // P2P channels should have null owner
    if (channelOwner !== null && channelOwner !== undefined) {
      console.warn('[P2PChannelAccess] P2P channel has owner - this is unexpected:', channelOwner?.substring(0, 8))
      return
    }

    console.log('[P2PChannelAccess] P2P channel update detected:', channelId)

    // Handle access for this P2P channel
    await handleP2PChannelCreation(channelId, leuteModel, channelManager)
  })
}
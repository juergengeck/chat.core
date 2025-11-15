/**
 * Channel Access Manager
 * Manages granular person-to-person access control for channels
 */
import { createAccess } from '@refinio/one.core/lib/access.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
/**
 * Grant a specific person access to a channel
 */
export async function grantChannelAccessToPerson(channelId, channelOwner, personId) {
    try {
        console.log(`[ChannelAccess] Granting channel ${channelId} access to person ${personId?.substring(0, 8)}`);
        // Calculate the channel info hash
        const channelInfoHash = await calculateIdHashOfObj({
            $type$: 'ChannelInfo',
            id: channelId,
            owner: channelOwner
        });
        // Grant direct person-to-person access to ChannelInfo
        await createAccess([{
                id: channelInfoHash,
                person: [personId],
                group: [],
                mode: SET_ACCESS_MODE.ADD
            }]);
        console.log(`[ChannelAccess] ✅ ChannelInfo access granted to person ${personId?.substring(0, 8)}`);
        return true;
    }
    catch (error) {
        console.error('[ChannelAccess] Failed to grant access:', error);
        return false;
    }
}
/**
 * Grant comprehensive access to a channel message
 * This includes the channelEntry, data, and creationTime objects
 */
export async function grantMessageAccessToPerson(channelEntry, personId) {
    try {
        const accessGrants = [];
        // Grant access to the channel entry itself
        if (channelEntry.channelEntryHash) {
            accessGrants.push({
                id: channelEntry.channelEntryHash,
                person: [personId],
                group: [],
                mode: SET_ACCESS_MODE.ADD
            });
        }
        // Grant access to the message data
        if (channelEntry.dataHash) {
            accessGrants.push({
                id: channelEntry.dataHash,
                person: [personId],
                group: [],
                mode: SET_ACCESS_MODE.ADD
            });
        }
        // Grant access to the creation time
        if (channelEntry.creationTimeHash) {
            accessGrants.push({
                id: channelEntry.creationTimeHash,
                person: [personId],
                group: [],
                mode: SET_ACCESS_MODE.ADD
            });
        }
        if (accessGrants.length > 0) {
            await createAccess(accessGrants);
            console.log(`[ChannelAccess] ✅ Granted access to message objects (${accessGrants.length} grants)`);
        }
        return true;
    }
    catch (error) {
        console.error('[ChannelAccess] Failed to grant message access:', error);
        return false;
    }
}
/**
 * Grant mutual access between two persons for a channel
 * Used for federation between browser and Node instances
 */
export async function grantMutualChannelAccess(channelId, person1Id, person2Id) {
    try {
        console.log(`[ChannelAccess] Setting up mutual access for channel ${channelId}`);
        console.log(`[ChannelAccess] Between ${person1Id?.substring(0, 8)} and ${person2Id?.substring(0, 8)}`);
        // Create channel info hashes for both possible owners
        const channelInfo1Hash = await calculateIdHashOfObj({
            $type$: 'ChannelInfo',
            id: channelId,
            owner: person1Id
        });
        const channelInfo2Hash = await calculateIdHashOfObj({
            $type$: 'ChannelInfo',
            id: channelId,
            owner: person2Id
        });
        // Grant mutual access
        await createAccess([
            {
                id: channelInfo1Hash,
                person: [person2Id], // Person 2 can access Person 1's channel
                group: [],
                mode: SET_ACCESS_MODE.ADD
            },
            {
                id: channelInfo2Hash,
                person: [person1Id], // Person 1 can access Person 2's channel
                group: [],
                mode: SET_ACCESS_MODE.ADD
            }
        ]);
        console.log('[ChannelAccess] ✅ Mutual access established');
        return true;
    }
    catch (error) {
        console.error('[ChannelAccess] Failed to grant mutual access:', error);
        return false;
    }
}
/**
 * Grant access to all channel entries for a person
 * This ensures they can read all messages in the channel
 */
export async function grantChannelEntryAccess(channelManager, channelId, personId) {
    try {
        const channelInfos = await channelManager.getMatchingChannelInfos({
            channelId: channelId
        });
        if (!channelInfos || channelInfos.length === 0) {
            console.log('[ChannelAccess] No channel infos found');
            return false;
        }
        for (const channelInfo of channelInfos) {
            if (channelInfo.obj?.data) {
                const accessRequests = [];
                for (const entry of channelInfo.obj.data) {
                    if (entry.dataHash) {
                        accessRequests.push({
                            object: entry.dataHash,
                            person: [personId],
                            group: [],
                            mode: SET_ACCESS_MODE.ADD
                        });
                    }
                }
                if (accessRequests.length > 0) {
                    await createAccess(accessRequests);
                    console.log(`[ChannelAccess] Granted access to ${accessRequests.length} channel entries`);
                }
            }
        }
        return true;
    }
    catch (error) {
        console.error('[ChannelAccess] Failed to grant entry access:', error);
        return false;
    }
}
/**
 * Setup channel access when browser connects
 * Called when browser Person ID is received
 */
export async function setupBrowserNodeChannelAccess(nodeOwnerId, browserPersonId, channelManager) {
    try {
        console.log('[ChannelAccess] Setting up browser-node channel access');
        console.log(`[ChannelAccess] Node: ${nodeOwnerId?.substring(0, 8)}, Browser: ${browserPersonId?.substring(0, 8)}`);
        // Get all existing channels
        const channelInfos = await channelManager.channels();
        for (const channelInfo of channelInfos) {
            const channelId = channelInfo.id;
            const channelOwner = channelInfo.owner;
            // Grant access to browser for all Node's channels
            if (channelOwner === nodeOwnerId) {
                await grantChannelAccessToPerson(channelId, channelOwner, browserPersonId);
            }
        }
        console.log(`[ChannelAccess] ✅ Processed ${channelInfos.length} channels`);
        // Specifically ensure "lama" channel has proper access
        const lamaChannelInfos = await channelManager.getMatchingChannelInfos({
            channelId: 'lama'
        });
        if (lamaChannelInfos.length > 0) {
            console.log('[ChannelAccess] Found lama channel, ensuring access...');
            for (const channelInfo of lamaChannelInfos) {
                await grantChannelAccessToPerson('lama', channelInfo.owner, browserPersonId);
            }
            console.log('[ChannelAccess] ✅ LAMA channel access configured');
        }
        // Note: Topic-specific channels are created by TopicGroupManager for each participant
        console.log('[ChannelAccess] Browser channels will be created per topic by TopicGroupManager');
        // Set up a listener for channel updates to trace CHUM sync
        channelManager.onUpdated((channelInfoIdHash, channelId, owner, time, data) => {
            if (owner === browserPersonId) {
                console.log(`[ChannelAccess] 🔔 Node received update for browser's channel ${channelId}`);
                console.log('[ChannelAccess] Owner:', owner?.substring(0, 8));
                console.log('[ChannelAccess] Data items:', data?.length);
                console.log('[ChannelAccess] Has messages:', data?.some((d) => d.$type$ === 'ChatMessage'));
                // Log the actual messages for debugging
                const messages = data?.filter((d) => d.$type$ === 'ChatMessage');
                messages?.forEach((msg, idx) => {
                    console.log(`[ChannelAccess] Message ${idx + 1}:`, msg.data?.text?.substring(0, 50));
                });
            }
        });
        return true;
    }
    catch (error) {
        console.error('[ChannelAccess] Failed to setup browser-node access:', error);
        return false;
    }
}
export default {
    grantChannelAccessToPerson,
    grantMessageAccessToPerson,
    grantMutualChannelAccess,
    grantChannelEntryAccess,
    setupBrowserNodeChannelAccess
};
//# sourceMappingURL=ChannelAccessService.js.map
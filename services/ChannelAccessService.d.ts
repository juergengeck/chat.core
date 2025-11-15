import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
/**
 * Grant a specific person access to a channel
 */
export declare function grantChannelAccessToPerson(channelId: string, channelOwner: SHA256IdHash<Person> | undefined, personId: SHA256IdHash<Person>): Promise<boolean>;
/**
 * Grant comprehensive access to a channel message
 * This includes the channelEntry, data, and creationTime objects
 */
export declare function grantMessageAccessToPerson(channelEntry: any, personId: SHA256IdHash<Person>): Promise<boolean>;
/**
 * Grant mutual access between two persons for a channel
 * Used for federation between browser and Node instances
 */
export declare function grantMutualChannelAccess(channelId: string, person1Id: SHA256IdHash<Person>, person2Id: SHA256IdHash<Person>): Promise<boolean>;
/**
 * Grant access to all channel entries for a person
 * This ensures they can read all messages in the channel
 */
export declare function grantChannelEntryAccess(channelManager: any, channelId: string, personId: SHA256IdHash<Person>): Promise<boolean>;
/**
 * Setup channel access when browser connects
 * Called when browser Person ID is received
 */
export declare function setupBrowserNodeChannelAccess(nodeOwnerId: SHA256IdHash<Person>, browserPersonId: SHA256IdHash<Person>, channelManager: any): Promise<boolean>;
declare const _default: {
    grantChannelAccessToPerson: typeof grantChannelAccessToPerson;
    grantMessageAccessToPerson: typeof grantMessageAccessToPerson;
    grantMutualChannelAccess: typeof grantMutualChannelAccess;
    grantChannelEntryAccess: typeof grantChannelEntryAccess;
    setupBrowserNodeChannelAccess: typeof setupBrowserNodeChannelAccess;
};
export default _default;
//# sourceMappingURL=ChannelAccessService.d.ts.map
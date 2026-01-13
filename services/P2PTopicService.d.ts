/**
 * P2P Topic Service
 *
 * Creates P2P topics using HashGroup-based identity.
 * participantsHash IS the topic ID - no string manipulation.
 */
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
/**
 * Create a P2P topic for two participants.
 * Returns the topic with its HashGroup-based ID.
 */
export declare function createP2PTopic(topicModel: any, person1: SHA256IdHash<Person>, person2: SHA256IdHash<Person>): Promise<{
    topicRoom: any;
    wasCreated: boolean;
    topicId: string;
}>;
//# sourceMappingURL=P2PTopicService.d.ts.map
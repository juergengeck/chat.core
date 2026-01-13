/**
 * P2P Topic Service
 *
 * Creates P2P topics using HashGroup-based identity.
 * participantsHash IS the topic ID - no string manipulation.
 */
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
/**
 * Create a P2P topic for two participants.
 * Returns the topic with its HashGroup-based ID.
 */
export async function createP2PTopic(topicModel, person1, person2) {
    // TopicModel.createOneToOneTopic handles everything:
    // - Creates HashGroup from sorted participants
    // - Uses participantsHash as topic ID
    // - Creates channel with proper access
    const topic = await topicModel.createOneToOneTopic(person1, person2);
    // Calculate topic ID hash from Topic object
    const topicId = await calculateIdHashOfObj(topic);
    // Check if it was newly created or already existed
    let wasCreated = true;
    try {
        const existing = await topicModel.findTopic(topicId);
        // If we found an existing topic, it wasn't newly created
        wasCreated = !existing;
    }
    catch {
        wasCreated = true;
    }
    const topicRoom = await topicModel.enterTopicRoom(topicId);
    return { topicRoom, wasCreated, topicId };
}
//# sourceMappingURL=P2PTopicService.js.map
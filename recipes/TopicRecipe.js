/**
 * Topic Recipe for ONE.core
 *
 * Defines the schema for conversation topics/channels.
 * Topics are containers for messages with participant access control.
 *
 * Identity field (isId: true): id
 * Mutable fields: name, participants
 *
 * @see docs/designs/STORY-CUBE-CHAT-ARCHITECTURE.md
 */
export const TopicRecipe = {
    $type$: 'Recipe',
    name: 'Topic',
    rule: [
        {
            itemprop: '$type$',
            itemtype: { type: 'string', regexp: /^Topic$/ }
        },
        // ===== IDENTITY =====
        {
            itemprop: 'id',
            itemtype: { type: 'string' },
            isId: true
        },
        // ===== MUTABLE =====
        {
            itemprop: 'name',
            itemtype: { type: 'string' }
        },
        {
            itemprop: 'participants',
            itemtype: {
                type: 'referenceToObj',
                allowedTypes: new Set(['HashGroup'])
            }
        }
    ]
};
//# sourceMappingURL=TopicRecipe.js.map
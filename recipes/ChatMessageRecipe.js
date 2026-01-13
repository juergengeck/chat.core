/**
 * ChatMessage Recipe for ONE.core
 *
 * Defines the schema for chat messages. Messages are pure data with semantic
 * relationships. Metadata (author, timestamp) is captured by Story objects.
 *
 * Identity fields (isId: true): id, topic, replyTo, reaction
 * Mutable fields: content, attachments, deleted, deletedReason
 *
 * @see docs/designs/STORY-CUBE-CHAT-ARCHITECTURE.md
 */
export const ChatMessageRecipe = {
    $type$: 'Recipe',
    name: 'ChatMessage',
    rule: [
        {
            itemprop: '$type$',
            itemtype: { type: 'string', regexp: /^ChatMessage$/ }
        },
        // ===== IDENTITY FIELDS (isId: true) =====
        {
            itemprop: 'id',
            itemtype: { type: 'string' },
            isId: true
        },
        {
            itemprop: 'topic',
            itemtype: {
                type: 'referenceToId',
                allowedTypes: new Set(['Topic'])
            },
            isId: true
        },
        {
            itemprop: 'replyTo',
            itemtype: {
                type: 'referenceToObj',
                allowedTypes: new Set(['ChatMessage'])
            },
            isId: true,
            optional: true
        },
        {
            itemprop: 'reaction',
            itemtype: { type: 'string' },
            isId: true,
            optional: true
        },
        // ===== MUTABLE FIELDS =====
        {
            itemprop: 'content',
            itemtype: { type: 'string' },
            optional: true
        },
        {
            itemprop: 'attachments',
            itemtype: {
                type: 'array',
                item: {
                    type: 'referenceToObj',
                    allowedTypes: new Set(['BlobDescriptor'])
                }
            },
            optional: true
        },
        // ===== DELETION =====
        {
            itemprop: 'deleted',
            itemtype: { type: 'boolean' },
            optional: true
        },
        {
            itemprop: 'deletedReason',
            itemtype: { type: 'string' },
            optional: true
        }
    ]
};
//# sourceMappingURL=ChatMessageRecipe.js.map
/**
 * Central recipe registry for chat.core
 * All ONE.core recipes that need to be registered
 *
 * NOTE: Topic recipe is defined in one.models/src/recipes/ChatRecipes.ts
 * and is registered there. Do not duplicate here.
 *
 * @see docs/designs/STORY-CUBE-CHAT-ARCHITECTURE.md
 */
import { LLMRecipe } from './LLMRecipe.js';
import { TTSRecipe } from './TTSRecipe.js';
import { STTRecipe } from './STTRecipe.js';
import { ChatMessageRecipe } from './ChatMessageRecipe.js';
/**
 * All recipes that need to be registered with ONE.core
 * Pass this array to registerRecipes() during initialization
 *
 * NOTE: Topic recipe is NOT included here - it's in one.models
 */
export declare const CHAT_CORE_RECIPES: (import("@refinio/one.core/lib/recipes.js").Recipe | {
    $type$: "Recipe";
    name: string;
    rule: ({
        itemprop: string;
        itemtype: {
            type: string;
            regexp: RegExp;
            allowedTypes?: undefined;
            item?: undefined;
        };
        isId?: undefined;
        optional?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            regexp?: undefined;
            allowedTypes?: undefined;
            item?: undefined;
        };
        isId: boolean;
        optional?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            regexp?: undefined;
            allowedTypes?: undefined;
            item?: undefined;
        };
        optional: boolean;
        isId?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            regexp?: undefined;
            allowedTypes?: undefined;
            item?: undefined;
        };
        isId?: undefined;
        optional?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            allowedTypes: Set<string>;
            regexp?: undefined;
            item?: undefined;
        };
        optional: boolean;
        isId?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            item: {
                type: string;
                regexp: RegExp;
            };
            regexp?: undefined;
            allowedTypes?: undefined;
        };
        optional: boolean;
        isId?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            regexp: RegExp;
            allowedTypes?: undefined;
            item?: undefined;
        };
        optional: boolean;
        isId?: undefined;
    })[];
} | {
    $type$: "Recipe";
    name: string;
    rule: ({
        itemprop: string;
        itemtype: {
            type: string;
            regexp: RegExp;
            item?: undefined;
            allowedTypes?: undefined;
        };
        isId?: undefined;
        optional?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            regexp?: undefined;
            item?: undefined;
            allowedTypes?: undefined;
        };
        isId: boolean;
        optional?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            regexp?: undefined;
            item?: undefined;
            allowedTypes?: undefined;
        };
        isId?: undefined;
        optional?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            regexp?: undefined;
            item?: undefined;
            allowedTypes?: undefined;
        };
        optional: boolean;
        isId?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            item: {
                type: string;
                regexp?: undefined;
            };
            regexp?: undefined;
            allowedTypes?: undefined;
        };
        optional: boolean;
        isId?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            item: {
                type: string;
                regexp: RegExp;
            };
            regexp?: undefined;
            allowedTypes?: undefined;
        };
        optional: boolean;
        isId?: undefined;
    } | {
        itemprop: string;
        itemtype: {
            type: string;
            allowedTypes: Set<string>;
            regexp?: undefined;
            item?: undefined;
        };
        optional: boolean;
        isId?: undefined;
    })[];
})[];
export { ChatMessageRecipe, LLMRecipe, TTSRecipe, STTRecipe };
export type { ChatMessage } from './ChatMessageRecipe.js';
export type { Topic, TopicAISettings } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
//# sourceMappingURL=index.d.ts.map
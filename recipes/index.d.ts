/**
 * Central recipe registry for chat.core
 * All ONE.core recipes that need to be registered
 */
import { LLMRecipe } from './LLMRecipe.js';
import { TTSRecipe } from './TTSRecipe.js';
import { STTRecipe } from './STTRecipe.js';
/**
 * All recipes that need to be registered with ONE.core
 * Pass this array to registerRecipes() during initialization
 */
export declare const CHAT_CORE_RECIPES: ({
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
export { LLMRecipe, TTSRecipe, STTRecipe };
//# sourceMappingURL=index.d.ts.map
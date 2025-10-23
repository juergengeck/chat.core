/**
 * LLM Recipe for ONE.core
 * Defines the schema for LLM configuration objects
 */
export declare const LLMRecipe: {
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
};
//# sourceMappingURL=LLMRecipe.d.ts.map
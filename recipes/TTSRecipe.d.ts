/**
 * TTS (Text-to-Speech) Recipe for ONE.core
 *
 * Defines the schema for TTS model configuration objects.
 * Model weights are stored as blobs and referenced here.
 */
export declare const TTSRecipe: {
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
};
//# sourceMappingURL=TTSRecipe.d.ts.map
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
export const CHAT_CORE_RECIPES = [
    LLMRecipe,
    TTSRecipe,
    STTRecipe
];
// Re-export individual recipes for convenience
export { LLMRecipe, TTSRecipe, STTRecipe };
//# sourceMappingURL=index.js.map
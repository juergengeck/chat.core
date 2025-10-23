/**
 * Central recipe registry for chat.core
 * All ONE.core recipes that need to be registered
 */
import { LLMRecipe } from './LLMRecipe.js';
/**
 * All recipes that need to be registered with ONE.core
 * Pass this array to registerRecipes() during initialization
 */
export const CHAT_CORE_RECIPES = [
    LLMRecipe
];
// Re-export individual recipes for convenience
export { LLMRecipe };
//# sourceMappingURL=index.js.map
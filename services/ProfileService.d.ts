/**
 * Profile Service (Chat Business Logic)
 *
 * Extracted from OneCoreHandler - chat-specific profile management.
 * Provides profile and avatar management:
 * - PersonName management (uses one.models API)
 * - Avatar preference management
 * - Mood-based avatar colors
 */
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
/**
 * ProfileService - Profile and avatar management
 */
export declare class ProfileService {
    private leuteModel;
    constructor(leuteModel: LeuteModel);
    /**
     * Get avatar color for a person (with mood support)
     */
    getAvatarColor(personId: string): Promise<string>;
    /**
     * Update user's mood (affects avatar color)
     */
    updateMood(personId: SHA256IdHash<Person>, mood: string): Promise<{
        mood: string;
        color: string;
    }>;
    /**
     * Check if a person has PersonName set
     */
    hasPersonName(personId: SHA256IdHash<Person>): Promise<{
        hasName: boolean;
        name: string | null;
    }>;
    /**
     * Set PersonName for a person
     * NOTE: This now uses one.models/LeuteApi.setPersonName() which was added upstream
     */
    setPersonName(personId: SHA256IdHash<Person>, name: string): Promise<void>;
}
//# sourceMappingURL=ProfileService.d.ts.map
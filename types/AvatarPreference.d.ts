/**
 * Avatar Preference Type
 *
 * Stores user avatar preferences including mood and color.
 * This is a LAMA-specific recipe type.
 */
export interface AvatarPreference {
    $type$: 'AvatarPreference';
    personId: string;
    color: string;
    mood?: 'happy' | 'sad' | 'angry' | 'calm' | 'excited' | 'tired' | 'focused' | 'neutral';
    updatedAt: number;
}
//# sourceMappingURL=AvatarPreference.d.ts.map
/**
 * Profile Service (Chat Business Logic)
 *
 * Extracted from OneCoreHandler - chat-specific profile management.
 * Provides profile and avatar management:
 * - PersonName management (uses one.models API)
 * - Avatar preference management
 * - Mood-based avatar colors
 */
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';
// Avatar color generation
function generateAvatarColor(personId) {
    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6',
        '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e'
    ];
    let hash = 0;
    for (let i = 0; i < personId.length; i++) {
        hash = ((hash << 5) - hash) + personId.charCodeAt(i);
        hash = hash & hash;
    }
    return colors[Math.abs(hash) % colors.length];
}
function getMoodColor(mood) {
    const moodColors = {
        'happy': '#f59e0b', 'sad': '#3b82f6', 'angry': '#ef4444',
        'calm': '#14b8a6', 'excited': '#ec4899', 'tired': '#8b5cf6',
        'focused': '#10b981', 'neutral': '#6366f1'
    };
    return moodColors[mood] || moodColors['neutral'];
}
/**
 * ProfileService - Profile and avatar management
 */
export class ProfileService {
    leuteModel;
    constructor(leuteModel) {
        this.leuteModel = leuteModel;
    }
    /**
     * Get avatar color for a person (with mood support)
     */
    async getAvatarColor(personId) {
        try {
            const result = await getObjectByIdHash(personId);
            if (result && result.obj) {
                const pref = result.obj;
                if (pref.mood)
                    return getMoodColor(pref.mood);
                if (pref.color)
                    return pref.color;
            }
        }
        catch (e) {
            // Preference doesn't exist, will create one
        }
        const color = generateAvatarColor(personId);
        const preference = {
            $type$: 'AvatarPreference',
            personId,
            color,
            updatedAt: Date.now()
        };
        try {
            await storeVersionedObject(preference);
        }
        catch (e) {
            console.warn('[ProfileService] Failed to store avatar preference:', e);
        }
        return color;
    }
    /**
     * Get user's current mood
     */
    async getMood(personId) {
        try {
            const result = await getObjectByIdHash(personId);
            if (result && result.obj && result.obj.mood) {
                return {
                    mood: result.obj.mood,
                    color: getMoodColor(result.obj.mood)
                };
            }
        }
        catch (e) {
            // Preference doesn't exist
        }
        return { mood: null, color: null };
    }
    /**
     * Update user's mood (affects avatar color)
     */
    async updateMood(personId, mood) {
        console.log(`[ProfileService] Update mood: ${mood} for ${personId}`);
        // Get existing preference or create new one
        let preference = null;
        try {
            const result = await getObjectByIdHash(personId);
            if (result && result.obj) {
                preference = result.obj;
            }
        }
        catch (e) {
            // Preference doesn't exist
        }
        // Create updated preference
        const updatedPref = {
            $type$: 'AvatarPreference',
            personId: personId,
            color: preference?.color || generateAvatarColor(personId),
            mood: mood,
            updatedAt: Date.now()
        };
        await storeVersionedObject(updatedPref);
        return {
            mood: mood,
            color: getMoodColor(mood)
        };
    }
    /**
     * Check if a person has PersonName set
     */
    async hasPersonName(personId) {
        console.log('[ProfileService] Checking if person has PersonName');
        const someone = await this.leuteModel.getSomeone(personId);
        if (!someone) {
            return {
                hasName: false,
                name: null
            };
        }
        const profile = await someone.mainProfile();
        if (!profile) {
            return {
                hasName: false,
                name: null
            };
        }
        try {
            const personNames = profile.descriptionsOfType('PersonName');
            const hasName = personNames && personNames.length > 0 && personNames[0].name;
            return {
                hasName: !!hasName,
                name: hasName ? personNames[0].name : null
            };
        }
        catch (e) {
            return {
                hasName: false,
                name: null
            };
        }
    }
    /**
     * Set PersonName for a person
     * NOTE: This now uses one.models/LeuteApi.setPersonName() which was added upstream
     */
    async setPersonName(personId, name) {
        console.log('[ProfileService] Setting PersonName:', name);
        if (!name || name.trim().length === 0) {
            throw new Error('Name cannot be empty');
        }
        // Use one.models API (extended with setPersonName)
        // Note: When integrated, this should use: oneApi.leute().setPersonName(personId, name)
        // For now, we'll implement directly using LeuteModel
        const someone = await this.leuteModel.getSomeone(personId);
        if (!someone) {
            throw new Error('Person not found');
        }
        const profile = await someone.mainProfile();
        if (!profile) {
            throw new Error('Profile not found');
        }
        // Create PersonName description
        const personName = {
            $type$: 'PersonName',
            name: name.trim()
        };
        // Remove existing PersonName if present
        if (profile.personDescriptions) {
            profile.personDescriptions = profile.personDescriptions.filter((desc) => desc.$type$ !== 'PersonName');
        }
        else {
            profile.personDescriptions = [];
        }
        // Add new PersonName
        profile.personDescriptions.push(personName);
        // Save profile
        await profile.saveAndLoad();
        console.log('[ProfileService] PersonName set successfully:', name);
    }
}
//# sourceMappingURL=ProfileService.js.map
import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import type { OneObjectTypes } from '@refinio/one.core/lib/recipes.js';
/**
 * This cache caches objects so that they can be accessed faster and synchronously later.
 */
export default class OneObjectCache<T extends OneObjectTypes> {
    onUpdate: OEvent<(objHash: SHA256Hash<T>, obj: T) => void>;
    onError: OEvent<(error: any) => void>;
    private isInitialized;
    private cache;
    private runtimeCheckTypes;
    constructor(runtimeCheckTypes: T['$type$'][]);
    /**
     * Cleanup the instance.
     *
     * After this function is called this class cannot be reused.
     */
    shutdown(): void;
    /**
     * Load the object and put it in the cache.
     *
     * After successful loading the onUpdate event is emitted.
     *
     * @param objHash - Hash of object to load.
     */
    loadObjectIntoCache(objHash: SHA256Hash<T>): void;
    /**
     * Same as loadObjectIntoCache, except that it does a runtime check on $type$ field.
     *
     * The runtime check is done against the values passed in the constructor. If the runtime check fails the onError
     * event will fire.
     *
     * @param objHash
     */
    loadObjectIntoCacheWithRuntimeCheck(objHash: SHA256Hash): void;
    /**
     * Load the object or query it from cache if it was loaded previously.
     *
     * @param objHash
     */
    queryOrLoadObjectIntoCache(objHash: SHA256Hash<T>): Promise<T>;
    /**
     * Same as queryOrLoadObjectIntoCache, except that it does a runtime check on $type$ field.
     *
     * The runtime check is done against the values passed inthe constructor. If the runtime check fails the promise
     * will reject.
     *
     * @param objHash
     */
    queryOrLoadObjectIntoCacheWithRuntimeCheck(objHash: SHA256Hash): Promise<T>;
    /**
     * Get the object from the cache or undefined if it is not cached.
     *
     * @param objHash
     */
    queryObject(objHash: SHA256Hash<T>): T | undefined;
    private assertInitialized;
}

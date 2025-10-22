import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import { getObjectWithType } from '@refinio/one.core/lib/storage-unversioned-objects.js';
/**
 * This cache caches objects so that they can be accessed faster and synchronously later.
 */
export default class OneObjectCache {
    onUpdate = new OEvent();
    onError = new OEvent();
    isInitialized = true;
    cache = new Map();
    runtimeCheckTypes;
    constructor(runtimeCheckTypes) {
        this.runtimeCheckTypes = runtimeCheckTypes;
    }
    /**
     * Cleanup the instance.
     *
     * After this function is called this class cannot be reused.
     */
    shutdown() {
        this.isInitialized = false;
        this.cache.clear();
    }
    /**
     * Load the object and put it in the cache.
     *
     * After successful loading the onUpdate event is emitted.
     *
     * @param objHash - Hash of object to load.
     */
    loadObjectIntoCache(objHash) {
        this.assertInitialized();
        this.queryOrLoadObjectIntoCache(objHash).catch(e => this.onError.emit(e));
    }
    /**
     * Same as loadObjectIntoCache, except that it does a runtime check on $type$ field.
     *
     * The runtime check is done against the values passed in the constructor. If the runtime check fails the onError
     * event will fire.
     *
     * @param objHash
     */
    loadObjectIntoCacheWithRuntimeCheck(objHash) {
        this.assertInitialized();
        this.queryOrLoadObjectIntoCacheWithRuntimeCheck(objHash).catch(e => this.onError.emit(e));
    }
    /**
     * Load the object or query it from cache if it was loaded previously.
     *
     * @param objHash
     */
    async queryOrLoadObjectIntoCache(objHash) {
        this.assertInitialized();
        const cachedObj = this.cache.get(objHash);
        if (cachedObj !== undefined) {
            return cachedObj;
        }
        const obj = await getObjectWithType(objHash);
        this.cache.set(objHash, obj);
        this.onUpdate.emit(objHash, obj);
        return obj;
    }
    /**
     * Same as queryOrLoadObjectIntoCache, except that it does a runtime check on $type$ field.
     *
     * The runtime check is done against the values passed inthe constructor. If the runtime check fails the promise
     * will reject.
     *
     * @param objHash
     */
    async queryOrLoadObjectIntoCacheWithRuntimeCheck(objHash) {
        this.assertInitialized();
        const objHashOfExpectedType = objHash;
        const cachedObj = this.cache.get(objHashOfExpectedType);
        if (cachedObj !== undefined) {
            return cachedObj;
        }
        const obj = await getObjectWithType(objHashOfExpectedType);
        if (!this.runtimeCheckTypes.includes(obj.$type$)) {
            throw new Error(`The requested object is not of expected type '${this.runtimeCheckTypes.join('|')}', but of type '${obj.$type$}'. Skipping.`);
        }
        this.cache.set(objHashOfExpectedType, obj);
        this.onUpdate.emit(objHashOfExpectedType, obj);
        return obj;
    }
    /**
     * Get the object from the cache or undefined if it is not cached.
     *
     * @param objHash
     */
    queryObject(objHash) {
        this.assertInitialized();
        return this.cache.get(objHash);
    }
    assertInitialized() {
        if (!this.isInitialized) {
            throw new Error('OneObjectCache: You cannot use any method of this class, because it is already shut down.');
        }
    }
}

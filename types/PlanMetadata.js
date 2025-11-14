/**
 * Plan Metadata Interface
 *
 * Defines static metadata properties that Plans can expose
 * for runtime introspection, documentation, and IPC registration.
 *
 * Usage:
 * ```typescript
 * export class ChatPlan implements Plan {
 *   static get name(): string { return 'Chat'; }
 *   static get description(): string { return 'Manages chat conversations'; }
 *   static get version(): string { return '1.0.0'; }
 *   // ... plan implementation
 * }
 * ```
 */
export {};
//# sourceMappingURL=PlanMetadata.js.map
/**
 * ExportPlan (Unified Plan System)
 *
 * Simple, platform-agnostic export plan following the new plan system architecture.
 * Exports chat history in various formats (json, markdown, html).
 *
 * This is the NEW simplified version for the Unified Plan System.
 * Uses only ONE.core dependency via constructor injection.
 */
import type { PlanContext } from '@refinio/api/plan-system';
/**
 * Request/Response types (will be defined with Zod schemas in operation-types.ts)
 */
export interface ExportHistoryRequest {
    topicId: string;
    format: 'json' | 'markdown' | 'html';
}
export interface ExportHistoryResponse {
    data: string;
    filename: string;
}
/**
 * ExportPlan - Export chat history in various formats
 *
 * Platform-agnostic plan that works identically through all transports.
 */
export declare class ExportPlanSimple {
    private oneCore;
    constructor(oneCore: any);
    /**
     * Export topic history in specified format
     *
     * @param request - Export parameters
     * @param context - Optional plan context (auth, tracking)
     * @returns Export data and suggested filename
     */
    exportHistory(request: ExportHistoryRequest, context?: PlanContext): Promise<ExportHistoryResponse>;
    /**
     * Get topic by ID (placeholder - implement with actual ONE.core calls)
     */
    private getTopic;
    /**
     * Get messages for topic (placeholder - implement with actual ONE.core calls)
     */
    private getMessages;
    /**
     * Format messages as JSON
     */
    private formatAsJson;
    /**
     * Format messages as Markdown
     */
    private formatAsMarkdown;
    /**
     * Format messages as HTML
     */
    private formatAsHtml;
    /**
     * Escape HTML special characters
     */
    private escapeHtml;
}

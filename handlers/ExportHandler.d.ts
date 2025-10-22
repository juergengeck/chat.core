/**
 * Export Handler (Pure Business Logic)
 *
 * Transport-agnostic handler for content export operations.
 * Handles format conversion, HTML generation, and export preparation.
 * Platform-specific file operations (dialogs, fs) are injected.
 *
 * Can be used from both Electron IPC and Web Worker contexts.
 */
interface ExportOptions {
    includeSignatures?: boolean;
    maxMessages?: number;
    timeout?: number;
    styleTheme?: 'light' | 'dark' | 'auto';
    dateRange?: {
        start?: string;
        end?: string;
    };
    [key: string]: any;
}
interface FileFilter {
    name: string;
    extensions: string[];
}
export interface ExportMessageRequest {
    format: string;
    content: string;
    metadata: {
        messageId?: string;
        [key: string]: any;
    };
}
export interface ExportMessageResponse {
    success: boolean;
    filename: string;
    fileContent: string;
    filters: FileFilter[];
    error?: string;
}
export interface ExportHtmlWithMicrodataRequest {
    topicId: string;
    format: string;
    options?: ExportOptions;
}
export interface ExportHtmlWithMicrodataResponse {
    success: boolean;
    html?: string;
    metadata?: any;
    error?: string;
}
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
/**
 * ExportHandler - Pure business logic for export operations
 *
 * Dependencies are injected via constructor to support both platforms:
 * - implodeWrapper: HTML export service with implode functionality
 * - formatter: HTML formatting service
 * - htmlTemplate: HTML template generation service
 * - messageRetriever: Function to retrieve messages from a topic
 */
export declare class ExportHandler {
    private implodeWrapper;
    private formatter;
    private htmlTemplate;
    private messageRetriever;
    constructor(implodeWrapper: any, formatter: any, htmlTemplate: any, messageRetriever?: any);
    /**
     * Export message content - prepares filename and content based on format
     */
    exportMessage(request: ExportMessageRequest): Promise<ExportMessageResponse>;
    /**
     * Export conversation as HTML with microdata markup
     */
    exportHtmlWithMicrodata(request: ExportHtmlWithMicrodataRequest): Promise<ExportHtmlWithMicrodataResponse>;
    /**
     * Validate export request parameters
     */
    private validateExportRequest;
    /**
     * Perform the actual export process
     */
    private performExport;
    /**
     * Get messages from topic (uses injected messageRetriever or placeholder)
     */
    private getMessagesFromTopic;
    /**
     * Process messages using implode wrapper
     */
    private processMessagesWithImplode;
    /**
     * Generate metadata for the conversation
     */
    private generateMetadata;
    /**
     * Generate HTML for empty conversation
     */
    private generateEmptyConversationHTML;
}
export {};
//# sourceMappingURL=ExportHandler.d.ts.map
import type { ReceiptTotals } from './types.js';
export interface EmailReceiptContent {
    subject: string;
    previewText: string;
    html: string;
    text: string;
}
export declare function renderEmailReceipt(totals: ReceiptTotals, locale: 'ru' | 'en', manageUrl: string, deleteUrl: string): EmailReceiptContent;
//# sourceMappingURL=email-receipt.d.ts.map
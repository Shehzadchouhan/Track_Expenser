import { DisplayTransaction } from '@/components/TransactionFeed';
import { formatINR } from './money';

/**
 * Exports transactions to a well-formatted CSV file.
 * Includes UTF-8 BOM so Indian currency symbols and text render properly in MS Excel and Google Sheets.
 */
export function exportTransactionsToCSV(
  transactions: DisplayTransaction[],
  filename = `Track_Expenser_Statement_${new Date().toISOString().slice(0, 10)}.csv`
) {
  if (!transactions || transactions.length === 0) {
    alert('No transactions available to export.');
    return;
  }

  const headers = [
    'Date & Time (IST)',
    'Type',
    'Amount (INR)',
    'Account',
    'Category / Transfer',
    'Merchant / Payee',
    'Source',
    'Note / Reference',
  ];

  const rows = transactions.map((t) => {
    const dateFormatted = new Date(t.occurred_at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const amountRupees = (t.amount_paise / 100).toFixed(2);
    const sourceLabel =
      t.source === 'whatsapp_image'
        ? 'WhatsApp Screenshot'
        : t.source === 'whatsapp_text'
        ? 'WhatsApp Message'
        : 'Web Dashboard';

    const accountLabel = t.type === 'transfer'
      ? `${t.account_name || 'Bank'} -> ${t.transfer_to_account_name || 'Cash'}`
      : t.account_name || 'Bank / UPI';

    const categoryLabel = t.type === 'transfer' ? 'Transfer' : t.category_name || 'General';

    return [
      `"${dateFormatted}"`,
      `"${t.type.toUpperCase()}"`,
      amountRupees,
      `"${accountLabel.replace(/"/g, '""')}"`,
      `"${categoryLabel.replace(/"/g, '""')}"`,
      `"${(t.merchant || '-').replace(/"/g, '""')}"`,
      `"${sourceLabel}"`,
      `"${(t.note || '-').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and triggers browser print view for an expense summary statement.
 */
export function printTransactionStatement(
  transactions: DisplayTransaction[],
  options: { startingBalanceRupees?: number; periodLabel?: string } = {}
) {
  if (!transactions || transactions.length === 0) {
    alert('No transactions available to print.');
    return;
  }

  const { startingBalanceRupees = 0, periodLabel = 'Monthly Report' } = options;

  const totalIncomePaise = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const totalExpensePaise = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const netBalancePaise =
    Math.round(startingBalanceRupees * 100) + totalIncomePaise - totalExpensePaise;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to generate statement print view.');
    return;
  }

  const rowsHtml = transactions
    .map((t) => {
      const dateFormatted = new Date(t.occurred_at).toLocaleDateString('en-IN', {
        dateStyle: 'medium',
      });
      const amountFormatted = formatINR(t.amount_paise);
      const isExpense = t.type === 'expense';
      const isTransfer = t.type === 'transfer';
      const colorClass = isTransfer ? '#2563EB' : isExpense ? '#DC2626' : '#16A34A';
      const sign = isTransfer ? '⇄ ' : isExpense ? '-' : '+';
      const accountDesc = isTransfer
        ? `${t.account_name || 'Bank'} → ${t.transfer_to_account_name || 'Cash'}`
        : t.account_name || 'Bank / UPI';

      return `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 10px 12px; font-size: 13px;">${dateFormatted}</td>
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600;">${t.merchant || t.note || '-'}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #4B5563;">${accountDesc}</td>
          <td style="padding: 10px 12px; font-size: 13px;">${t.category_name || (isTransfer ? 'Transfer' : 'General')}</td>
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 700; color: ${colorClass}; text-align: right;">${sign}${amountFormatted}</td>
        </tr>
      `;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Track Expenser Statement</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #111827; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10B981; padding-bottom: 16px; margin-bottom: 24px; }
          .summary-card { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .summary-item label { font-size: 11px; text-transform: uppercase; color: #6B7280; font-weight: 600; display: block; }
          .summary-item span { font-size: 18px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th { padding: 10px 12px; background: #F3F4F6; font-size: 12px; text-transform: uppercase; color: #4B5563; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 style="margin: 0; font-size: 24px; color: #047857;">Track Expenser</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #6B7280;">Statement Report: ${periodLabel}</p>
          </div>
          <div style="text-align: right; font-size: 12px; color: #6B7280;">
            Generated on: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-item">
            <label>Total Income</label>
            <span style="color: #16A34A;">+${formatINR(totalIncomePaise)}</span>
          </div>
          <div class="summary-item">
            <label>Total Expense</label>
            <span style="color: #DC2626;">-${formatINR(totalExpensePaise)}</span>
          </div>
          <div class="summary-item">
            <label>Net Liquid Balance</label>
            <span style="color: #111827;">${formatINR(netBalancePaise)}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Merchant</th>
              <th>Account</th>
              <th>Category</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

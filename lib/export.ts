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
    'Category',
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

    return [
      `"${dateFormatted}"`,
      `"${t.type.toUpperCase()}"`,
      amountRupees,
      `"${(t.category_name || 'General').replace(/"/g, '""')}"`,
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
 * Opens a print-friendly statement document styled like an official bank ledger.
 */
export function printTransactionStatement(
  transactions: DisplayTransaction[],
  startingBalanceRupees = 0
) {
  if (!transactions || transactions.length === 0) {
    alert('No transactions to print.');
    return;
  }

  const totalIncomePaise = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const totalExpensePaise = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_paise, 0);

  const startingPaise = Math.round(startingBalanceRupees * 100);
  const closingBalancePaise = startingPaise + totalIncomePaise - totalExpensePaise;

  const rowsHtml = transactions
    .map((t) => {
      const dateFormatted = new Date(t.occurred_at).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const isExpense = t.type === 'expense';
      const amountStr = formatINR(t.amount_paise, { showPaise: true });

      return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #E4E4E7; font-size: 12px;">${dateFormatted}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E4E4E7; font-size: 12px; font-weight: 600;">
          ${t.merchant || t.note || (isExpense ? 'Expense' : 'Income')}
          <div style="font-size: 11px; color: #71717A; font-weight: normal;">${t.category_name || 'General'}</div>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #E4E4E7; font-size: 11px; color: #52525B;">
          ${t.source === 'whatsapp_image' ? '📸 WhatsApp Screenshot' : t.source === 'whatsapp_text' ? '💬 WhatsApp Text' : '🌐 Web'}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #E4E4E7; text-align: right; font-size: 12px; font-weight: 700; color: ${isExpense ? '#E11D48' : '#059669'};">
          ${isExpense ? '-' : '+'}${amountStr}
        </td>
      </tr>
    `;
    })
    .join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print the statement.');
    return;
  }

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Track Expenser - Account Statement</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #18181B; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10B981; padding-bottom: 16px; margin-bottom: 24px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
          .summary-card { background: #F4F4F5; padding: 12px; border-radius: 8px; }
          .summary-card span { font-size: 11px; color: #71717A; display: block; }
          .summary-card strong { font-size: 16px; margin-top: 4px; display: block; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 10px; background: #F4F4F5; font-size: 11px; text-transform: uppercase; color: #71717A; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 style="margin: 0; font-size: 22px; color: #059669;">Track Expenser</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: #71717A;">AI & WhatsApp Financial Ledger Statement</p>
          </div>
          <div style="text-align: right; font-size: 12px; color: #71717A;">
            <div><strong>Generated:</strong> ${currentDate}</div>
            <div><strong>Total Entries:</strong> ${transactions.length}</div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <span>STARTING CAPITAL</span>
            <strong>${formatINR(startingPaise, { showPaise: false })}</strong>
          </div>
          <div class="summary-card">
            <span>TOTAL INFLOW (+)</span>
            <strong style="color: #059669;">+${formatINR(totalIncomePaise, { showPaise: false })}</strong>
          </div>
          <div class="summary-card">
            <span>TOTAL OUTFLOW (-)</span>
            <strong style="color: #E11D48;">-${formatINR(totalExpensePaise, { showPaise: false })}</strong>
          </div>
          <div class="summary-card" style="background: #ECFDF5; border: 1px solid #A7F3D0;">
            <span>CLOSING BALANCE</span>
            <strong style="color: #047857;">${formatINR(closingBalancePaise, { showPaise: false })}</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Category</th>
              <th>Source</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 40px; border-top: 1px solid #E4E4E7; padding-top: 12px; font-size: 11px; color: #A1A1AA; text-align: center;">
          Track Expenser • Official Auto-Generated Financial Statement
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

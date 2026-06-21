import { type InvoicePdfData, SERVICE_LABELS, escapeHtml, optional, money, date } from './invoice-pdf.types';

export function generateInvoiceHtml(data: InvoicePdfData): string {
  const brand = data.brand;
  const accent = brand.primaryColor;
  const status = data.status.replace(/_/g, ' ');

  const logoHtml = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.companyName)}" class="logo" />`
    : `<div class="logo-text">${escapeHtml(brand.companyName)}</div>`;

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 300; color: #333; background: #fff; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 50px 70px; }
        .accent { height: 2px; background: ${accent}; margin-bottom: 30px; }
        .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
        .logo { max-height: 36px; max-width: 140px; }
        .logo-text { font-size: 18px; font-weight: 400; color: #000; letter-spacing: 1px; }
        .invoice-meta { text-align: right; }
        .invoice-label { font-size: 14px; text-transform: uppercase; letter-spacing: 3px; color: #999; font-weight: 300; }
        .invoice-num { font-size: 12px; color: #bbb; margin-top: 4px; }
        .status { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-top: 6px; }
        .muted { color: #999; }
        .right { text-align: right; }

        .addresses { display: flex; gap: 60px; margin: 30px 0; }
        .addr { flex: 1; }
        .addr-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-bottom: 6px; }
        .addr-name { font-size: 15px; font-weight: 400; color: #000; margin-bottom: 4px; }

        .dates { display: flex; gap: 30px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
        .date-item { }
        .date-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-bottom: 4px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 400; padding: 8px 0; border-bottom: 1px solid #ddd; }
        td { padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; vertical-align: top; }
        .item-name { font-weight: 400; color: #000; }
        .item-desc { font-size: 12px; color: #999; margin-top: 2px; }
        .item-service { font-size: 10px; color: #bbb; margin-top: 3px; }

        .totals { margin-left: auto; width: 260px; margin-top: 16px; }
        .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #666; }
        .total-grand { display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #000; margin-top: 6px; font-size: 18px; font-weight: 400; color: #000; }
        .total-balance { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; font-weight: 500; color: ${accent}; margin-top: 4px; }

        .notes-section { margin-top: 30px; display: flex; gap: 30px; }
        .note { flex: 1; }
        .note-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-bottom: 6px; }
        .note-text { font-size: 12px; color: #666; }

        .footer { margin-top: 40px; text-align: center; color: #ccc; font-size: 11px; }
      </style>
    </head>
    <body>
      <main class="page">
        <div class="accent"></div>

        <section class="top">
          <div>${logoHtml}</div>
          <div class="invoice-meta">
            <div class="invoice-label">Invoice</div>
            <div class="invoice-num">#${escapeHtml(data.number)}</div>
            <div class="status">${escapeHtml(status)}</div>
          </div>
        </section>

        <section class="addresses">
          <div class="addr">
            <div class="addr-label">Bill To</div>
            <div class="addr-name">${escapeHtml(data.recipientName)}</div>
            ${data.recipientCompany ? `<div>${escapeHtml(data.recipientCompany)}</div>` : ''}
            ${data.recipientEmail ? `<div class="muted">${escapeHtml(data.recipientEmail)}</div>` : ''}
          </div>
          <div class="addr">
            <div class="addr-label">From</div>
            <div class="addr-name">${escapeHtml(brand.companyName)}</div>
            ${brand.contactEmail ? `<div class="muted">${escapeHtml(brand.contactEmail)}</div>` : ''}
            ${brand.websiteUrl ? `<div class="muted">${escapeHtml(brand.websiteUrl)}</div>` : ''}
          </div>
        </section>

        <section class="dates">
          <div class="date-item"><div class="date-label">Issue</div><div>${date(data.issueDate)}</div></div>
          <div class="date-item"><div class="date-label">Due</div><div>${date(data.dueDate)}</div></div>
          <div class="date-item"><div class="date-label">Terms</div><div>${optional(data.paymentTerms) || '-'}</div></div>
          <div class="date-item"><div class="date-label">Currency</div><div>${escapeHtml(data.currency)}</div></div>
        </section>

        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th class="right">Unit</th><th class="right">Disc</th><th class="right">Total</th></tr>
          </thead>
          <tbody>
            ${data.lineItems.map((item) => `
              <tr>
                <td>
                  <div class="item-name">${escapeHtml(item.name)}</div>
                  ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ''}
                  <div class="item-service">${escapeHtml(SERVICE_LABELS[item.serviceType] ?? item.serviceType)}${item.planName ? ` / ${escapeHtml(item.planName)}` : ''}</div>
                </td>
                <td>${item.quantity}</td>
                <td class="right">${money(item.unitPrice, data.currency)}</td>
                <td class="right">${item.discountPercentage ? `${item.discountPercentage}%` : '-'}</td>
                <td class="right">${money(item.total, data.currency)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <section class="totals">
          <div class="total-row"><span>Subtotal</span><span>${money(data.subtotal, data.currency)}</span></div>
          ${data.discountAmount > 0 ? `<div class="total-row"><span>Discount</span><span>-${money(data.discountAmount, data.currency)}</span></div>` : ''}
          ${data.taxAmount > 0 ? `<div class="total-row"><span>Tax (${data.taxRate}%)</span><span>${money(data.taxAmount, data.currency)}</span></div>` : ''}
          <div class="total-grand"><span>Total</span><span>${money(data.total, data.currency)}</span></div>
          <div class="total-row"><span>Paid</span><span>${money(data.amountPaid, data.currency)}</span></div>
          <div class="total-balance"><span>Balance Due</span><span>${money(data.balanceDue, data.currency)}</span></div>
        </section>

        <section class="notes-section">
          ${data.notes ? `<div class="note"><div class="note-label">Notes</div><div class="note-text">${escapeHtml(data.notes)}</div></div>` : '<div></div>'}
          ${data.paymentInstructions ? `<div class="note"><div class="note-label">Payment Instructions</div><div class="note-text">${escapeHtml(data.paymentInstructions)}</div></div>` : '<div></div>'}
        </section>

        <footer class="footer">
          ${escapeHtml(brand.companyName)}
        </footer>
      </main>
    </body>
  </html>`;
}

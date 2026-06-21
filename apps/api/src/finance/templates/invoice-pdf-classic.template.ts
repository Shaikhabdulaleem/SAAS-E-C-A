import { type InvoicePdfData, SERVICE_LABELS, escapeHtml, optional, money, date } from './invoice-pdf.types';

export function generateInvoiceHtml(data: InvoicePdfData): string {
  const brand = data.brand;
  const navy = '#1e3a5f';
  const gold = '#c9a84c';
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
        body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #2d2d2d; background: #f8fafc; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 40px 50px; }
        .top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; }
        .logo { max-height: 50px; max-width: 180px; }
        .logo-text { font-size: 26px; font-weight: 700; color: ${navy}; }
        .company-info { color: #666; font-size: 12px; margin-top: 8px; }
        .invoice-header { text-align: right; }
        .invoice-title { font-size: 36px; font-weight: 700; color: ${navy}; letter-spacing: 3px; text-transform: uppercase; margin: 0; }
        .invoice-num { font-size: 13px; color: #666; margin-top: 6px; }
        .status-badge { display: inline-block; margin-top: 8px; padding: 4px 12px; background: ${navy}; color: ${gold}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .gold-rule { height: 3px; background: linear-gradient(90deg, ${navy}, ${gold}); margin: 20px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; }
        .box { border: 1px solid #e0dcd4; padding: 16px; }
        .box-header { background: ${navy}; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; padding: 6px 12px; margin: -16px -16px 12px; font-weight: 700; }
        .name { font-size: 17px; font-weight: 700; color: ${navy}; }
        .muted { color: #888; }
        .dates { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px; }
        .date-card { background: #faf8f2; border: 1px solid #e0dcd4; padding: 12px; }
        .date-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: ${gold}; font-weight: 700; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th { background: ${navy}; color: white; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; padding: 10px 12px; }
        td { border-bottom: 1px solid #e0dcd4; padding: 12px 12px; vertical-align: top; font-size: 13px; }
        tr:nth-child(even) td { background: #faf8f2; }
        .right { text-align: right; }
        .item-title { font-weight: 700; color: ${navy}; }
        .service-tag { display: inline-block; margin-top: 4px; font-size: 10px; color: ${gold}; font-weight: 700; letter-spacing: 0.5px; }
        .totals { margin-left: auto; margin-top: 20px; width: 320px; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e8e4dc; font-size: 13px; }
        .grand { font-size: 20px; font-weight: 700; color: ${navy}; border-bottom: 3px solid ${navy}; padding: 12px 0; }
        .balance { background: ${navy}; color: white; padding: 12px 16px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; }
        .notes { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .note-box { border: 1px solid #e0dcd4; padding: 14px; }
        .note-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: ${gold}; font-weight: 700; margin-bottom: 8px; }
        .footer { margin-top: 30px; padding-top: 14px; border-top: 2px solid ${gold}; color: #888; font-size: 12px; font-style: italic; text-align: center; }
      </style>
    </head>
    <body>
      <main class="page">
        <section class="top">
          <div>
            ${logoHtml}
            <div class="company-info">
              ${optional(brand.address) ? `<p>${optional(brand.address)}</p>` : ''}
              <p>${optional(brand.contactEmail)} ${brand.contactPhone ? `&middot; ${optional(brand.contactPhone)}` : ''}</p>
            </div>
          </div>
          <div class="invoice-header">
            <h1 class="invoice-title">Invoice</h1>
            <div class="invoice-num">#${escapeHtml(data.number)}</div>
            <div class="status-badge">${escapeHtml(status)}</div>
          </div>
        </section>

        <div class="gold-rule"></div>

        <section class="grid">
          <div class="box">
            <div class="box-header">Bill To</div>
            <div class="name">${escapeHtml(data.recipientName)}</div>
            ${data.recipientCompany ? `<div>${escapeHtml(data.recipientCompany)}</div>` : ''}
            ${data.recipientEmail ? `<div class="muted">${escapeHtml(data.recipientEmail)}</div>` : ''}
          </div>
          <div class="box">
            <div class="box-header">From</div>
            <div class="name">${escapeHtml(brand.companyName)}</div>
            ${brand.websiteUrl ? `<div class="muted">${escapeHtml(brand.websiteUrl)}</div>` : ''}
          </div>
        </section>

        <section class="dates">
          <div class="date-card"><div class="date-label">Issue</div><strong>${date(data.issueDate)}</strong></div>
          <div class="date-card"><div class="date-label">Due</div><strong>${date(data.dueDate)}</strong></div>
          <div class="date-card"><div class="date-label">Terms</div><strong>${optional(data.paymentTerms) || '-'}</strong></div>
          <div class="date-card"><div class="date-label">Currency</div><strong>${escapeHtml(data.currency)}</strong></div>
        </section>

        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th class="right">Unit Price</th><th class="right">Discount</th><th class="right">Total</th></tr>
          </thead>
          <tbody>
            ${data.lineItems.map((item) => `
              <tr>
                <td>
                  <div class="item-title">${escapeHtml(item.name)}</div>
                  ${item.description ? `<div class="muted">${escapeHtml(item.description)}</div>` : ''}
                  <span class="service-tag">${escapeHtml(SERVICE_LABELS[item.serviceType] ?? item.serviceType)}${item.planName ? ` / ${escapeHtml(item.planName)}` : ''}</span>
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
          <div class="row"><span>Subtotal</span><strong>${money(data.subtotal, data.currency)}</strong></div>
          ${data.discountAmount > 0 ? `<div class="row"><span>Discount</span><strong>-${money(data.discountAmount, data.currency)}</strong></div>` : ''}
          ${data.taxAmount > 0 ? `<div class="row"><span>Tax (${data.taxRate}%)</span><strong>${money(data.taxAmount, data.currency)}</strong></div>` : ''}
          <div class="row grand"><span>Total</span><span>${money(data.total, data.currency)}</span></div>
          <div class="row"><span>Paid</span><strong>${money(data.amountPaid, data.currency)}</strong></div>
          <div class="balance"><span>Balance Due</span><span>${money(data.balanceDue, data.currency)}</span></div>
        </section>

        <section class="notes">
          ${data.notes ? `<div class="note-box"><div class="note-label">Notes</div>${escapeHtml(data.notes)}</div>` : '<div></div>'}
          ${data.paymentInstructions ? `<div class="note-box"><div class="note-label">Payment Instructions</div>${escapeHtml(data.paymentInstructions)}</div>` : '<div></div>'}
        </section>

        <footer class="footer">
          Thank you for your prompt payment. This invoice was generated by ${escapeHtml(brand.companyName)}.
        </footer>
      </main>
    </body>
  </html>`;
}

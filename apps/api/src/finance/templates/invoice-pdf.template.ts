import { type InvoicePdfData, SERVICE_LABELS, escapeHtml, optional, money, date } from './invoice-pdf.types';

export { type InvoicePdfData };

export function generateInvoiceHtml(data: InvoicePdfData): string {
  const brand = data.brand;
  const logoHtml = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.companyName)}" class="logo" />`
    : `<div class="logo-text">${escapeHtml(brand.companyName)}</div>`;
  const status = data.status.replace(/_/g, ' ');

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: ${escapeHtml(brand.fontFamily || 'Inter')}, Arial, sans-serif; color: #111827; background: #f8fafc; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 36px; }
        .top { display: flex; justify-content: space-between; gap: 32px; border-bottom: 4px solid ${brand.primaryColor}; padding-bottom: 24px; }
        .logo { max-height: 58px; max-width: 210px; }
        .logo-text { font-size: 28px; font-weight: 800; color: ${brand.primaryColor}; }
        .muted { color: #6b7280; }
        .invoice-title { text-align: right; }
        h1 { margin: 0; font-size: 34px; letter-spacing: 0; }
        .status { display: inline-block; margin-top: 10px; padding: 6px 12px; border-radius: 999px; background: ${brand.accentColor}18; color: ${brand.accentColor}; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
        .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; font-weight: 700; margin-bottom: 8px; }
        .name { font-size: 18px; font-weight: 800; }
        .dates { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px; }
        .date-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 28px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #d1d5db; padding: 10px; }
        td { border-bottom: 1px solid #eef2f7; padding: 14px 10px; vertical-align: top; }
        .right { text-align: right; }
        .item-title { font-weight: 800; }
        .service { display: inline-block; margin-top: 5px; font-size: 11px; color: ${brand.primaryColor}; }
        .totals { margin-left: auto; margin-top: 24px; width: 330px; }
        .row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #eef2f7; }
        .grand { font-size: 21px; font-weight: 900; color: ${brand.primaryColor}; border-bottom: none; }
        .balance { background: ${brand.primaryColor}12; border-radius: 8px; padding: 12px; margin-top: 10px; }
        .notes { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .footer { margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 16px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <main class="page">
        <section class="top">
          <div>
            ${logoHtml}
            <p class="muted">${optional(brand.address)}</p>
            <p class="muted">${optional(brand.contactEmail)} ${brand.contactPhone ? `&middot; ${optional(brand.contactPhone)}` : ''}</p>
          </div>
          <div class="invoice-title">
            <h1>Invoice</h1>
            <div class="muted">#${escapeHtml(data.number)}</div>
            <div class="status">${escapeHtml(status)}</div>
          </div>
        </section>

        <section class="grid">
          <div class="box">
            <div class="label">Bill To</div>
            <div class="name">${escapeHtml(data.recipientName)}</div>
            ${data.recipientCompany ? `<div>${escapeHtml(data.recipientCompany)}</div>` : ''}
            ${data.recipientEmail ? `<div class="muted">${escapeHtml(data.recipientEmail)}</div>` : ''}
          </div>
          <div class="box">
            <div class="label">From</div>
            <div class="name">${escapeHtml(brand.companyName)}</div>
            ${brand.websiteUrl ? `<div class="muted">${escapeHtml(brand.websiteUrl)}</div>` : ''}
          </div>
        </section>

        <section class="dates">
          <div class="date-card"><div class="label">Issue</div><strong>${date(data.issueDate)}</strong></div>
          <div class="date-card"><div class="label">Due</div><strong>${date(data.dueDate)}</strong></div>
          <div class="date-card"><div class="label">Terms</div><strong>${optional(data.paymentTerms) || '-'}</strong></div>
          <div class="date-card"><div class="label">Currency</div><strong>${escapeHtml(data.currency)}</strong></div>
        </section>

        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th class="right">Unit</th><th class="right">Discount</th><th class="right">Total</th></tr>
          </thead>
          <tbody>
            ${data.lineItems.map((item) => `
              <tr>
                <td>
                  <div class="item-title">${escapeHtml(item.name)}</div>
                  ${item.description ? `<div class="muted">${escapeHtml(item.description)}</div>` : ''}
                  <span class="service">${escapeHtml(SERVICE_LABELS[item.serviceType] ?? item.serviceType)}${item.planName ? ` / ${escapeHtml(item.planName)}` : ''}</span>
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
          <div class="row"><span>Total</span><strong>${money(data.total, data.currency)}</strong></div>
          <div class="row"><span>Paid</span><strong>${money(data.amountPaid, data.currency)}</strong></div>
          <div class="row grand balance"><span>Balance Due</span><span>${money(data.balanceDue, data.currency)}</span></div>
        </section>

        <section class="notes">
          ${data.notes ? `<div class="box"><div class="label">Notes</div>${escapeHtml(data.notes)}</div>` : '<div></div>'}
          ${data.paymentInstructions ? `<div class="box"><div class="label">Payment Instructions</div>${escapeHtml(data.paymentInstructions)}</div>` : '<div></div>'}
        </section>

        <footer class="footer">
          Thank you for your business. This invoice was generated by ${escapeHtml(brand.companyName)}.
        </footer>
      </main>
    </body>
  </html>`;
}

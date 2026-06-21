import { type PdfTemplateData, SERVICE_LABELS, SERVICE_ICONS, escapeHtml, formatCurrency, formatDate, billingLabel } from './proposal-pdf.types';
import { getAboutUsText, getTermsItems, getTimelineSteps } from './section-content.helpers';

export { type PdfTemplateData };

export function generateProposalHtml(data: PdfTemplateData): string {
  const { brand, services, sections } = data;
  const enabledSections = sections.filter((s) => s.isEnabled);

  const logoHtml = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.companyName)}" style="max-height:60px;max-width:200px;" />`
    : `<div style="font-size:28px;font-weight:700;color:${brand.primaryColor};">${escapeHtml(brand.companyName)}</div>`;

  const coverPage = `
    <div class="page cover-page">
      <div class="cover-logo">${logoHtml}</div>
      <h1 class="cover-title">${escapeHtml(data.title)}</h1>
      <div class="cover-divider"></div>
      <div class="cover-meta">
        <div class="cover-section">
          <h3>Prepared For</h3>
          <p class="cover-name">${escapeHtml(data.recipientName)}</p>
          ${data.companyName ? `<p>${escapeHtml(data.companyName)}</p>` : ''}
          ${data.recipientEmail ? `<p>${escapeHtml(data.recipientEmail)}</p>` : ''}
        </div>
        <div class="cover-section">
          <h3>Prepared By</h3>
          <p class="cover-name">${escapeHtml(brand.companyName)}</p>
          ${brand.contactEmail ? `<p>${escapeHtml(brand.contactEmail)}</p>` : ''}
          ${brand.contactPhone ? `<p>${escapeHtml(brand.contactPhone)}</p>` : ''}
        </div>
      </div>
      <div class="cover-footer">
        <p>Proposal #${escapeHtml(data.proposalNumber)} &middot; ${formatDate(data.createdAt)}</p>
        ${data.validUntil ? `<p>Valid until ${formatDate(data.validUntil)}</p>` : ''}
      </div>
    </div>`;

  const tocItems = [
    'About Us',
    'Executive Summary',
    ...services.map((s) => SERVICE_LABELS[s.serviceType] ?? s.serviceType),
    'Pricing Summary',
    'Implementation Timeline',
    'Terms & Conditions',
    'Acceptance & Signature',
  ];
  const tocPage = `
    <div class="page">
      <div class="page-header">${logoHtml}</div>
      <h2>Table of Contents</h2>
      <div class="toc">
        ${tocItems.map((item, i) => `<div class="toc-item"><span>${i + 1}. ${escapeHtml(item)}</span><span class="toc-dots"></span></div>`).join('')}
      </div>
    </div>`;

  const aboutText = getAboutUsText(sections, brand.aboutUsText ?? `${brand.companyName} is a trusted provider of business solutions.`);
  const aboutPage = `
    <div class="page">
      <div class="page-header">${logoHtml}</div>
      <h2>About ${escapeHtml(brand.companyName)}</h2>
      <p>${escapeHtml(aboutText)}</p>
      ${brand.websiteUrl ? `<p><strong>Website:</strong> ${escapeHtml(brand.websiteUrl)}</p>` : ''}
      ${brand.address ? `<p><strong>Address:</strong> ${escapeHtml(brand.address)}</p>` : ''}
    </div>`;

  const summaryPage = `
    <div class="page">
      <div class="page-header">${logoHtml}</div>
      <h2>Executive Summary</h2>
      ${data.customIntroMessage ? `<p>${escapeHtml(data.customIntroMessage)}</p>` : `<p>We are pleased to present this proposal for ${escapeHtml(data.recipientName)}. Below you will find a comprehensive overview of the services we recommend for your business needs.</p>`}
      <h3 style="margin-top:24px;">Included Services</h3>
      <div class="service-summary-grid">
        ${services.map((s) => `
          <div class="service-summary-card">
            <span class="service-icon">${SERVICE_ICONS[s.serviceType] ?? '&#9733;'}</span>
            <span>${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)}</span>
            <span class="service-plan-badge">${escapeHtml(s.planName)}</span>
          </div>
        `).join('')}
      </div>
      <div class="quick-stats">
        <div class="stat-card">
          <p class="stat-label">Total Investment</p>
          <p class="stat-value">${formatCurrency(data.total)}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Billing</p>
          <p class="stat-value">${billingLabel(data.billingCycle)}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Services</p>
          <p class="stat-value">${services.length}</p>
        </div>
      </div>
    </div>`;

  const servicePages = services.map((s) => `
    <div class="page">
      <div class="page-header">${logoHtml}</div>
      <h2>${SERVICE_ICONS[s.serviceType] ?? ''} ${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)}</h2>
      <div class="plan-badge">${escapeHtml(s.planName)} Plan</div>
      ${s.customDescription ? `<p>${escapeHtml(s.customDescription)}</p>` : ''}
      <h3>Features Included</h3>
      <ul class="feature-list">
        ${(s.features ?? []).map((f) => `<li>&#10003; ${escapeHtml(String(f))}</li>`).join('')}
      </ul>
      <div class="service-price-box">
        <div class="price-row">
          <span>List Price</span>
          <span>${formatCurrency(s.listPrice)} / ${data.billingCycle === 'monthly' ? 'mo' : data.billingCycle === 'quarterly' ? 'qtr' : 'yr'}</span>
        </div>
        ${s.discountPercentage > 0 ? `<div class="price-row discount"><span>Discount (${s.discountPercentage}%)</span><span>-${formatCurrency(s.listPrice * s.discountPercentage / 100)}</span></div>` : ''}
        <div class="price-row total">
          <span>Your Price</span>
          <span>${formatCurrency(s.finalPrice)}</span>
        </div>
      </div>
    </div>
  `).join('');

  const pricingSummaryPage = `
    <div class="page">
      <div class="page-header">${logoHtml}</div>
      <h2>Pricing Summary</h2>
      <table class="pricing-table">
        <thead>
          <tr><th>Service</th><th>Plan</th><th>Price</th><th>Discount</th><th>Final</th></tr>
        </thead>
        <tbody>
          ${services.map((s) => `
            <tr>
              <td>${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)}</td>
              <td>${escapeHtml(s.planName)}</td>
              <td>${formatCurrency(s.listPrice)}</td>
              <td>${s.discountPercentage > 0 ? `${s.discountPercentage}%` : '—'}</td>
              <td>${formatCurrency(s.finalPrice)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total-box">
        <div class="total-row"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
        ${data.discountAmount > 0 ? `<div class="total-row"><span>Discount</span><span>-${formatCurrency(data.discountAmount)}</span></div>` : ''}
        ${data.setupFee > 0 ? `<div class="total-row"><span>One-time Setup Fee</span><span>${formatCurrency(data.setupFee)}</span></div>` : ''}
        <div class="total-row grand"><span>Total Investment</span><span>${formatCurrency(data.total)}</span></div>
      </div>
      <div class="billing-info">
        <p><strong>Billing Cycle:</strong> ${billingLabel(data.billingCycle)}</p>
        ${data.contractDuration ? `<p><strong>Contract Duration:</strong> ${escapeHtml(data.contractDuration)}</p>` : ''}
        ${data.paymentTerms ? `<p><strong>Payment Terms:</strong> ${escapeHtml(data.paymentTerms)}</p>` : ''}
      </div>
    </div>`;

  const timelineSteps = getTimelineSteps(sections);
  const timelinePage = `
    <div class="page">
      <div class="page-header">${logoHtml}</div>
      <h2>Implementation Timeline</h2>
      <div class="timeline">
        ${timelineSteps.map((step, i) => `
        <div class="timeline-item">
          <div class="timeline-marker" style="background:${brand.primaryColor};">${i + 1}</div>
          <div><h4>${escapeHtml(step.title)}</h4><p>${escapeHtml(step.description)}</p></div>
        </div>`).join('')}
      </div>
    </div>`;

  const termsItems = getTermsItems(sections);
  const termsPage = `
    <div class="page">
      <div class="page-header">${logoHtml}</div>
      <h2>Terms & Conditions</h2>
      <ol class="terms-list">
        ${termsItems.map((t) => `<li><strong>${escapeHtml(t.title)}.</strong> ${escapeHtml(t.text)}</li>`).join('')}
      </ol>
    </div>`;

  const signaturePage = `
    <div class="page">
      <div class="page-header">${logoHtml}</div>
      <h2>Acceptance & Signature</h2>
      <p>By signing below, the parties agree to the services and terms outlined in this proposal.</p>
      <h3>Services Accepted</h3>
      <ul class="acceptance-checklist">
        ${services.map((s) => `<li>&#9744; ${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)} — ${escapeHtml(s.planName)} (${formatCurrency(s.finalPrice)}/${data.billingCycle})</li>`).join('')}
      </ul>
      <div class="signature-grid">
        <div class="signature-block">
          <h4>${escapeHtml(data.recipientName)}</h4>
          <div class="signature-line"></div>
          <p>Signature</p>
          <div class="signature-line short"></div>
          <p>Date</p>
        </div>
        <div class="signature-block">
          <h4>${escapeHtml(brand.companyName)}</h4>
          <div class="signature-line"></div>
          <p>Signature</p>
          <div class="signature-line short"></div>
          <p>Date</p>
        </div>
      </div>
      <div class="contact-footer">
        <p>${escapeHtml(brand.companyName)}</p>
        ${brand.contactEmail ? `<p>${escapeHtml(brand.contactEmail)}</p>` : ''}
        ${brand.contactPhone ? `<p>${escapeHtml(brand.contactPhone)}</p>` : ''}
        ${brand.websiteUrl ? `<p>${escapeHtml(brand.websiteUrl)}</p>` : ''}
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  @page {
    size: A4;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: '${brand.fontFamily}', 'Inter', -apple-system, sans-serif;
    font-size: 13px;
    color: #1f2937;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 40px 50px;
    page-break-after: always;
    position: relative;
  }
  .page-header {
    margin-bottom: 30px;
    padding-bottom: 12px;
    border-bottom: 2px solid ${brand.primaryColor};
  }

  /* Cover */
  .cover-page {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background: linear-gradient(135deg, ${brand.primaryColor}08, ${brand.accentColor}08);
  }
  .cover-logo { margin-bottom: 40px; }
  .cover-title { font-size: 32px; font-weight: 700; color: ${brand.primaryColor}; margin-bottom: 20px; max-width: 80%; }
  .cover-divider { width: 80px; height: 4px; background: ${brand.accentColor}; border-radius: 2px; margin-bottom: 40px; }
  .cover-meta { display: flex; gap: 60px; text-align: left; margin-bottom: 40px; }
  .cover-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${brand.primaryColor}; margin-bottom: 8px; }
  .cover-section p { font-size: 14px; margin-bottom: 4px; }
  .cover-name { font-weight: 600; font-size: 16px !important; }
  .cover-footer { margin-top: auto; padding-top: 30px; color: #6b7280; font-size: 12px; }

  /* TOC */
  .toc { margin-top: 20px; }
  .toc-item { display: flex; align-items: baseline; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #d1d5db; margin: 0 8px; }

  /* Typography */
  h2 { font-size: 22px; font-weight: 700; color: ${brand.primaryColor}; margin-bottom: 16px; }
  h3 { font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 10px; }
  h4 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
  p { margin-bottom: 10px; }

  /* Service Summary */
  .service-summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  .service-summary-card { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; }
  .service-icon { font-size: 18px; }
  .service-plan-badge { background: ${brand.primaryColor}15; color: ${brand.primaryColor}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }

  /* Quick Stats */
  .quick-stats { display: flex; gap: 16px; margin-top: 20px; }
  .stat-card { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-label { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
  .stat-value { font-size: 20px; font-weight: 700; color: ${brand.primaryColor}; }

  /* Plan Badge */
  .plan-badge { display: inline-block; background: ${brand.primaryColor}; color: white; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }

  /* Features */
  .feature-list { list-style: none; margin: 10px 0 20px; }
  .feature-list li { padding: 6px 0; padding-left: 4px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }

  /* Service Price Box */
  .service-price-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 20px; }
  .price-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .price-row.discount { color: #16a34a; }
  .price-row.total { border-top: 2px solid ${brand.primaryColor}; margin-top: 8px; padding-top: 10px; font-weight: 700; font-size: 16px; color: ${brand.primaryColor}; }

  /* Pricing Table */
  .pricing-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .pricing-table th { background: ${brand.primaryColor}; color: white; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
  .pricing-table td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  .pricing-table tr:nth-child(even) td { background: #f9fafb; }

  /* Total Box */
  .total-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .total-row.grand { border-top: 2px solid ${brand.primaryColor}; margin-top: 8px; padding-top: 10px; font-size: 18px; font-weight: 700; color: ${brand.primaryColor}; }

  .billing-info { margin-top: 16px; }
  .billing-info p { font-size: 13px; margin-bottom: 4px; }

  /* Timeline */
  .timeline { margin-top: 20px; }
  .timeline-item { display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start; }
  .timeline-marker { width: 36px; height: 36px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }

  /* Terms */
  .terms-list { padding-left: 20px; }
  .terms-list li { margin-bottom: 12px; font-size: 13px; }

  /* Signature */
  .acceptance-checklist { list-style: none; margin: 16px 0 30px; }
  .acceptance-checklist li { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .signature-grid { display: flex; gap: 40px; margin-top: 30px; }
  .signature-block { flex: 1; }
  .signature-block h4 { margin-bottom: 40px; }
  .signature-line { border-bottom: 1px solid #374151; margin-bottom: 6px; height: 30px; }
  .signature-line.short { width: 60%; }
  .contact-footer { margin-top: 50px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
  .contact-footer p { margin-bottom: 2px; }
</style>
</head>
<body>
${coverPage}
${tocPage}
${aboutPage}
${summaryPage}
${servicePages}
${pricingSummaryPage}
${timelinePage}
${termsPage}
${signaturePage}
</body>
</html>`;
}

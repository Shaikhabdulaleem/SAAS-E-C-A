import { type PdfTemplateData, SERVICE_LABELS, SERVICE_ICONS, escapeHtml, formatCurrency, formatDate, billingLabel } from './proposal-pdf.types';
import { getAboutUsText, getTermsItems, getTimelineSteps } from './section-content.helpers';

export function generateProposalHtml(data: PdfTemplateData): string {
  const { brand, services, sections } = data;
  const navy = '#1e3a5f';
  const gold = '#c9a84c';

  const logoHtml = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.companyName)}" style="max-height:50px;max-width:180px;" />`
    : `<div style="font-size:26px;font-weight:700;color:${navy};font-family:Georgia,serif;">${escapeHtml(brand.companyName)}</div>`;

  const coverPage = `
    <div class="page cover-page">
      <div class="cover-top">
        <div>${logoHtml}</div>
        <div class="cover-date">${formatDate(data.createdAt)}</div>
      </div>
      <div class="cover-rule"></div>
      <div class="cover-body">
        <h1 class="cover-title">${escapeHtml(data.title)}</h1>
        <p class="cover-subtitle">Proposal #${escapeHtml(data.proposalNumber)}</p>
      </div>
      <div class="cover-parties">
        <div class="cover-party">
          <h3>Prepared For</h3>
          <p class="party-name">${escapeHtml(data.recipientName)}</p>
          ${data.companyName ? `<p>${escapeHtml(data.companyName)}</p>` : ''}
          ${data.recipientEmail ? `<p>${escapeHtml(data.recipientEmail)}</p>` : ''}
        </div>
        <div class="cover-divider"></div>
        <div class="cover-party">
          <h3>Prepared By</h3>
          <p class="party-name">${escapeHtml(brand.companyName)}</p>
          ${brand.contactEmail ? `<p>${escapeHtml(brand.contactEmail)}</p>` : ''}
          ${brand.contactPhone ? `<p>${escapeHtml(brand.contactPhone)}</p>` : ''}
        </div>
      </div>
      ${data.validUntil ? `<p class="cover-validity">Valid until ${formatDate(data.validUntil)}</p>` : ''}
    </div>`;

  const tocItems = [
    'About Us', 'Executive Summary',
    ...services.map((s) => SERVICE_LABELS[s.serviceType] ?? s.serviceType),
    'Pricing Summary', 'Implementation Timeline', 'Terms & Conditions', 'Acceptance & Signature',
  ];
  const tocPage = `
    <div class="page">
      <div class="page-header">${logoHtml}<div class="header-rule"></div></div>
      <h2>Table of Contents</h2>
      <div class="toc">
        ${tocItems.map((item, i) => `<div class="toc-item"><span class="toc-num">${i + 1}.</span><span class="toc-text">${escapeHtml(item)}</span><span class="toc-dots"></span></div>`).join('')}
      </div>
    </div>`;

  const aboutText = getAboutUsText(sections, brand.aboutUsText ?? `${brand.companyName} is a trusted provider of business solutions, committed to delivering exceptional value and service to our clients.`);
  const aboutPage = `
    <div class="page">
      <div class="page-header">${logoHtml}<div class="header-rule"></div></div>
      <h2>About ${escapeHtml(brand.companyName)}</h2>
      <p>${escapeHtml(aboutText)}</p>
      ${brand.websiteUrl ? `<p><strong>Website:</strong> ${escapeHtml(brand.websiteUrl)}</p>` : ''}
      ${brand.address ? `<p><strong>Address:</strong> ${escapeHtml(brand.address)}</p>` : ''}
    </div>`;

  const summaryPage = `
    <div class="page">
      <div class="page-header">${logoHtml}<div class="header-rule"></div></div>
      <h2>Executive Summary</h2>
      ${data.customIntroMessage ? `<p>${escapeHtml(data.customIntroMessage)}</p>` : `<p>We are pleased to present this proposal for ${escapeHtml(data.recipientName)}. Below you will find a comprehensive overview of the services we recommend.</p>`}
      <h3>Proposed Services</h3>
      <table class="services-table">
        <thead><tr><th>Service</th><th>Plan</th></tr></thead>
        <tbody>
          ${services.map((s) => `<tr><td>${SERVICE_ICONS[s.serviceType] ?? '&#9733;'} ${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)}</td><td>${escapeHtml(s.planName)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="summary-stats">
        <div class="stat"><span class="stat-label">Total Investment</span><span class="stat-value">${formatCurrency(data.total)}</span></div>
        <div class="stat"><span class="stat-label">Billing Cycle</span><span class="stat-value">${billingLabel(data.billingCycle)}</span></div>
        <div class="stat"><span class="stat-label">Services Included</span><span class="stat-value">${services.length}</span></div>
      </div>
    </div>`;

  const servicePages = services.map((s) => `
    <div class="page">
      <div class="page-header">${logoHtml}<div class="header-rule"></div></div>
      <h2>${SERVICE_ICONS[s.serviceType] ?? ''} ${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)}</h2>
      <div class="plan-label">${escapeHtml(s.planName)} Plan</div>
      ${s.customDescription ? `<p>${escapeHtml(s.customDescription)}</p>` : ''}
      <h3>Features Included</h3>
      <ul class="feature-list">
        ${(s.features ?? []).map((f) => `<li>${escapeHtml(String(f))}</li>`).join('')}
      </ul>
      <div class="price-box">
        <div class="price-row"><span>List Price</span><span>${formatCurrency(s.listPrice)} / ${data.billingCycle === 'monthly' ? 'mo' : data.billingCycle === 'quarterly' ? 'qtr' : 'yr'}</span></div>
        ${s.discountPercentage > 0 ? `<div class="price-row discount"><span>Discount (${s.discountPercentage}%)</span><span>-${formatCurrency(s.listPrice * s.discountPercentage / 100)}</span></div>` : ''}
        <div class="price-row total"><span>Your Price</span><span>${formatCurrency(s.finalPrice)}</span></div>
      </div>
    </div>
  `).join('');

  const pricingPage = `
    <div class="page">
      <div class="page-header">${logoHtml}<div class="header-rule"></div></div>
      <h2>Pricing Summary</h2>
      <table class="pricing-table">
        <thead><tr><th>Service</th><th>Plan</th><th>Price</th><th>Discount</th><th>Final</th></tr></thead>
        <tbody>
          ${services.map((s) => `<tr><td>${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)}</td><td>${escapeHtml(s.planName)}</td><td>${formatCurrency(s.listPrice)}</td><td>${s.discountPercentage > 0 ? `${s.discountPercentage}%` : '—'}</td><td>${formatCurrency(s.finalPrice)}</td></tr>`).join('')}
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
      <div class="page-header">${logoHtml}<div class="header-rule"></div></div>
      <h2>Implementation Timeline</h2>
      <div class="timeline">
        ${timelineSteps.map((step) => `<div class="timeline-item"><div class="timeline-diamond"></div><div class="timeline-content"><h4>${escapeHtml(step.title)}</h4><p>${escapeHtml(step.description)}</p></div></div>`).join('')}
      </div>
    </div>`;

  const termsItems = getTermsItems(sections);
  const termsPage = `
    <div class="page">
      <div class="page-header">${logoHtml}<div class="header-rule"></div></div>
      <h2>Terms & Conditions</h2>
      <ol class="terms-list">
        ${termsItems.map((t) => `<li><strong>${escapeHtml(t.title)}.</strong> ${escapeHtml(t.text)}</li>`).join('')}
      </ol>
    </div>`;

  const signaturePage = `
    <div class="page">
      <div class="page-header">${logoHtml}<div class="header-rule"></div></div>
      <h2>Acceptance & Signature</h2>
      <p class="witness">IN WITNESS WHEREOF, the parties hereto have executed this agreement as of the date set forth below.</p>
      <h3>Services Accepted</h3>
      <ul class="acceptance-list">
        ${services.map((s) => `<li>&#9744; ${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)} — ${escapeHtml(s.planName)} (${formatCurrency(s.finalPrice)}/${data.billingCycle})</li>`).join('')}
      </ul>
      <div class="sig-grid">
        <div class="sig-block">
          <h4>${escapeHtml(data.recipientName)}</h4>
          <div class="sig-line"></div><p>Authorized Signature</p>
          <div class="sig-line-short"></div><p>Date</p>
        </div>
        <div class="sig-block">
          <h4>${escapeHtml(brand.companyName)}</h4>
          <div class="sig-line"></div><p>Authorized Signature</p>
          <div class="sig-line-short"></div><p>Date</p>
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
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 13px;
    color: #2d2d2d;
    line-height: 1.7;
    -webkit-print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 45px 55px;
    page-break-after: always;
    position: relative;
  }
  .page-header { margin-bottom: 24px; }
  .header-rule { height: 3px; background: linear-gradient(90deg, ${navy}, ${gold}); margin-top: 10px; }

  /* Cover */
  .cover-page { display: flex; flex-direction: column; }
  .cover-top { display: flex; justify-content: space-between; align-items: center; }
  .cover-date { font-size: 13px; color: #666; font-style: italic; }
  .cover-rule { height: 4px; background: ${gold}; margin: 24px 0 40px; }
  .cover-body { text-align: center; margin: 40px 0; flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-title { font-size: 36px; font-weight: 700; color: ${navy}; margin-bottom: 12px; line-height: 1.2; }
  .cover-subtitle { font-size: 16px; color: #666; font-style: italic; }
  .cover-parties { display: flex; gap: 30px; align-items: flex-start; margin-top: auto; }
  .cover-party { flex: 1; }
  .cover-party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: ${gold}; margin-bottom: 8px; }
  .party-name { font-size: 17px; font-weight: 700; color: ${navy}; }
  .cover-divider { width: 1px; background: ${gold}; min-height: 80px; }
  .cover-validity { text-align: center; margin-top: 24px; color: #888; font-style: italic; font-size: 12px; }

  /* TOC */
  .toc { margin-top: 16px; }
  .toc-item { display: flex; align-items: baseline; padding: 8px 0; border-bottom: 1px solid #e8e4dc; font-size: 14px; }
  .toc-num { width: 28px; color: ${gold}; font-weight: 700; }
  .toc-text { flex-shrink: 0; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #c9c0b0; margin: 0 8px; }

  /* Typography */
  h2 { font-size: 24px; font-weight: 700; color: ${navy}; margin-bottom: 16px; border-bottom: 2px solid ${gold}; padding-bottom: 8px; }
  h3 { font-size: 16px; font-weight: 700; color: ${navy}; margin-bottom: 10px; }
  h4 { font-size: 14px; font-weight: 700; color: #333; margin-bottom: 4px; }
  p { margin-bottom: 10px; }

  /* Summary Stats */
  .summary-stats { display: flex; gap: 16px; margin-top: 20px; }
  .stat { flex: 1; background: #faf8f2; border: 1px solid #e8e4dc; padding: 14px; text-align: center; }
  .stat-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
  .stat-value { display: block; font-size: 20px; font-weight: 700; color: ${navy}; }

  /* Services Table */
  .services-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .services-table th { background: ${navy}; color: white; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  .services-table td { padding: 10px 12px; border-bottom: 1px solid #e8e4dc; }
  .services-table tr:nth-child(even) td { background: #faf8f2; }

  /* Plan Label */
  .plan-label { display: inline-block; background: ${navy}; color: ${gold}; padding: 4px 16px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 16px; }

  /* Features */
  .feature-list { list-style: none; margin: 10px 0 20px; padding-left: 0; }
  .feature-list li { padding: 7px 0 7px 20px; border-bottom: 1px solid #ede9e0; font-size: 13px; position: relative; }
  .feature-list li::before { content: '\\2713'; position: absolute; left: 0; color: ${gold}; font-weight: 700; }

  /* Price Box */
  .price-box { background: #faf8f2; border: 1px solid #e8e4dc; padding: 16px; margin-top: 20px; }
  .price-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .price-row.discount { color: #2e7d32; }
  .price-row.total { border-top: 2px solid ${navy}; margin-top: 8px; padding-top: 10px; font-weight: 700; font-size: 16px; color: ${navy}; }

  /* Pricing Table */
  .pricing-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .pricing-table th { background: ${navy}; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  .pricing-table td { padding: 10px 12px; border-bottom: 1px solid #e8e4dc; font-size: 13px; }
  .pricing-table tr:nth-child(even) td { background: #faf8f2; }

  /* Total Box */
  .total-box { background: #faf8f2; border: 1px solid #e8e4dc; padding: 16px; margin-bottom: 20px; }
  .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .total-row.grand { border-top: 3px solid ${navy}; margin-top: 8px; padding-top: 10px; font-size: 18px; font-weight: 700; color: ${navy}; }
  .billing-info { margin-top: 16px; }
  .billing-info p { font-size: 13px; margin-bottom: 4px; }

  /* Timeline */
  .timeline { margin-top: 20px; position: relative; padding-left: 30px; }
  .timeline::before { content: ''; position: absolute; left: 8px; top: 10px; bottom: 10px; width: 2px; background: ${gold}; }
  .timeline-item { display: flex; gap: 16px; margin-bottom: 28px; position: relative; }
  .timeline-diamond { width: 18px; height: 18px; background: ${navy}; transform: rotate(45deg); flex-shrink: 0; position: absolute; left: -30px; top: 2px; }
  .timeline-content h4 { font-family: Georgia, serif; }

  /* Terms */
  .terms-list { padding-left: 20px; }
  .terms-list li { margin-bottom: 12px; font-size: 13px; }

  /* Signature */
  .witness { font-style: italic; margin-bottom: 20px; color: #555; }
  .acceptance-list { list-style: none; margin: 16px 0 30px; }
  .acceptance-list li { padding: 8px 0; border-bottom: 1px solid #e8e4dc; font-size: 14px; }
  .sig-grid { display: flex; gap: 50px; margin-top: 30px; }
  .sig-block { flex: 1; }
  .sig-block h4 { margin-bottom: 40px; color: ${navy}; }
  .sig-line { border-bottom: 2px solid ${navy}; margin-bottom: 6px; height: 30px; }
  .sig-line-short { border-bottom: 2px solid ${navy}; margin-bottom: 6px; height: 30px; width: 60%; }
  .contact-footer { margin-top: 50px; padding-top: 16px; border-top: 2px solid ${gold}; text-align: center; color: #666; font-size: 12px; }
  .contact-footer p { margin-bottom: 2px; }
</style>
</head>
<body>
${coverPage}
${tocPage}
${aboutPage}
${summaryPage}
${servicePages}
${pricingPage}
${timelinePage}
${termsPage}
${signaturePage}
</body>
</html>`;
}

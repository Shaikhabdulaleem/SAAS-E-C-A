import { type PdfTemplateData, SERVICE_LABELS, escapeHtml, formatCurrency, formatDate, billingLabel } from './proposal-pdf.types';
import { getAboutUsText, getTermsItems, getTimelineSteps } from './section-content.helpers';

export function generateProposalHtml(data: PdfTemplateData): string {
  const { brand, services, sections } = data;
  const accent = brand.primaryColor;

  const logoHtml = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.companyName)}" style="max-height:36px;max-width:140px;" />`
    : `<div style="font-size:18px;font-weight:400;color:#000;letter-spacing:1px;">${escapeHtml(brand.companyName)}</div>`;

  const coverPage = `
    <div class="page cover-page">
      <div class="accent-line"></div>
      <div class="cover-top">${logoHtml}</div>
      <div class="cover-body">
        <h1 class="cover-title">${escapeHtml(data.title)}</h1>
        <div class="cover-meta">
          <span>Proposal #${escapeHtml(data.proposalNumber)}</span>
          <span>${formatDate(data.createdAt)}</span>
        </div>
      </div>
      <div class="cover-bottom">
        <div class="cover-col">
          <p class="label">Prepared For</p>
          <p class="name">${escapeHtml(data.recipientName)}</p>
          ${data.companyName ? `<p>${escapeHtml(data.companyName)}</p>` : ''}
          ${data.recipientEmail ? `<p class="muted">${escapeHtml(data.recipientEmail)}</p>` : ''}
        </div>
        <div class="cover-col">
          <p class="label">Prepared By</p>
          <p class="name">${escapeHtml(brand.companyName)}</p>
          ${brand.contactEmail ? `<p class="muted">${escapeHtml(brand.contactEmail)}</p>` : ''}
        </div>
      </div>
      ${data.validUntil ? `<p class="validity">Valid until ${formatDate(data.validUntil)}</p>` : ''}
    </div>`;

  const aboutText = getAboutUsText(sections, brand.aboutUsText ?? `${brand.companyName} is a trusted provider of business solutions.`);
  const aboutPage = `
    <div class="page">
      <div class="accent-line"></div>
      <h2>About ${escapeHtml(brand.companyName)}</h2>
      <div class="divider"></div>
      <p>${escapeHtml(aboutText)}</p>
      ${brand.websiteUrl ? `<p class="muted">${escapeHtml(brand.websiteUrl)}</p>` : ''}
      ${brand.address ? `<p class="muted">${escapeHtml(brand.address)}</p>` : ''}
    </div>`;

  const summaryPage = `
    <div class="page">
      <div class="accent-line"></div>
      <h2>Executive Summary</h2>
      <div class="divider"></div>
      ${data.customIntroMessage ? `<p>${escapeHtml(data.customIntroMessage)}</p>` : `<p>We are pleased to present this proposal for ${escapeHtml(data.recipientName)}.</p>`}
      <div class="services-list">
        ${services.map((s) => `
          <div class="service-row">
            <span class="service-name">${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)}</span>
            <span class="service-plan">${escapeHtml(s.planName)}</span>
            <span class="service-price">${formatCurrency(s.finalPrice)}</span>
          </div>
        `).join('')}
      </div>
      <div class="summary-line">
        <span>Total</span>
        <span class="total-value">${formatCurrency(data.total)}</span>
      </div>
    </div>`;

  const servicePages = services.map((s) => `
    <div class="page">
      <div class="accent-line"></div>
      <h2>${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)}</h2>
      <div class="divider"></div>
      <p class="plan-text">${escapeHtml(s.planName)} Plan</p>
      ${s.customDescription ? `<p>${escapeHtml(s.customDescription)}</p>` : ''}
      <p class="features-text">${(s.features ?? []).map((f) => escapeHtml(String(f))).join('  ·  ')}</p>
      <div class="price-section">
        <div class="price-line"><span>List Price</span><span>${formatCurrency(s.listPrice)}</span></div>
        ${s.discountPercentage > 0 ? `<div class="price-line muted"><span>Discount (${s.discountPercentage}%)</span><span>-${formatCurrency(s.listPrice * s.discountPercentage / 100)}</span></div>` : ''}
        <div class="price-line final"><span>Your Price</span><span>${formatCurrency(s.finalPrice)}</span></div>
      </div>
    </div>
  `).join('');

  const pricingPage = `
    <div class="page">
      <div class="accent-line"></div>
      <h2>Pricing Summary</h2>
      <div class="divider"></div>
      <table class="min-table">
        <thead><tr><th>Service</th><th>Plan</th><th class="right">Price</th><th class="right">Discount</th><th class="right">Final</th></tr></thead>
        <tbody>
          ${services.map((s) => `<tr><td>${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)}</td><td>${escapeHtml(s.planName)}</td><td class="right">${formatCurrency(s.listPrice)}</td><td class="right">${s.discountPercentage > 0 ? `${s.discountPercentage}%` : '—'}</td><td class="right">${formatCurrency(s.finalPrice)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="total-line"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
        ${data.discountAmount > 0 ? `<div class="total-line"><span>Discount</span><span>-${formatCurrency(data.discountAmount)}</span></div>` : ''}
        ${data.setupFee > 0 ? `<div class="total-line"><span>Setup Fee</span><span>${formatCurrency(data.setupFee)}</span></div>` : ''}
        <div class="total-line grand"><span>Total</span><span>${formatCurrency(data.total)}</span></div>
      </div>
      <div class="meta-info">
        <p>${billingLabel(data.billingCycle)} billing</p>
        ${data.contractDuration ? `<p>${escapeHtml(data.contractDuration)} contract</p>` : ''}
        ${data.paymentTerms ? `<p>${escapeHtml(data.paymentTerms)}</p>` : ''}
      </div>
    </div>`;

  const timelineSteps = getTimelineSteps(sections);
  const timelinePage = `
    <div class="page">
      <div class="accent-line"></div>
      <h2>Implementation Timeline</h2>
      <div class="divider"></div>
      <div class="timeline">
        ${timelineSteps.map((step, i) => `<div class="tl-item"><span class="tl-num">${i + 1}</span><div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.description)}</p></div></div>`).join('')}
      </div>
    </div>`;

  const termsItems = getTermsItems(sections);
  const termsPage = `
    <div class="page">
      <div class="accent-line"></div>
      <h2>Terms & Conditions</h2>
      <div class="divider"></div>
      <ol class="terms">
        ${termsItems.map((t) => `<li><strong>${escapeHtml(t.title)}.</strong> ${escapeHtml(t.text)}</li>`).join('')}
      </ol>
    </div>`;

  const signaturePage = `
    <div class="page">
      <div class="accent-line"></div>
      <h2>Acceptance & Signature</h2>
      <div class="divider"></div>
      <p>By signing below, the parties agree to the services and terms outlined in this proposal.</p>
      <div class="acceptance-items">
        ${services.map((s) => `<div class="accept-row"><span>${escapeHtml(SERVICE_LABELS[s.serviceType] ?? s.serviceType)} — ${escapeHtml(s.planName)}</span><span>${formatCurrency(s.finalPrice)}</span></div>`).join('')}
      </div>
      <div class="sig-area">
        <div class="sig-col">
          <p class="sig-name">${escapeHtml(data.recipientName)}</p>
          <div class="sig-line"></div><p class="sig-label">Signature</p>
          <div class="sig-line-short"></div><p class="sig-label">Date</p>
        </div>
        <div class="sig-col">
          <p class="sig-name">${escapeHtml(brand.companyName)}</p>
          <div class="sig-line"></div><p class="sig-label">Signature</p>
          <div class="sig-line-short"></div><p class="sig-label">Date</p>
        </div>
      </div>
      <div class="footer-contact">
        ${brand.contactEmail ? `<span>${escapeHtml(brand.contactEmail)}</span>` : ''}
        ${brand.websiteUrl ? `<span>${escapeHtml(brand.websiteUrl)}</span>` : ''}
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
    font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 13px;
    font-weight: 300;
    color: #333;
    line-height: 1.7;
    -webkit-print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 50px 70px;
    page-break-after: always;
    position: relative;
  }
  .accent-line { height: 2px; background: ${accent}; margin-bottom: 30px; }
  .divider { height: 1px; background: #e5e5e5; margin-bottom: 24px; }
  .muted { color: #999; }
  .right { text-align: right; }

  /* Cover */
  .cover-page { display: flex; flex-direction: column; }
  .cover-top { margin-bottom: 20px; }
  .cover-body { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-title { font-size: 42px; font-weight: 300; color: #000; line-height: 1.15; margin-bottom: 16px; }
  .cover-meta { font-size: 13px; color: #999; display: flex; gap: 20px; }
  .cover-bottom { display: flex; gap: 60px; margin-top: auto; padding-top: 40px; }
  .cover-col { flex: 1; }
  .label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-bottom: 6px; }
  .name { font-size: 16px; font-weight: 400; color: #000; margin-bottom: 4px; }
  .validity { text-align: left; color: #bbb; font-size: 11px; margin-top: 20px; }

  /* Typography */
  h2 { font-size: 26px; font-weight: 300; color: #000; margin-bottom: 8px; letter-spacing: -0.5px; }
  h3 { font-size: 15px; font-weight: 400; color: #000; margin-bottom: 10px; }
  p { margin-bottom: 10px; }
  strong { font-weight: 500; }

  /* Services List */
  .services-list { margin: 24px 0; }
  .service-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
  .service-name { font-weight: 400; color: #000; }
  .service-plan { color: #999; font-size: 12px; }
  .service-price { font-weight: 400; color: #000; }
  .summary-line { display: flex; justify-content: space-between; padding: 14px 0; border-top: 1px solid #000; margin-top: 8px; }
  .total-value { font-size: 22px; font-weight: 400; color: ${accent}; }

  /* Plan */
  .plan-text { font-size: 14px; color: #666; margin-bottom: 16px; }
  .features-text { color: #666; font-size: 12px; line-height: 2; margin: 16px 0 24px; }

  /* Price Section */
  .price-section { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  .price-line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .price-line.final { border-top: 1px solid #000; margin-top: 8px; padding-top: 10px; font-weight: 400; font-size: 16px; color: ${accent}; }

  /* Minimal Table */
  .min-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .min-table th { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 400; padding: 8px 0; border-bottom: 1px solid #ddd; }
  .min-table td { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }

  /* Totals */
  .totals { margin-left: auto; width: 280px; }
  .total-line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .total-line.grand { border-top: 1px solid #000; margin-top: 6px; padding-top: 10px; font-size: 18px; font-weight: 400; color: ${accent}; }
  .meta-info { margin-top: 20px; color: #999; font-size: 12px; }
  .meta-info p { margin-bottom: 2px; }

  /* Timeline */
  .timeline { margin-top: 10px; }
  .tl-item { display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start; }
  .tl-num { width: 28px; height: 28px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999; flex-shrink: 0; }

  /* Terms */
  .terms { padding-left: 20px; }
  .terms li { margin-bottom: 12px; font-size: 13px; }

  /* Acceptance */
  .acceptance-items { margin: 20px 0 30px; }
  .accept-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }

  /* Signature */
  .sig-area { display: flex; gap: 50px; margin-top: 30px; }
  .sig-col { flex: 1; }
  .sig-name { font-size: 14px; color: #000; margin-bottom: 40px; }
  .sig-line { border-bottom: 1px solid #333; margin-bottom: 6px; height: 30px; }
  .sig-line-short { border-bottom: 1px solid #333; margin-bottom: 6px; height: 30px; width: 55%; }
  .sig-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
  .footer-contact { margin-top: 50px; text-align: center; color: #bbb; font-size: 11px; display: flex; justify-content: center; gap: 20px; }
</style>
</head>
<body>
${coverPage}
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

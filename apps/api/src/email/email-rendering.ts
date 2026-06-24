import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

export type EmailContentVariant = {
  subject: string;
  previewText?: string | null;
  body?: string | null;
  bodyPlainText?: string | null;
  contentBlocks?: Prisma.JsonValue | null;
};

export type TrackingStore = {
  trackingEvent: {
    create: (args: any) => Promise<unknown>;
  };
  unsubscribeToken: {
    create: (args: any) => Promise<unknown>;
  };
};

export type ContentQaWarning = {
  key: string;
  label: string;
  severity: 'warning' | 'error';
};

export function resolveSelectedVariant(campaign: {
  subject: string;
  previewText?: string | null;
  body?: string | null;
  bodyPlainText?: string | null;
  contentBlocks?: Prisma.JsonValue | null;
  abTestEnabled?: boolean | null;
  abVariants?: Prisma.JsonValue | null;
  selectedVariant?: string | null;
}): EmailContentVariant {
  if (!campaign.abTestEnabled || !campaign.selectedVariant || !Array.isArray(campaign.abVariants)) {
    return {
      subject: campaign.subject,
      previewText: campaign.previewText,
      body: campaign.body,
      bodyPlainText: campaign.bodyPlainText,
      contentBlocks: campaign.contentBlocks,
    };
  }

  const variant = campaign.abVariants.find((item) =>
    !!item && typeof item === 'object' && !Array.isArray(item) && (item as Record<string, unknown>).id === campaign.selectedVariant,
  ) as Record<string, unknown> | undefined;

  if (!variant) {
    return {
      subject: campaign.subject,
      previewText: campaign.previewText,
      body: campaign.body,
      bodyPlainText: campaign.bodyPlainText,
      contentBlocks: campaign.contentBlocks,
    };
  }

  return {
    subject: typeof variant.subject === 'string' && variant.subject.trim() ? variant.subject.trim() : campaign.subject,
    previewText: typeof variant.previewText === 'string' ? variant.previewText : campaign.previewText,
    body: typeof variant.body === 'string' && variant.body.trim() ? variant.body : campaign.body,
    bodyPlainText: campaign.bodyPlainText,
    contentBlocks: variant.contentBlocks as Prisma.JsonValue ?? campaign.contentBlocks,
  };
}

export function resolveVariantById(campaign: Parameters<typeof resolveSelectedVariant>[0], variantId: string): EmailContentVariant {
  if (!campaign.abTestEnabled || !Array.isArray(campaign.abVariants)) {
    return resolveSelectedVariant(campaign);
  }
  const variant = campaign.abVariants.find((item) =>
    !!item && typeof item === 'object' && !Array.isArray(item) && (item as Record<string, unknown>).id === variantId,
  ) as Record<string, unknown> | undefined;
  if (!variant) return resolveSelectedVariant(campaign);
  return {
    subject: typeof variant.subject === 'string' && variant.subject.trim() ? variant.subject.trim() : campaign.subject,
    previewText: typeof variant.previewText === 'string' ? variant.previewText : campaign.previewText,
    body: typeof variant.body === 'string' && variant.body.trim() ? variant.body : campaign.body,
    bodyPlainText: campaign.bodyPlainText,
    contentBlocks: variant.contentBlocks as Prisma.JsonValue ?? campaign.contentBlocks,
  };
}

export function getVariantIds(campaign: { abTestEnabled?: boolean | null; abVariants?: Prisma.JsonValue | null }): string[] {
  if (!campaign.abTestEnabled || !Array.isArray(campaign.abVariants)) return [];
  const ids: string[] = [];
  for (const item of campaign.abVariants) {
    if (item && typeof item === 'object' && !Array.isArray(item) && typeof (item as any).id === 'string') {
      ids.push((item as any).id);
    }
  }
  return ids;
}

export type RenderResult = { html: string; unsubscribeUrl: string } | null;

export async function renderEmailWithTracking(input: {
  store: TrackingStore;
  body: string | null | undefined;
  tenantId: string;
  campaignId: string;
  recipientId: string;
  email: string;
  trackOpens: boolean;
  trackClicks: boolean;
  companyAddress?: string | null;
  subject?: string;
}): Promise<RenderResult> {
  const { body, store, tenantId, campaignId, recipientId, email, trackOpens, trackClicks, companyAddress, subject } = input;
  if (!body) return null;
  const baseUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api`;
  const openToken = randomBytes(24).toString('base64url');
  await store.trackingEvent.create({
    data: { tenantId, campaignId, recipientId, email, type: 'token', token: openToken },
  }).catch((err) => console.warn(`[TRACKING] Failed to create open-tracking token for ${email}:`, err?.message ?? err));
  const unsubToken = randomBytes(32).toString('base64url');
  await store.unsubscribeToken.create({
    data: {
      tenantId,
      email,
      campaignId,
      tokenHash: hashValue(unsubToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    },
  }).catch((err) => console.warn(`[TRACKING] Failed to create unsubscribe token for ${email}:`, err?.message ?? err));
  const unsubUrl = `${baseUrl}/email/events/unsubscribe/${unsubToken}`;
  const linkedBody = trackClicks ? rewriteLinks(body, baseUrl, openToken) : body;
  const openPixel = trackOpens ? `<img src="${baseUrl}/email/events/open/${openToken}" alt="" width="1" height="1" style="display:none" />` : '';

  const addressLine = companyAddress ? `<p style="margin:0 0 8px 0;">${escapeHtml(companyAddress)}</p>` : '';
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(subject ?? '')}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
<tr><td align="center" style="padding:20px 0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;max-width:600px;width:100%;">
<tr><td style="padding:32px;">
${linkedBody}
</td></tr>
<tr><td style="padding:16px 32px;background-color:#f9f9f9;border-top:1px solid #eee;font-size:12px;color:#999999;text-align:center;line-height:1.5;">
${addressLine}<a href="${unsubUrl}" style="color:#999999;text-decoration:underline;">Unsubscribe</a>
</td></tr>
</table>
</td></tr>
</table>
${openPixel}
</body>
</html>`;

  return { html, unsubscribeUrl: unsubUrl };
}

export function rewriteLinks(body: string, baseUrl: string, token: string) {
  return body.replace(/href=(["'])([^"']+)\1/gi, (_match, quote: string, url: string) => {
    if (/^(mailto:|tel:|#|javascript:)/i.test(url)) return `href=${quote}${url}${quote}`;
    if (!/^https?:\/\//i.test(url)) return `href=${quote}${url}${quote}`;
    const tracked = `${baseUrl}/email/events/click/${token}?url=${encodeURIComponent(url)}`;
    return `href=${quote}${tracked}${quote}`;
  });
}

const SPAM_TRIGGER_WORDS = /\b(free|buy now|act now|limited time|click here|winner|congratulations|urgent|100% free|no cost|order now|risk.?free|call now|apply now|don't miss|exclusive deal)\b/i;

export function contentQaWarnings(input: { subject?: string; body?: string | null; previewText?: string | null }): ContentQaWarning[] {
  const warnings: ContentQaWarning[] = [];
  const subject = input.subject?.trim() ?? '';
  const body = input.body?.trim() ?? '';
  if (subject.length < 10 && subject.length > 0) warnings.push({ key: 'subject_short', label: 'Subject line is very short (under 10 characters)', severity: 'warning' });
  if (subject.length > 80) warnings.push({ key: 'subject_length', label: 'Subject line is longer than 80 characters', severity: 'warning' });
  if (subject === subject.toUpperCase() && subject.length > 5) warnings.push({ key: 'subject_caps', label: 'Subject line is ALL CAPS — may trigger spam filters', severity: 'warning' });
  if (SPAM_TRIGGER_WORDS.test(subject)) warnings.push({ key: 'subject_spam_words', label: 'Subject contains spam trigger words', severity: 'warning' });
  if ((input.previewText?.length ?? 0) > 140) warnings.push({ key: 'preview_length', label: 'Preview text is longer than 140 characters', severity: 'warning' });
  if (body && !/<a\s+[^>]*href=/i.test(body)) warnings.push({ key: 'no_links', label: 'Email has no tracked links', severity: 'warning' });
  if (/href=(["'])\s*(#|javascript:)/i.test(body)) warnings.push({ key: 'unsafe_link', label: 'Email contains an unsafe or placeholder link', severity: 'error' });
  if (/<script[\s>]/i.test(body)) warnings.push({ key: 'script_tag', label: 'Email contains <script> tags — will be stripped by email clients', severity: 'error' });
  if (/<form[\s>]/i.test(body)) warnings.push({ key: 'form_tag', label: 'Email contains <form> elements — not supported in most email clients', severity: 'error' });
  if (/<iframe[\s>]/i.test(body)) warnings.push({ key: 'iframe_tag', label: 'Email contains <iframe> — will be blocked by email clients', severity: 'error' });
  if (/<img\s+[^>]*(?!alt=)[^>]*>/i.test(body)) warnings.push({ key: 'img_no_alt', label: 'Some images are missing alt text', severity: 'warning' });
  if (SPAM_TRIGGER_WORDS.test(body)) warnings.push({ key: 'body_spam_words', label: 'Email body contains spam trigger words — may affect deliverability', severity: 'warning' });
  const validMergeTags = new Set(['firstName', 'first_name', 'lastName', 'last_name', 'email', 'companyName', 'company']);
  const usedTags = [...(body.matchAll(/\{\{(\w+)\}\}/g))].map(m => m[1]);
  const invalidTags = usedTags.filter(t => !validMergeTags.has(t));
  if (invalidTags.length > 0) warnings.push({ key: 'invalid_merge_tags', label: `Unknown merge tags: ${invalidTags.join(', ')}. Valid: ${[...validMergeTags].join(', ')}`, severity: 'error' });
  if (usedTags.length > 0 && invalidTags.length === 0) warnings.push({ key: 'merge_fields', label: 'Email contains merge fields; confirm fallback copy before sending', severity: 'warning' });
  if ((subject.match(/!/g) || []).length > 2) warnings.push({ key: 'excessive_exclamation', label: 'Too many exclamation marks in subject — spam filter risk', severity: 'warning' });
  const imgCount = (body.match(/<img\b/gi) || []).length;
  const imgWithAlt = (body.match(/<img\s+[^>]*alt="[^"]+"/gi) || []).length;
  if (imgCount > 0 && imgWithAlt < imgCount) warnings.push({ key: 'accessibility_alt', label: `${imgCount - imgWithAlt} of ${imgCount} images missing alt text — hurts accessibility and deliverability`, severity: 'warning' });
  if (body && !body.includes('lang=')) warnings.push({ key: 'accessibility_lang', label: 'Email HTML is missing lang attribute — screen readers may not detect the language', severity: 'warning' });
  const textLength = htmlToPlainText(body).length;
  if (body && textLength < 50) warnings.push({ key: 'too_short', label: 'Email body is very short — spam filters may flag thin content', severity: 'warning' });
  if (imgCount > 0 && textLength < 20) warnings.push({ key: 'image_heavy', label: 'Email is mostly images with little text — may be blocked or clipped', severity: 'warning' });
  return warnings;
}

export function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

import { resolveSelectedVariant, rewriteLinks } from './email-rendering';

describe('email rendering helpers', () => {
  it('uses the manually selected A/B variant content', () => {
    const selected = resolveSelectedVariant({
      subject: 'Variant A',
      body: '<p>A</p>',
      abTestEnabled: true,
      selectedVariant: 'b',
      abVariants: [
        { id: 'a', subject: 'Variant A', body: '<p>A</p>' },
        { id: 'b', subject: 'Variant B', body: '<p>B</p>' },
      ],
    });

    expect(selected.subject).toBe('Variant B');
    expect(selected.body).toBe('<p>B</p>');
  });

  it('records original click targets for redirect validation', async () => {
    const create = jest.fn().mockResolvedValue({});
    const html = await rewriteLinks(
      '<a href="https://example.com/a?x=1">Open</a>',
      'https://api.example.com/api',
      'token-1',
      { trackingEvent: { create } },
      { tenantId: 'tenant-1', campaignId: 'campaign-1', recipientId: 'recipient-1', email: 'a@example.com' },
    );

    expect(html).toContain('/email/events/click/token-1?url=https%3A%2F%2Fexample.com%2Fa%3Fx%3D1');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'link_target', token: 'token-1', url: 'https://example.com/a?x=1' }),
    }));
  });
});

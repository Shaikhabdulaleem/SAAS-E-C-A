import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import type { EmailContentBlock } from '../../contexts/DataContext';

const tokens = ['{{firstName}}', '{{lastName}}', '{{companyName}}'];

export function defaultEmailBlocks(): EmailContentBlock[] {
  return [
    { id: crypto.randomUUID(), type: 'text', props: { text: 'Hi {{firstName}},\n\nWe are excited to share something new with you.' } },
    { id: crypto.randomUUID(), type: 'button', props: { label: 'Explore Now', url: 'https://example.com' } },
    { id: crypto.randomUUID(), type: 'footer', props: { text: 'You are receiving this email because you subscribed to our updates.' } },
  ];
}

export function blocksToHtml(blocks: EmailContentBlock[]) {
  return blocks.map((block) => {
    if (block.type === 'text') return `<p style="font-size:16px;line-height:1.6;color:#111827;white-space:pre-line;">${escapeHtml(block.props.text ?? '')}</p>`;
    if (block.type === 'image') return block.props.url ? `<img src="${escapeAttr(block.props.url)}" alt="${escapeAttr(block.props.alt ?? '')}" style="max-width:100%;border-radius:8px;margin:16px 0;" />` : '';
    if (block.type === 'button') return `<p style="margin:24px 0;"><a href="${escapeAttr(block.props.url ?? '#')}" style="background:#4f46e5;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:600;">${escapeHtml(block.props.label ?? 'Learn more')}</a></p>`;
    if (block.type === 'offer') return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;"><strong>${escapeHtml(block.props.title ?? 'Special offer')}</strong><p>${escapeHtml(block.props.description ?? '')}</p></div>`;
    if (block.type === 'divider') return '<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0;" />';
    return `<p style="font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">${escapeHtml(block.props.text ?? '')}</p>`;
  }).join('\n');
}

export function EmailContentBuilder({ blocks, onChange }: { blocks: EmailContentBlock[]; onChange: (blocks: EmailContentBlock[]) => void }) {
  const addBlock = (type: EmailContentBlock['type']) => {
    const props: Record<string, string> = type === 'button'
      ? { label: 'Learn more', url: 'https://example.com' }
      : type === 'image'
        ? { url: '', alt: '' }
        : type === 'offer'
          ? { title: 'Product Launch Offer', description: 'Describe the product, offer, or benefit.' }
          : type === 'footer'
            ? { text: 'You are receiving this email because you subscribed to our updates.' }
            : { text: '' };
    onChange([...blocks, { id: crypto.randomUUID(), type, props }]);
  };

  const update = (id: string, key: string, value: string) => {
    onChange(blocks.map((block) => block.id === id ? { ...block, props: { ...block.props, [key]: value } } : block));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['text', 'image', 'button', 'offer', 'divider', 'footer'] as const).map((type) => (
          <Button key={type} type="button" variant="outline" size="sm" onClick={() => addBlock(type)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {type}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
        {tokens.map((token) => <span key={token} className="rounded border border-border px-2 py-1">{token}</span>)}
      </div>
      <div className="space-y-3">
        {blocks.map((block) => (
          <div key={block.id} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label className="capitalize">{block.type} block</Label>
              <button type="button" className="text-destructive" onClick={() => onChange(blocks.filter((item) => item.id !== block.id))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {block.type === 'text' || block.type === 'footer' ? (
              <Textarea value={block.props.text ?? ''} onChange={(event) => update(block.id, 'text', event.target.value)} className="min-h-[90px]" />
            ) : block.type === 'image' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Image URL" value={block.props.url ?? ''} onChange={(event) => update(block.id, 'url', event.target.value)} />
                <Input placeholder="Alt text" value={block.props.alt ?? ''} onChange={(event) => update(block.id, 'alt', event.target.value)} />
              </div>
            ) : block.type === 'button' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Button text" value={block.props.label ?? ''} onChange={(event) => update(block.id, 'label', event.target.value)} />
                <Input placeholder="Button URL" value={block.props.url ?? ''} onChange={(event) => update(block.id, 'url', event.target.value)} />
              </div>
            ) : block.type === 'offer' ? (
              <div className="space-y-2">
                <Input placeholder="Offer title" value={block.props.title ?? ''} onChange={(event) => update(block.id, 'title', event.target.value)} />
                <Textarea placeholder="Offer description" value={block.props.description ?? ''} onChange={(event) => update(block.id, 'description', event.target.value)} />
              </div>
            ) : (
              <div className="h-px bg-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

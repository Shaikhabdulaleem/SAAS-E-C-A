import { BadRequestException, Injectable } from '@nestjs/common';
import { ProviderLogsService } from './provider-logs.service';

@Injectable()
export class TranscriptionService {
  constructor(private readonly logs: ProviderLogsService) {}

  async summarize(input: { tenantId: string; transcript: string; userId: string }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const summary = this.localSummary(input.transcript);
      await this.logs.create({
        tenantId: input.tenantId,
        provider: 'openai',
        operation: 'call_summary',
        status: 'failed',
        error: 'OPENAI_API_KEY is not configured; local summary used',
      });
      return { ...summary, model: 'local-call-summary', tokens: Math.ceil(input.transcript.length / 4) };
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUMMARY_MODEL ?? 'gpt-4.1-mini',
        input: `Return JSON with summary, objections array, actionItems array, sentiment, coachingScore 0-100, followUpEmail.\n\nTranscript:\n${input.transcript}`,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      await this.logs.create({
        tenantId: input.tenantId,
        provider: 'openai',
        operation: 'call_summary',
        status: 'failed',
        response: body,
        error: JSON.stringify(body),
      });
      throw new BadRequestException('OpenAI call summary failed');
    }

    const text = body.output_text ?? body.output?.[0]?.content?.[0]?.text ?? '';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { summary: text };
    }
    await this.logs.create({
      tenantId: input.tenantId,
      provider: 'openai',
      operation: 'call_summary',
      status: 'success',
      response: { model: body.model, id: body.id },
    });
    return {
      summary: String(parsed.summary ?? text),
      objections: Array.isArray(parsed.objections) ? parsed.objections : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      sentiment: typeof parsed.sentiment === 'string' ? parsed.sentiment : 'neutral',
      coachingScore: Number(parsed.coachingScore ?? 70),
      followUpEmail: typeof parsed.followUpEmail === 'string' ? parsed.followUpEmail : '',
      model: body.model ?? process.env.OPENAI_SUMMARY_MODEL ?? 'gpt-4.1-mini',
      tokens: Math.ceil((input.transcript.length + text.length) / 4),
    };
  }

  private localSummary(transcript: string) {
    const first = transcript.split(/[.!?]/).find((part) => part.trim().length > 0)?.trim() ?? 'Call transcript received';
    return {
      summary: `${first}. Review the transcript for next steps and objections.`,
      objections: [],
      actionItems: ['Review transcript', 'Send follow-up email', 'Update CRM notes'],
      sentiment: 'neutral',
      coachingScore: 70,
      followUpEmail: 'Hi, thanks for the conversation. I will follow up with the next steps we discussed.',
    };
  }
}

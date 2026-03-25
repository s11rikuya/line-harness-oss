// Meta Conversions API (Server-Side Events)
// https://developers.facebook.com/docs/marketing-api/conversions-api

const META_API_VERSION = 'v19.0';

export interface MetaConversionEventInput {
  pixelId: string;
  accessToken: string;
  eventName: string;
  eventTime: number;
  lineUserId: string;
  value?: number | null;
  currency?: string;
  testEventCode?: string | null;
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sendMetaConversionEvent(
  input: MetaConversionEventInput,
): Promise<{ success: boolean; error?: string }> {
  const { pixelId, accessToken, eventName, eventTime, lineUserId, value, currency, testEventCode } =
    input;

  const externalId = await sha256Hex(lineUserId);

  const eventData: Record<string, unknown> = {
    event_name: eventName,
    event_time: eventTime,
    action_source: 'other',
    user_data: {
      external_id: [externalId],
    },
  };

  if (value != null) {
    eventData.custom_data = {
      value,
      currency: currency ?? 'JPY',
    };
  }

  const body: Record<string, unknown> = { data: [eventData] };
  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  try {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Meta Conversions API error (${res.status}):`, text);
      return { success: false, error: text };
    }

    return { success: true };
  } catch (err) {
    console.error('Meta Conversions API fetch failed:', err);
    return { success: false, error: String(err) };
  }
}

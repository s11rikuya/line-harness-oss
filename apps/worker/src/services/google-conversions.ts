// GA4 Measurement Protocol (Server-Side Events)
// https://developers.google.com/analytics/devguides/collection/protocol/ga4

const GA4_MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

export interface GoogleConversionEventInput {
  measurementId: string;
  apiSecret: string;
  eventName: string;
  lineUserId: string;
  value?: number | null;
  currency?: string;
}

export async function sendGoogleConversionEvent(
  input: GoogleConversionEventInput,
): Promise<{ success: boolean; error?: string }> {
  const { measurementId, apiSecret, eventName, lineUserId, value, currency } = input;

  const params: Record<string, unknown> = {};
  if (value != null) {
    params.value = value;
    params.currency = currency ?? 'JPY';
  }

  const body = {
    client_id: lineUserId,
    events: [
      {
        name: eventName,
        params,
      },
    ],
  };

  try {
    const url = `${GA4_MP_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // GA4 MP returns 204 on success
    if (res.status !== 200 && res.status !== 204) {
      const text = await res.text();
      console.error(`GA4 Measurement Protocol error (${res.status}):`, text);
      return { success: false, error: text };
    }

    return { success: true };
  } catch (err) {
    console.error('GA4 Measurement Protocol fetch failed:', err);
    return { success: false, error: String(err) };
  }
}

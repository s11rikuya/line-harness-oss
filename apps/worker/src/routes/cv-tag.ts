// CV Tag endpoint — called by the embed script on merchant websites
// Public route (no API key required). Fires Meta/Google Conversions APIs server-side.
import { Hono } from 'hono';
import { getConversionPointByToken, recordCvTagHit } from '@line-crm/db';
import { sendMetaConversionEvent } from '../services/meta-conversions.js';
import { sendGoogleConversionEvent } from '../services/google-conversions.js';
import type { Env } from '../index.js';

// 1x1 transparent GIF
const PIXEL_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (c) => c.charCodeAt(0),
);

const cvTag = new Hono<Env>();

// POST /cv/:token  — JS fetch tag
// GET  /cv/:token  — img pixel tag
cvTag.on(['GET', 'POST'], '/cv/:token', async (c) => {
  const token = c.req.param('token');

  const point = await getConversionPointByToken(c.env.DB, token);
  if (!point) {
    if (c.req.method === 'GET') {
      return new Response(PIXEL_GIF, {
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
      });
    }
    return c.json({ success: false, error: 'Not found' }, 404);
  }

  let visitorId: string | null = null;
  let pageUrl: string | null = null;
  let ref: string | null = null;

  if (c.req.method === 'POST') {
    try {
      const body = await c.req.json<{
        visitor_id?: string;
        url?: string;
        ref?: string;
      }>();
      visitorId = body.visitor_id ?? null;
      pageUrl = body.url ?? null;
      ref = body.ref ?? null;
    } catch {
      // body is optional
    }
  } else {
    visitorId = c.req.query('vid') ?? null;
    pageUrl = c.req.query('url') ?? null;
    ref = c.req.query('ref') ?? null;
  }

  const eventId = visitorId ?? crypto.randomUUID();

  c.executionCtx.waitUntil(
    (async () => {
      await recordCvTagHit(c.env.DB, {
        conversionPointId: point.id,
        visitorId,
        pageUrl,
        ref,
      });

      const eventTime = Math.floor(Date.now() / 1000);

      if (point.meta_pixel_id && point.meta_access_token && point.meta_event_name) {
        await sendMetaConversionEvent({
          pixelId: point.meta_pixel_id,
          accessToken: point.meta_access_token,
          eventName: point.meta_event_name,
          eventTime,
          lineUserId: eventId,
          value: point.value,
          testEventCode: point.meta_test_event_code,
        });
      }

      if (point.google_measurement_id && point.google_api_secret && point.google_event_name) {
        await sendGoogleConversionEvent({
          measurementId: point.google_measurement_id,
          apiSecret: point.google_api_secret,
          eventName: point.google_event_name,
          lineUserId: eventId,
          value: point.value,
        });
      }
    })(),
  );

  if (c.req.method === 'GET') {
    return new Response(PIXEL_GIF, {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }

  return c.json({ success: true });
});

export { cvTag };

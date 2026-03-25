// CV Tag endpoint — called by the embed script on merchant websites.
// When a LINE user visits a specific page (e.g. purchase complete),
// this endpoint identifies them via the `ref` parameter and assigns
// the configured tags automatically.
import { Hono } from 'hono';
import { getConversionPointByToken, getConversionPointTagIds } from '@line-crm/db';
import { addTagToFriend } from '@line-crm/db';
import type { Env } from '../index.js';

// 1x1 transparent GIF
const PIXEL_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (c) => c.charCodeAt(0),
);

const cvTag = new Hono<Env>();

// POST /cv/:token  — JS fetch tag
// GET  /cv/:token  — img pixel tag (fallback)
cvTag.on(['GET', 'POST'], '/cv/:token', async (c) => {
  const token = c.req.param('token');

  const point = await getConversionPointByToken(c.env.DB, token);
  if (!point) {
    return c.req.method === 'GET'
      ? new Response(PIXEL_GIF, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } })
      : c.json({ success: false, error: 'Not found' }, 404);
  }

  let ref: string | null = null;
  let pageUrl: string | null = null;

  if (c.req.method === 'POST') {
    try {
      const body = await c.req.json<{ ref?: string; url?: string }>();
      ref = body.ref ?? null;
      pageUrl = body.url ?? null;
    } catch {
      // body is optional
    }
  } else {
    ref = c.req.query('ref') ?? null;
    pageUrl = c.req.query('url') ?? null;
  }

  if (ref) {
    c.executionCtx.waitUntil(
      (async () => {
        // ref_tracking から LINE ユーザー (friend_id) を特定
        const tracking = await c.env.DB
          .prepare(
            `SELECT friend_id FROM ref_tracking WHERE ref_code = ? AND friend_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
          )
          .bind(ref)
          .first<{ friend_id: string }>();

        if (!tracking?.friend_id) return;

        const friendId = tracking.friend_id;
        const tagIds = await getConversionPointTagIds(c.env.DB, point.id);

        if (tagIds.length > 0) {
          await Promise.all(tagIds.map((tagId) => addTagToFriend(c.env.DB, friendId, tagId)));
          console.log(`[cv-tag] Assigned ${tagIds.length} tag(s) to friend ${friendId} via ref=${ref}`);
        }
      })(),
    );
  }

  if (c.req.method === 'GET') {
    return new Response(PIXEL_GIF, {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }

  return c.json({ success: true });
});

export { cvTag };

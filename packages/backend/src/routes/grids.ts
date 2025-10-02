import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../lib/auth.js';

const BoundsSchema = z.object({ north: z.number(), south: z.number(), east: z.number(), west: z.number() });
const SupplyNeedSchema = z.object({ name: z.string(), quantity: z.number(), unit: z.string(), received: z.number().optional() });
const GridCreateSchema = z.object({
  code: z.string(),
  grid_type: z.string(),
  disaster_area_id: z.string(),
  volunteer_needed: z.number().optional(),
  meeting_point: z.string().optional(),
  risks_notes: z.string().optional(),
  contact_info: z.string().optional(),
  center_lat: z.number(),
  center_lng: z.number(),
  bounds: BoundsSchema.optional(),
  status: z.string().optional(),
  supplies_needed: z.array(SupplyNeedSchema).optional(),
  grid_manager_id: z.string().optional()
});

export function registerGridRoutes(app: FastifyInstance) {
  // Public read access - no auth required for viewing grids
  app.get('/grids', async () => {
    if (!app.hasDecorator('db')) return [];
    const { rows } = await app.db.query('SELECT * FROM grids ORDER BY created_at DESC');
    return rows;
  });

  // Protected: Creating grids requires authentication
  app.post('/grids', { preHandler: requireAuth }, async (req: AuthenticatedRequest, reply) => {
    const body = GridCreateSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ message: 'Invalid payload', issues: body.error.issues });
    if (!app.hasDecorator('db')) return reply.status(503).send({ message: 'DB not ready' });
    const id = randomUUID();
    const d = body.data;
    const { rows } = await app.db.query(
      `INSERT INTO grids (id, code, grid_type, disaster_area_id, volunteer_needed, meeting_point, risks_notes, contact_info, center_lat, center_lng, bounds, status, supplies_needed, grid_manager_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [id, d.code, d.grid_type, d.disaster_area_id, d.volunteer_needed||0, d.meeting_point||null, d.risks_notes||null, d.contact_info||null, d.center_lat, d.center_lng, d.bounds?JSON.stringify(d.bounds):null, d.status||'open', d.supplies_needed?JSON.stringify(d.supplies_needed):null, d.grid_manager_id||null]
    );
    return reply.status(201).send(rows[0]);
  });

  // Public read access - no auth required for viewing individual grids
  app.get('/grids/:id', async (req, reply) => {
    const { id } = req.params as any;
    if (!app.hasDecorator('db')) return reply.status(404).send({ message: 'Not found' });
    const { rows } = await app.db.query('SELECT * FROM grids WHERE id=$1', [id]);
    if (!rows[0]) return reply.status(404).send({ message: 'Not found' });
    return rows[0];
  });

  // Protected: Updating grids requires authentication
  app.put('/grids/:id', { preHandler: requireAuth }, async (req: AuthenticatedRequest, reply) => {
    const { id } = req.params as any;
    const body = GridCreateSchema.partial().safeParse(req.body);
    if (!body.success) return reply.status(400).send({ message: 'Invalid payload', issues: body.error.issues });
    if (!app.hasDecorator('db')) return reply.status(503).send({ message: 'DB not ready' });
    const fields = body.data;
    const set: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [k,v] of Object.entries(fields)) {
      set.push(`${k}=$${i++}`);
      if (k === 'bounds' || k === 'supplies_needed') values.push(v?JSON.stringify(v):null); else values.push(v);
    }
    if (set.length===0) return reply.send({ updated:false });
    values.push(id);
    const { rows } = await app.db.query(`UPDATE grids SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${i} RETURNING *`, values);
    if (!rows[0]) return reply.status(404).send({ message: 'Not found' });
    return rows[0];
  });

  // Protected: Deleting grids requires authentication
  app.delete('/grids/:id', { preHandler: requireAuth }, async (req: AuthenticatedRequest, reply) => {
    const { id } = req.params as any;
    if (!app.hasDecorator('db')) return reply.status(503).send({ message: 'DB not ready' });
    await app.db.query('DELETE FROM grids WHERE id=$1', [id]);
    return reply.status(204).send();
  });
}
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../lib/auth.js';

const CreateSchema = z.object({ grid_id: z.string(), user_id: z.string() });

export function registerVolunteerRegistrationRoutes(app: FastifyInstance) {
  // Protected: Viewing registrations requires authentication
  app.get('/volunteer-registrations', { preHandler: requireAuth }, async () => {
    if (!app.hasDecorator('db')) return [];
    const { rows } = await app.db.query('SELECT * FROM volunteer_registrations ORDER BY created_at DESC');
    return rows;
  });
  
  // Protected: Creating registrations requires authentication
  app.post('/volunteer-registrations', { preHandler: requireAuth }, async (req: AuthenticatedRequest, reply) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid payload', issues: parsed.error.issues });
    if (!app.hasDecorator('db')) return reply.status(503).send({ message: 'DB not ready' });
    const id = randomUUID();
    const { grid_id, user_id } = parsed.data;
    const { rows } = await app.db.query('INSERT INTO volunteer_registrations (id, grid_id, user_id) VALUES ($1,$2,$3) RETURNING *', [id, grid_id, user_id]);
    return reply.status(201).send(rows[0]);
  });
  // Protected: Deleting registrations requires authentication
  app.delete('/volunteer-registrations/:id', { preHandler: requireAuth }, async (req: AuthenticatedRequest, reply) => {
    const { id } = req.params as any;
    if (!app.hasDecorator('db')) return reply.status(503).send({ message: 'DB not ready' });
    await app.db.query('DELETE FROM volunteer_registrations WHERE id=$1', [id]);
    return reply.status(204).send();
  });
}
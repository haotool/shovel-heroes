import type { FastifyInstance } from 'fastify';
import { listDisasterAreas, createDisasterArea, getDisasterArea, updateDisasterArea, deleteDisasterArea } from '../modules/disaster-areas/repo.js';
import { z } from 'zod';

const BoundsSchema = z.object({ north: z.number(), south: z.number(), east: z.number(), west: z.number() });
const CreateSchema = z.object({
  name: z.string().min(1),
  township: z.string().optional(),
  county: z.string().optional(),
  center_lat: z.number().min(-90).max(90),
  center_lng: z.number().min(-180).max(180),
  bounds: BoundsSchema.optional(),
  grid_size: z.number().int().positive().optional(),
  status: z.string().optional(),
  description: z.string().optional()
});

const UpdateSchema = CreateSchema.partial();

export function registerDisasterAreaRoutes(app: FastifyInstance) {
  app.get('/disaster-areas', async () => {
    return listDisasterAreas(app);
  });

  app.post('/disaster-areas', async (req, reply) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid payload', issues: parsed.error.issues });
    }
    const created = await createDisasterArea(app, parsed.data);
    return reply.status(201).send(created);
  });

  app.get('/disaster-areas/:id', async (req, reply) => {
    const { id } = req.params as any;
    const da = await getDisasterArea(app, id);
    if (!da) return reply.status(404).send({ message: 'Not found' });
    return da;
  });

  app.put('/disaster-areas/:id', async (req, reply) => {
    const { id } = req.params as any;
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ message: 'Invalid payload', issues: parsed.error.issues });
    try {
      const updated = await updateDisasterArea(app, id, parsed.data);
      if (!updated) return reply.status(404).send({ message: 'Not found' });
      return updated;
    } catch (err: any) {
      if (err && err.message && err.message.includes('Invalid field name')) {
        app.log.warn({ msg: 'Invalid field name attempted', endpoint: 'PUT /disaster-areas/:id', error: err.message });
        return reply.status(400).send({ message: 'Invalid field name' });
      }
      throw err;
    }
  });

  app.delete('/disaster-areas/:id', async (req, reply) => {
    const { id } = req.params as any;
    const ok = await deleteDisasterArea(app, id);
    if (!ok) return reply.status(404).send({ message: 'Not found' });
    return reply.status(204).send();
  });
}
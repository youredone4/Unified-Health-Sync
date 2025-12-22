
import { z } from 'zod';
import { 
  insertMotherSchema, mothers,
  insertChildSchema, children,
  insertSeniorSchema, seniors,
  insertInventorySchema, inventory,
  healthStations
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  mothers: {
    list: {
      method: 'GET' as const,
      path: '/api/mothers',
      responses: {
        200: z.array(z.custom<typeof mothers.$inferSelect>()),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/mothers/:id',
      input: insertMotherSchema.partial(),
      responses: {
        200: z.custom<typeof mothers.$inferSelect>(),
      },
    },
  },
  children: {
    list: {
      method: 'GET' as const,
      path: '/api/children',
      responses: {
        200: z.array(z.custom<typeof children.$inferSelect>()),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/children/:id',
      input: insertChildSchema.partial(),
      responses: {
        200: z.custom<typeof children.$inferSelect>(),
      },
    },
  },
  seniors: {
    list: {
      method: 'GET' as const,
      path: '/api/seniors',
      responses: {
        200: z.array(z.custom<typeof seniors.$inferSelect>()),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/seniors/:id',
      input: insertSeniorSchema.partial(),
      responses: {
        200: z.custom<typeof seniors.$inferSelect>(),
      },
    },
  },
  inventory: {
    list: {
      method: 'GET' as const,
      path: '/api/inventory',
      responses: {
        200: z.array(z.custom<typeof inventory.$inferSelect>()),
      },
    },
  },
  healthStations: {
    list: {
      method: 'GET' as const,
      path: '/api/health-stations',
      responses: {
        200: z.array(z.custom<typeof healthStations.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

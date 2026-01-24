import { z } from 'zod';
import { 
  insertMotherSchema, mothers,
  insertChildSchema, children,
  insertSeniorSchema, seniors,
  insertInventorySchema, inventory,
  healthStations,
  insertSmsSchema, smsOutbox,
  insertDiseaseCaseSchema, diseaseCases,
  insertTBPatientSchema, tbPatients,
  insertThemeSettingsSchema, themeSettings
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
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
    get: {
      method: 'GET' as const,
      path: '/api/mothers/:id',
      responses: {
        200: z.custom<typeof mothers.$inferSelect>(),
        404: errorSchemas.notFound,
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
    get: {
      method: 'GET' as const,
      path: '/api/children/:id',
      responses: {
        200: z.custom<typeof children.$inferSelect>(),
        404: errorSchemas.notFound,
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
    get: {
      method: 'GET' as const,
      path: '/api/seniors/:id',
      responses: {
        200: z.custom<typeof seniors.$inferSelect>(),
        404: errorSchemas.notFound,
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
  sms: {
    list: {
      method: 'GET' as const,
      path: '/api/sms',
      responses: {
        200: z.array(z.custom<typeof smsOutbox.$inferSelect>()),
      },
    },
    send: {
      method: 'POST' as const,
      path: '/api/sms',
      input: insertSmsSchema,
      responses: {
        201: z.custom<typeof smsOutbox.$inferSelect>(),
      },
    },
  },
  diseaseCases: {
    list: {
      method: 'GET' as const,
      path: '/api/disease-cases',
      responses: {
        200: z.array(z.custom<typeof diseaseCases.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/disease-cases/:id',
      responses: {
        200: z.custom<typeof diseaseCases.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/disease-cases/:id',
      input: insertDiseaseCaseSchema.partial(),
      responses: {
        200: z.custom<typeof diseaseCases.$inferSelect>(),
      },
    },
  },
  tbPatients: {
    list: {
      method: 'GET' as const,
      path: '/api/tb-patients',
      responses: {
        200: z.array(z.custom<typeof tbPatients.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/tb-patients/:id',
      responses: {
        200: z.custom<typeof tbPatients.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/tb-patients/:id',
      input: insertTBPatientSchema.partial(),
      responses: {
        200: z.custom<typeof tbPatients.$inferSelect>(),
      },
    },
  },
  themeSettings: {
    get: {
      method: 'GET' as const,
      path: '/api/theme-settings',
      responses: {
        200: z.custom<typeof themeSettings.$inferSelect>(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/theme-settings',
      input: insertThemeSettingsSchema.partial(),
      responses: {
        200: z.custom<typeof themeSettings.$inferSelect>(),
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

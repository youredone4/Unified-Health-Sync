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
  insertThemeSettingsSchema, themeSettings,
  insertConsultSchema, consults
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
    create: {
      method: 'POST' as const,
      path: '/api/mothers',
      input: insertMotherSchema,
      responses: {
        201: z.custom<typeof mothers.$inferSelect>(),
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
    delete: {
      method: 'DELETE' as const,
      path: '/api/mothers/:id',
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
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
    create: {
      method: 'POST' as const,
      path: '/api/children',
      input: insertChildSchema,
      responses: {
        201: z.custom<typeof children.$inferSelect>(),
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
    delete: {
      method: 'DELETE' as const,
      path: '/api/children/:id',
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
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
    create: {
      method: 'POST' as const,
      path: '/api/seniors',
      input: insertSeniorSchema,
      responses: {
        201: z.custom<typeof seniors.$inferSelect>(),
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
    delete: {
      method: 'DELETE' as const,
      path: '/api/seniors/:id',
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
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
    create: {
      method: 'POST' as const,
      path: '/api/disease-cases',
      input: insertDiseaseCaseSchema,
      responses: {
        201: z.custom<typeof diseaseCases.$inferSelect>(),
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
    create: {
      method: 'POST' as const,
      path: '/api/tb-patients',
      input: insertTBPatientSchema,
      responses: {
        201: z.custom<typeof tbPatients.$inferSelect>(),
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
  consults: {
    list: {
      method: 'GET' as const,
      path: '/api/consults',
      responses: {
        200: z.array(z.custom<typeof consults.$inferSelect>()),
      },
    },
    byPatient: {
      method: 'GET' as const,
      path: '/api/consults/by-patient',
      query: z.object({ name: z.string(), barangay: z.string() }),
      responses: {
        200: z.array(z.custom<typeof consults.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/consults/:id',
      responses: {
        200: z.custom<typeof consults.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/consults',
      input: insertConsultSchema,
      responses: {
        201: z.custom<typeof consults.$inferSelect>(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/consults/:id',
      input: insertConsultSchema.partial(),
      responses: {
        200: z.custom<typeof consults.$inferSelect>(),
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

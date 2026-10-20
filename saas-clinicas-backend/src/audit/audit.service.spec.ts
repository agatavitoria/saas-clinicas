import type { ClsService } from 'nestjs-cls';
import type { AuditClsStore } from './audit-context.js';
import { AuditService } from './audit.service.js';

function clsWith(store: AuditClsStore | null) {
  return {
    isActive: () => store !== null,
    get: (key: keyof AuditClsStore) => store?.[key],
  } as unknown as ClsService<AuditClsStore>;
}

const actor = {
  type: 'USER' as const,
  id: 'user-1',
  label: 'Ana',
  tenantId: 'clinic-1',
};

describe('AuditService', () => {
  const create = vi.fn();
  const db = { auditLog: { create } };

  beforeEach(() => create.mockReset());

  it('fills actor, tenant, IP and user agent from the request context', async () => {
    const service = new AuditService(
      clsWith({ actor, ip: '203.0.113.7', userAgent: 'Firefox' }),
    );

    await service.log(db, 'user.deactivated', {
      target: { type: 'User', id: 'user-2', label: 'Rafa' },
      metadata: { active: { from: true, to: false } },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: 'clinic-1',
        actorType: 'USER',
        actorId: 'user-1',
        actorLabel: 'Ana',
        action: 'user.deactivated',
        targetType: 'User',
        targetId: 'user-2',
        targetLabel: 'Rafa',
        metadata: { active: { from: true, to: false } },
        ip: '203.0.113.7',
        userAgent: 'Firefox',
      },
    });
  });

  it('lets the caller override the actor and the tenant', async () => {
    const service = new AuditService(clsWith({ actor }));
    const master = {
      type: 'PLATFORM_ADMIN' as const,
      id: 'm1',
      label: 'Master',
      tenantId: null,
    };

    await service.log(db, 'clinic.created', {
      actor: master,
      tenantId: 'clinic-9',
    });

    expect(create.mock.calls[0][0].data).toMatchObject({
      actorType: 'PLATFORM_ADMIN',
      actorLabel: 'Master',
      tenantId: 'clinic-9',
    });
  });

  it('falls back to the system actor outside a request', async () => {
    const service = new AuditService(clsWith(null));

    await service.log(db, 'clinic.purged');

    expect(create.mock.calls[0][0].data).toMatchObject({
      actorType: 'SYSTEM',
      actorId: null,
      actorLabel: 'Sistema',
      tenantId: null,
      ip: null,
      targetType: null,
      metadata: {},
    });
  });
});

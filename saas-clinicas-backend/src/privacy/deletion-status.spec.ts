import { deletionStatus, withDeletionInfo } from './deletion-status.js';

const none = {
  deletionRequestedAt: null,
  deletionScheduledFor: null,
  deletionReason: null,
};

describe('deletion status', () => {
  it('is NONE without a request', () => {
    expect(deletionStatus(none)).toBe('NONE');
  });

  it('is REQUESTED after the admin asks', () => {
    expect(deletionStatus({ ...none, deletionRequestedAt: new Date() })).toBe(
      'REQUESTED',
    );
  });

  it('is SCHEDULED once the master confirms', () => {
    expect(
      deletionStatus({
        ...none,
        deletionRequestedAt: new Date(),
        deletionScheduledFor: new Date(),
      }),
    ).toBe('SCHEDULED');
  });

  it('replaces the raw fields with a deletion summary', () => {
    const requestedAt = new Date();
    const result = withDeletionInfo({
      id: 'c1',
      ...none,
      deletionRequestedAt: requestedAt,
      deletionReason: 'Encerramos as atividades',
    });

    expect(result).toEqual({
      id: 'c1',
      deletion: {
        status: 'REQUESTED',
        requestedAt,
        scheduledFor: null,
        reason: 'Encerramos as atividades',
      },
    });
  });
});

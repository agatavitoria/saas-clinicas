import { UnauthorizedException } from '@nestjs/common';
import {
  hashToken,
  RefreshTokenRotation,
  type RefreshTokenStore,
  type StoredRefreshToken,
} from './refresh-token-rotation.js';

/** Store em memória: o dono do token é uma string. */
function memoryStore() {
  const tokens = new Map<
    string,
    StoredRefreshToken<string> & { hash: string }
  >();
  let nextId = 1;

  const store: RefreshTokenStore<string> = {
    create: async (owner, tokenHash, expiresAt) => {
      const id = String(nextId++);
      tokens.set(id, {
        id,
        owner,
        hash: tokenHash,
        expiresAt,
        revokedAt: null,
      });
    },
    findByHash: async (hash) =>
      [...tokens.values()].find((token) => token.hash === hash) ?? null,
    revoke: async ({ id }) => {
      const token = tokens.get(id)!;
      if (token.revokedAt) return false;
      token.revokedAt = new Date();
      return true;
    },
    revokeAllOf: async (owner) => {
      for (const token of tokens.values()) {
        if (token.owner === owner) token.revokedAt ??= new Date();
      }
    },
    revokeByHash: async (hash) => {
      const token = [...tokens.values()].find((t) => t.hash === hash);
      if (!token || token.revokedAt) return null;
      token.revokedAt = new Date();
      return token.owner;
    },
  };
  return { store, tokens };
}

describe('RefreshTokenRotation', () => {
  let rotation: RefreshTokenRotation<string>;
  let tokens: ReturnType<typeof memoryStore>['tokens'];
  const onReuseDetected = vi.fn();

  beforeEach(() => {
    onReuseDetected.mockReset();
    const memory = memoryStore();
    tokens = memory.tokens;
    rotation = new RefreshTokenRotation(memory.store, {
      ttlDays: 7,
      onReuseDetected,
    });
  });

  it('stores only the hash of the token', async () => {
    const { token } = await rotation.issue('user-1');

    const [stored] = tokens.values();
    expect(stored.hash).toBe(hashToken(token));
    expect(stored.hash).not.toBe(token);
  });

  it('sets the expiration from the TTL in days', async () => {
    const before = Date.now();
    const { expiresAt } = await rotation.issue('user-1');

    expect((expiresAt.getTime() - before) / 86_400_000).toBeCloseTo(7, 2);
  });

  it('consumes a valid token once and returns its owner', async () => {
    const { token } = await rotation.issue('user-1');

    await expect(rotation.consume(token)).resolves.toBe('user-1');
    await expect(rotation.consume(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes every token of the owner when a used token is replayed', async () => {
    const { token: used } = await rotation.issue('user-1');
    await rotation.consume(used);
    const { token: fresh } = await rotation.issue('user-1');
    const { token: otherUser } = await rotation.issue('user-2');

    await expect(rotation.consume(used)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(rotation.consume(fresh)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(rotation.consume(otherUser)).resolves.toBe('user-2');
    expect(onReuseDetected).toHaveBeenCalledWith('user-1');
  });

  it('rejects an expired token', async () => {
    const { token } = await rotation.issue('user-1');
    for (const stored of tokens.values()) stored.expiresAt = new Date(0);

    await expect(rotation.consume(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a missing or unknown token', async () => {
    await expect(rotation.consume(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(rotation.consume('unknown')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes a token on logout and returns its owner', async () => {
    const { token } = await rotation.issue('user-1');
    await expect(rotation.revoke(token)).resolves.toBe('user-1');
    await expect(rotation.revoke(token)).resolves.toBeNull();

    await expect(rotation.consume(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

import { UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export interface StoredRefreshToken<TOwner> {
  id: string;
  expiresAt: Date;
  revokedAt: Date | null;
  owner: TOwner;
}

/** Persistência dos refresh tokens de um tipo de sessão. */
export interface RefreshTokenStore<TOwner> {
  create(owner: TOwner, tokenHash: string, expiresAt: Date): Promise<void>;
  findByHash(tokenHash: string): Promise<StoredRefreshToken<TOwner> | null>;
  /** Revoga só se ainda estiver ativo; devolve se revogou. */
  revoke(token: StoredRefreshToken<TOwner>): Promise<boolean>;
  revokeAllOf(owner: TOwner): Promise<void>;
  revokeByHash(tokenHash: string): Promise<void>;
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * Regras de refresh token compartilhadas pelas sessões de clínica e de
 * plataforma: valor aleatório, só o hash no banco, rotação a cada uso e
 * revogação de todas as sessões quando um token já usado reaparece.
 */
export class RefreshTokenRotation<TOwner> {
  constructor(
    private readonly store: RefreshTokenStore<TOwner>,
    private readonly ttlDays: number,
  ) {}

  async issue(owner: TOwner): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlDays * DAY_IN_MS);
    await this.store.create(owner, hashToken(token), expiresAt);
    return { token, expiresAt };
  }

  /** Consome o token e devolve o dono; quem chama emite a nova sessão. */
  async consume(token: string | undefined): Promise<TOwner> {
    if (!token) throw new UnauthorizedException();

    const stored = await this.store.findByHash(hashToken(token));
    if (!stored) throw new UnauthorizedException();

    if (stored.revokedAt) {
      // Token já usado reapresentado: assume vazamento
      await this.store.revokeAllOf(stored.owner);
      throw new UnauthorizedException();
    }
    if (stored.expiresAt <= new Date()) throw new UnauthorizedException();

    // Em requisições simultâneas com o mesmo token, só uma consegue revogar
    if (!(await this.store.revoke(stored))) throw new UnauthorizedException();

    return stored.owner;
  }

  async revoke(token: string | undefined): Promise<void> {
    if (token) await this.store.revokeByHash(hashToken(token));
  }

  revokeAllOf(owner: TOwner): Promise<void> {
    return this.store.revokeAllOf(owner);
  }
}

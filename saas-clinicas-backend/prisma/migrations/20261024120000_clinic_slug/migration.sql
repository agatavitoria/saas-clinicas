-- Subdomínio da clínica. As clínicas existentes recebem um slug derivado do
-- nome (minúsculas, sem acento, hífens); em caso de repetição, ou de nome
-- reservado/curto demais, o slug ganha um trecho do id.
ALTER TABLE "clinics" ADD COLUMN "slug" TEXT;

WITH base AS (
  SELECT
    "id",
    trim(BOTH '-' FROM regexp_replace(
      translate(
        lower("name"),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+', '-', 'g'
    )) AS slug
  FROM "clinics"
),
ranked AS (
  SELECT
    "id",
    left(slug, 50) AS slug,
    row_number() OVER (PARTITION BY left(slug, 50) ORDER BY "id") AS position
  FROM base
)
UPDATE "clinics" c
SET "slug" = CASE
  WHEN r.position = 1
    AND length(r.slug) >= 3
    -- Mesma lista de src/clinics/slug.ts (RESERVED_SLUGS)
    AND r.slug NOT IN (
      'admin', 'api', 'app', 'assets', 'auth', 'blog', 'cdn', 'dashboard',
      'docs', 'ftp', 'help', 'login', 'mail', 'master', 'painel', 'plataforma',
      'smtp', 'static', 'status', 'suporte', 'support', 'www'
    )
    THEN r.slug
  ELSE trim(BOTH '-' FROM concat_ws('-', nullif(r.slug, ''), left(replace(c."id"::text, '-', ''), 8)))
END
FROM ranked r
WHERE r."id" = c."id";

ALTER TABLE "clinics" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "clinics_slug_key" ON "clinics"("slug");

-- Vários papéis por usuário: role (único) vira roles (lista, pelo menos um).
-- Converte os dados existentes antes de remover a coluna antiga.
ALTER TABLE "users" ADD COLUMN "roles" "UserRole"[];
UPDATE "users" SET "roles" = ARRAY["role"];
ALTER TABLE "users" ALTER COLUMN "roles" SET NOT NULL;
ALTER TABLE "users" DROP COLUMN "role";

ALTER TABLE "users"
  ADD CONSTRAINT "users_roles_not_empty" CHECK (cardinality("roles") > 0);

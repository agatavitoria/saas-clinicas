BACKEND_DIR  := saas-clinicas-backend
FRONTEND_DIR := saas-clinicas-frontend

# Permite `make up`, `make up back` e `make up front`
TARGET := $(filter-out up,$(MAKECMDGOALS))

.PHONY: install up back front db db-down migrate

# Instala as dependências dos dois projetos (a raiz não tem package.json)
install:
	@cd $(BACKEND_DIR) && npm install
	@cd $(FRONTEND_DIR) && npm install

up:
ifeq ($(TARGET),)
	@$(MAKE) --no-print-directory db
	@trap 'kill 0' INT TERM EXIT; \
	(cd $(BACKEND_DIR) && npm run start:dev) & \
	(cd $(FRONTEND_DIR) && npm run dev) & \
	wait
else ifeq ($(TARGET),back)
	@$(MAKE) --no-print-directory db
	@cd $(BACKEND_DIR) && npm run start:dev
else ifeq ($(TARGET),front)
	@cd $(FRONTEND_DIR) && npm run dev
else
	@echo "Uso: make up [back|front]" && exit 1
endif

# Sobe o Postgres e espera ficar saudável
db:
	@docker compose up -d --wait postgres

# Para o Postgres (os dados ficam no volume)
db-down:
	@docker compose down

# Cria/aplica migrations no banco de desenvolvimento
migrate: db
	@cd $(BACKEND_DIR) && npx prisma migrate dev

# Alvos vazios para que `back` e `front` funcionem como argumentos de `up`
back front:
	@:

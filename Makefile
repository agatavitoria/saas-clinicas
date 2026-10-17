BACKEND_DIR  := saas-clinicas-backend
FRONTEND_DIR := saas-clinicas-frontend

# Permite `make up`, `make up back` e `make up front`
TARGET := $(filter-out up,$(MAKECMDGOALS))

.PHONY: up back front

up:
ifeq ($(TARGET),)
	@trap 'kill 0' INT TERM EXIT; \
	(cd $(BACKEND_DIR) && npm run start:dev) & \
	(cd $(FRONTEND_DIR) && npm run dev) & \
	wait
else ifeq ($(TARGET),back)
	@cd $(BACKEND_DIR) && npm run start:dev
else ifeq ($(TARGET),front)
	@cd $(FRONTEND_DIR) && npm run dev
else
	@echo "Uso: make up [back|front]" && exit 1
endif

# Alvos vazios para que `back` e `front` funcionem como argumentos de `up`
back front:
	@:

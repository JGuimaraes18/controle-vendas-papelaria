COMPOSE_DEV = docker-compose-dev.yml
COMPOSE_PROD = docker-compose.yml

.PHONY: start-dev build-dev start-prod build-prod stop version-sync version-check clean help

start-dev:
	@echo "Iniciando ambiente de DESENVOLVIMENTO..."
	docker compose -f $(COMPOSE_DEV) up -d

build-dev:
	@echo "Construindo e iniciando ambiente de DESENVOLVIMENTO..."
	docker compose -f $(COMPOSE_DEV) up -d --build

start-prod:
	@echo "Iniciando ambiente de PRODUÇÃO..."
	docker compose -f $(COMPOSE_PROD) up -d

build-prod:
	@echo "Construindo e iniciando ambiente de PRODUÇÃO..."
	docker compose -f $(COMPOSE_PROD) up -d --build

stop:
	@echo "Parando containers ativos..."
	@if [ -f $(COMPOSE_DEV) ]; then docker compose -f $(COMPOSE_DEV) down; fi
	@if [ -f $(COMPOSE_PROD) ]; then docker compose -f $(COMPOSE_PROD) down; fi

version-sync:
	@echo "Sincronizando artefatos com a versão de VERSION..."
	python3 scripts/sync_version.py

version-check:
	@echo "Validando consistência da versão..."
	python3 scripts/check_version.py

help:
	@echo "Alvos disponíveis:"
	@echo "  make start-dev      Inicia o ambiente de desenvolvimento"
	@echo "  make build-dev      Reconstrói e inicia o ambiente de desenvolvimento"
	@echo "  make start-prod     Inicia o ambiente de produção"
	@echo "  make build-prod     Reconstrói e inicia o ambiente de produção"
	@echo "  make stop           Para os containers ativos"
	@echo "  make version-sync   Sincroniza artefatos com VERSION"
	@echo "  make version-check  Valida a consistência da versão"

.DEFAULT_GOAL := help

.PHONY: help install install-backend install-frontend train test test-backend test-frontend typecheck build dev dev-backend dev-frontend clean

PYTHON ?= python

help:
	@echo "AI-Driven EV Battery Intelligence Platform"
	@echo "Available commands:"
	@echo "  make install           Install Python and Node dependencies"
	@echo "  make install-backend   Install Python dependencies from requirements.txt"
	@echo "  make install-frontend  Install frontend npm dependencies"
	@echo "  make train             Train all ML models with pinned scikit-learn version"
	@echo "  make test              Run both backend (pytest) and frontend (vitest) tests"
	@echo "  make test-backend      Run backend unit & integration tests (pytest)"
	@echo "  make test-frontend     Run frontend tests (vitest)"
	@echo "  make typecheck         Run TypeScript type checking (tsc --noEmit)"
	@echo "  make build             Build frontend and production server bundles"
	@echo "  make dev-backend       Start FastAPI backend server (port 8000)"
	@echo "  make dev-frontend      Start Vite development server"
	@echo "  make dev               Start full-stack dev server with WebSocket (port 3000)"
	@echo "  make clean             Clean build artifacts and caches"

install: install-backend install-frontend

install-backend:
	$(PYTHON) -m pip install -r requirements.txt

install-frontend:
	npm install

train:
	$(PYTHON) backend/training/train_models.py

test: test-backend test-frontend

test-backend:
	pytest

test-frontend:
	npx vitest run

typecheck:
	npx tsc --noEmit

build:
	npm run build

dev-backend:
	uvicorn backend.app:app --reload --port 8000

dev-frontend:
	npx vite

dev:
	npx tsx server.ts

clean:
	npm run clean

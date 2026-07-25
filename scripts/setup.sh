#!/usr/bin/env bash

set -e

echo "🚀 Setting up Smart Restaurant Management System local environment..."

# Root environment setup
if [ ! -f .env ]; then
  echo "📋 Copying root .env.example -> .env..."
  cp .env.example .env
fi

# Backend environment setup
if [ ! -f backend/.env ]; then
  echo "📋 Copying backend .env.example -> backend/.env..."
  cp backend/.env.example backend/.env
fi

# Frontend environment setup
if [ ! -f frontend/.env.local ]; then
  echo "📋 Copying frontend .env.example -> frontend/.env.local..."
  cp frontend/.env.example frontend/.env.local
fi

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend && npm install --legacy-peer-deps && cd ..

# Setup Python Virtualenv for Backend
echo "🐍 Setting up Python virtual environment for backend..."
cd backend
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..

echo "✅ Environment setup complete!"
echo "To start services with Docker Compose, run:"
echo "   docker-compose up --build"

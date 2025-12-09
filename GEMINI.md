# GEMINI.md

This document provides a comprehensive overview of the Payment Management application, its architecture, and development conventions to be used as a guide for future development and interaction with the Gemini CLI agent.

## Project Overview

This is a full-stack monorepo project for a Payment Management application. It allows users to manage vendors, items, purchase orders, and invoices with a multi-step approval workflow.

- **Frontend:** The client is a single-page application built with **React**, **Vite**, and **TypeScript**. It uses **Tailwind CSS** and **shadcn/ui** for styling and components.
- **Backend:** The server is a Node.js application built with **Express** and **TypeScript**. It uses **Prisma** as the ORM to interact with a **PostgreSQL** database. It exposes both a standard REST API and a `Context7 Model Context Protocol (MCP)` server.
- **Database:** The database schema is managed with Prisma and includes tables for users, vendors, items, purchase orders, invoices, and more.

## Development Conventions

To ensure code quality, consistency, and maintainability, all future development should adhere to the following principles:

- **Clean Architecture:** The backend is structured in layers (`routes`, `middleware`, `controllers`, `services`, `prisma`). Maintain this separation of concerns. Business logic should reside in the `services` layer, completely independent of the Express framework.
- **Test-Driven Development (TDD):** All new features or bug fixes must be accompanied by tests. The goal is to write tests first to define the expected behavior before writing the implementation.
- **TODO:** No testing framework is currently set up. A testing framework like **Jest** or **Vitest** needs to be configured for the backend and frontend to enable TDD.
- **SOLID Principles:** Follow the SOLID principles for writing maintainable and scalable object-oriented code.
- **YAGNI (You Ain't Gonna Need It):** Avoid over-engineering. Do not add functionality until it is deemed necessary.

## Building and Running

### Backend (`/server`)

- **Install Dependencies:**
  ```bash
  pnpm install
  ```
- **Run Development Server:** (with hot-reloading)
  ```bash
  pnpm dev
  ```
- **Build for Production:**
  ```bash
  pnpm build
  ```
- **Run Production Server:**
  ```bash
  pnpm start
  ```
- **Database Migrations:**
  ```bash
  # Apply migrations
  npx prisma db push

  # Seed the database
  npx prisma db seed
  ```

### Frontend (`/client`)

- **Install Dependencies:**
  ```bash
  pnpm install
  ```
- **Run Development Server:**
  ```bash
  pnpm dev
  ```
- **Build for Production:**
  ```bash
  pnpm build
  ```
- **Lint Files:**
  ```bash
  pnpm lint
  ```

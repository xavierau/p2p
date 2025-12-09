# Client Development Guidelines (GEMINI.md)

This document provides a comprehensive overview of the client-side application, its architecture, and the development conventions to follow for future implementation.

## 1. Project Overview

The client is a modern frontend application built with **React (using Vite)** and **TypeScript**.

The UI is built on the following technologies:
- **Tailwind CSS:** A utility-first CSS framework for styling. The configuration is in `tailwind.config.js` and `src/index.css`. (Note: The project currently uses Tailwind v3.3.3, but development should align with modern v4 principles where applicable).
- **shadcn/ui:** The component library used for building the user interface. Components are located in `src/components/ui` and configured via `components.json`.

## 2. Core Principles

Adherence to these principles is crucial for maintaining a clean, scalable, and maintainable codebase.

### Modular Design
The application is structured around components.
- **Pages:** Top-level components for each route are located in `src/pages`.
- **Reusable Components:** Feature-specific, composite components (e.g., `Layout.tsx`, `Navbar.tsx`) are located in `src/components`.
- **UI Primitives:** Base UI components from `shadcn/ui` are in `src/components/ui`.

When creating new UI elements, always consider if they can be broken down into smaller, reusable components.

### Separation of Concerns
This is a primary focus for development.
- **API Logic:** All interactions with the backend API should be completely separated from the UI components. **Create a dedicated directory at `src/api` or `src/services` to encapsulate all `axios` calls.** Components should not call `axios` directly; they should call a function from a service file (e.g., `import { getInvoices } from '@/services/invoiceService';`).
- **Business Logic & State:** Complex business logic and shared application state should be managed within React Contexts (see `src/context/AuthContext.tsx` for an example) or a dedicated state management library if the need arises.
- **Utility Functions:** Generic, reusable helper functions (like the `cn` function) are located in `src/lib`.

### Reusability
Build components with reusability in mind. Avoid hardcoding values that could be passed as props. Use generic props like `children` and leverage component composition to create flexible and reusable UI elements.

## 3. UI, Styling, and Design

To ensure a consistent and high-quality user experience, all UI development must follow these rules:

- **Primary Design Reference:** The **`@client/docs/system_design.md`** file is the authoritative source for all UI and UX design decisions. Before implementing new UI, consult this document to ensure your changes align with the established design system.
- **Styling:** All styling must be implemented using **Tailwind CSS**. Avoid writing custom CSS files or using inline styles unless absolutely necessary for a unique, unachievable-with-Tailwind effect. The existing theme and color palette are defined in `tailwind.config.js` and `src/index.css`.
- **Component Library:** **`shadcn/ui`** is the designated component library. Use its components whenever possible to build new UI elements, ensuring visual and behavioral consistency across the application.

# Development Instructions

This project is a monorepo containing multiple packages. To run a development server for a specific package, use:

```bash
npm run dev <package-name>
```

Available packages with development servers:

- `inference` - The inference API package
- `e2e/svelte` - The Svelte e2e testing environment

## Examples

To start the inference package dev server:

```bash
npm run dev inference
```

To start the Svelte e2e dev server:

```bash
npm run dev e2e/svelte
```

## Troubleshooting

If you're encountering issues with the dev server:

1. Make sure you've installed all dependencies using `pnpm install`
2. Check that you're running the command from the root directory of the project
3. If a specific package's dev server is failing, you can navigate to that package directory and run its dev script directly:

```bash
cd packages/inference
pnpm run dev
```

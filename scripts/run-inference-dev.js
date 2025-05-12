#!/usr/bin/env node

/**
 * This script fixes the development server issue in the inference package
 * by running the export-templates and tsup commands directly, bypassing
 * the need for pnpm.
 */

const { spawnSync, spawn } = require("child_process");
const { existsSync } = require("fs");
const { resolve, join } = require("path");

// Path to the inference package
const inferencePath = resolve(__dirname, "../packages/inference");

// Check if the inference package exists
if (!existsSync(inferencePath)) {
	console.error("Error: Inference package not found at", inferencePath);
	process.exit(1);
}

// Change to the inference directory
console.log("Changing to directory:", inferencePath);
process.chdir(inferencePath);

// Run export-templates script directly using npm
console.log("Running export-templates...");
const exportResult = spawnSync("npm", ["run", "export-templates"], {
	stdio: "inherit",
	shell: true,
});

if (exportResult.error || exportResult.status !== 0) {
	console.error("Error running export-templates:", exportResult.error || `Exit code: ${exportResult.status}`);

	// Try to run the export-templates script directly if available
	console.log("Trying to run export-templates directly...");

	// Check if tsx is available in node_modules
	const nodeModulesBin = resolve(inferencePath, "node_modules", ".bin");
	const hasTsx = existsSync(join(nodeModulesBin, "tsx")) || existsSync(join(nodeModulesBin, "tsx.cmd"));

	if (hasTsx) {
		// Try to run export-templates script directly
		const scriptsPath = resolve(inferencePath, "scripts");

		if (existsSync(join(scriptsPath, "export-templates.ts"))) {
			console.log("Found export-templates.ts script, running directly...");
			const directExportResult = spawnSync("tsx", ["scripts/export-templates.ts"], {
				stdio: "inherit",
				shell: true,
			});

			if (directExportResult.error || directExportResult.status !== 0) {
				console.error("Failed to run export-templates directly. Continuing anyway...");
			}
		} else {
			console.error("Could not find export-templates.ts script. Continuing anyway...");
		}
	} else {
		console.error("tsx not found in node_modules. Continuing anyway...");
	}
}

// Run tsup directly using npx
console.log("Starting tsup watch mode...");
const tsupProcess = spawn("npx", ["tsup", "src/index.ts", "--format", "cjs,esm", "--watch"], {
	stdio: "inherit",
	shell: true,
});

tsupProcess.on("error", (error) => {
	console.error("Error starting tsup:", error);
	process.exit(1);
});

// Handle SIGINT (Ctrl+C) to properly terminate the child process
process.on("SIGINT", () => {
	console.log("Stopping tsup process...");
	tsupProcess.kill("SIGINT");
	process.exit(0);
});

// Handle process exit
tsupProcess.on("exit", (code) => {
	console.log(`tsup process exited with code ${code}`);
	process.exit(code || 0);
});

console.log("Dev server for inference is running...");

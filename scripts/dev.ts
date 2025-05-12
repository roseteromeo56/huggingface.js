import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Get the package name from command line arguments
const args = process.argv.slice(2);
const packageName = args[0];

if (!packageName) {
	console.log("Please specify a package name to start the dev server for:");
	console.log("npm run dev <package-name>");
	console.log("\nAvailable packages with dev scripts:");

	// Check packages directory
	const packagesDir = resolve(__dirname, "../packages");
	const packages = [
		"agents",
		"blob",
		"dduf",
		"doc-internal",
		"gguf",
		"hub",
		"inference",
		"jinja",
		"languages",
		"ollama-utils",
		"space-header",
		"tasks",
		"tasks-gen",
	];

	for (const pkg of packages) {
		const packageJsonPath = resolve(packagesDir, pkg, "package.json");
		if (existsSync(packageJsonPath)) {
			try {
				const packageJson = require(packageJsonPath);
				if (packageJson.scripts && packageJson.scripts.dev) {
					console.log(`- ${pkg}`);
				}
			} catch (e) {
				// Ignore errors reading package.json
			}
		}
	}

	// Also check e2e directory
	const e2eDir = resolve(__dirname, "../e2e");
	const e2eFolders = ["svelte", "ts", "deno", "yarn"];

	for (const folder of e2eFolders) {
		const packageJsonPath = resolve(e2eDir, folder, "package.json");
		if (existsSync(packageJsonPath)) {
			try {
				const packageJson = require(packageJsonPath);
				if (packageJson.scripts && packageJson.scripts.dev) {
					console.log(`- e2e/${folder}`);
				}
			} catch (e) {
				// Ignore errors reading package.json
			}
		}
	}

	process.exit(1);
}

// Check if it's an e2e package
let packagePath;
if (packageName.startsWith("e2e/")) {
	const e2ePackageName = packageName.substring(4);
	packagePath = resolve(__dirname, "../e2e", e2ePackageName);
} else {
	packagePath = resolve(__dirname, "../packages", packageName);
}

const packageJsonPath = resolve(packagePath, "package.json");

if (!existsSync(packageJsonPath)) {
	console.error(`Error: Package ${packageName} not found.`);
	process.exit(1);
}

// Check if the package has a dev script
try {
	const packageJson = require(packageJsonPath);
	if (!packageJson.scripts || !packageJson.scripts.dev) {
		console.error(`Error: Package ${packageName} does not have a dev script.`);
		process.exit(1);
	}
} catch (e) {
	console.error(`Error reading package.json for ${packageName}:`, e.message);
	process.exit(1);
}

// Change to the package directory and run the dev script
console.log(`Starting dev server for ${packageName}...`);
process.chdir(packagePath);

// Use the project's package manager to run the dev script
const packageManager = "pnpm"; // This is defined in the root package.json as packageManager
const result = spawnSync(packageManager, ["run", "dev"], { stdio: "inherit" });

if (result.error) {
	console.error(`Error starting dev server:`, result.error);
	process.exit(1);
}

process.exit(result.status);

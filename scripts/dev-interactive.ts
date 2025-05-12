import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

// Function to detect available packages with dev scripts
function detectPackagesWithDevScripts() {
	const availablePackages = [];

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
					availablePackages.push(pkg);
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
					availablePackages.push(`e2e/${folder}`);
				}
			} catch (e) {
				// Ignore errors reading package.json
			}
		}
	}

	return availablePackages;
}

// Function to start dev server for a package
function startDevServer(packageName: string) {
	console.log(`Starting dev server for ${packageName}...`);

	// Check if it's an e2e package
	let packagePath;
	if (packageName.startsWith("e2e/")) {
		const e2ePackageName = packageName.substring(4);
		packagePath = resolve(__dirname, "../e2e", e2ePackageName);
	} else {
		packagePath = resolve(__dirname, "../packages", packageName);
	}

	// Change to the package directory and run the dev script
	process.chdir(packagePath);

	// Use the project's package manager to run the dev script
	const packageManager = "pnpm"; // This is defined in the root package.json as packageManager
	const result = spawnSync(packageManager, ["run", "dev"], { stdio: "inherit" });

	if (result.error) {
		console.error(`Error starting dev server:`, result.error);
		process.exit(1);
	}

	process.exit(result.status || 0);
}

// Main function
async function main() {
	// Check if a package was specified as a command line argument
	const args = process.argv.slice(2);
	if (args.length > 0) {
		startDevServer(args[0]);
		return;
	}

	// If no package specified, offer interactive selection
	const availablePackages = detectPackagesWithDevScripts();

	if (availablePackages.length === 0) {
		console.error("No packages with dev scripts found!");
		process.exit(1);
	}

	console.log("Available dev servers:");
	availablePackages.forEach((pkg, index) => {
		console.log(`${index + 1}. ${pkg}`);
	});

	// If there's only one package, start it automatically
	if (availablePackages.length === 1) {
		console.log(`\nOnly one package available. Starting ${availablePackages[0]} automatically...`);
		startDevServer(availablePackages[0]);
		return;
	}

	// Otherwise, prompt for selection
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	rl.question(`\nEnter the number of the dev server to start (1-${availablePackages.length}): `, (answer) => {
		rl.close();

		const selection = parseInt(answer.trim(), 10);
		if (isNaN(selection) || selection < 1 || selection > availablePackages.length) {
			console.error("Invalid selection!");
			process.exit(1);
		}

		const selectedPackage = availablePackages[selection - 1];
		startDevServer(selectedPackage);
	});
}

// Run the main function
main().catch((error) => {
	console.error("An error occurred:", error);
	process.exit(1);
});

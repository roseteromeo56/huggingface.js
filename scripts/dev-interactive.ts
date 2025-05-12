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

// Function to detect available package manager
function detectPackageManager() {
	// Try to detect which package managers are available
	const checkCommand = process.platform === "win32" ? "where" : "which";

	// Try pnpm first (since it's in packageManager field)
	try {
		const pnpmResult = spawnSync(checkCommand, ["pnpm"], { stdio: "ignore" });
		if (pnpmResult.status === 0) {
			return "pnpm";
		}
	} catch (e) {
		// Ignore error
	}

	// Try npm next
	try {
		const npmResult = spawnSync(checkCommand, ["npm"], { stdio: "ignore" });
		if (npmResult.status === 0) {
			return "npm";
		}
	} catch (e) {
		// Ignore error
	}

	// Fall back to npm as a last resort
	return "npm";
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
	console.log(`Changing to directory: ${packagePath}`);
	process.chdir(packagePath);

	// Detect and use an available package manager
	const packageManager = detectPackageManager();
	console.log(`Using package manager: ${packageManager}`);
	console.log(`Running command: ${packageManager} run dev`);

	const result = spawnSync(packageManager, ["run", "dev"], {
		stdio: "inherit",
		shell: true, // Adding shell option for better compatibility
	});

	if (result.error) {
		console.error(`Error starting dev server:`, result.error);
		process.exit(1);
	}

	console.log(`Dev server for ${packageName} has exited with code ${result.status}`);
	process.exit(result.status || 0);
}

// Main function
async function main() {
	// Default package - will be used if no input is provided within timeout
	const DEFAULT_PACKAGE = "inference";
	const SELECTION_TIMEOUT = 10000; // 10 seconds timeout

	// Check if a package was specified as a command line argument
	const args = process.argv.slice(2);
	const forceInteractive = args.includes("--interactive") || args.includes("-i");

	// Remove interactive flags if present
	const packageArgs = args.filter((arg) => arg !== "--interactive" && arg !== "-i");

	if (packageArgs.length > 0 && !forceInteractive) {
		startDevServer(packageArgs[0]);
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
		console.log(`${index + 1}. ${pkg}${pkg === DEFAULT_PACKAGE ? " (default)" : ""}`);
	});

	// If there's only one package, start it automatically
	if (availablePackages.length === 1) {
		console.log(`\nOnly one package available. Starting ${availablePackages[0]} automatically...`);
		startDevServer(availablePackages[0]);
		return;
	}

	let timeoutId: NodeJS.Timeout;
	const defaultPackageIndex = availablePackages.indexOf(DEFAULT_PACKAGE);
	const hasDefaultPackage = defaultPackageIndex !== -1;

	if (hasDefaultPackage) {
		console.log(
			`\nEnter the number of the dev server to start (1-${availablePackages.length}) or wait ${SELECTION_TIMEOUT / 1000} seconds for default (${DEFAULT_PACKAGE}):`
		);
	} else {
		console.log(`\nEnter the number of the dev server to start (1-${availablePackages.length}):`);
	}

	// Otherwise, prompt for selection with timeout
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	// Setup timeout for default selection
	if (hasDefaultPackage) {
		timeoutId = setTimeout(() => {
			console.log(`\nSelection timeout reached. Starting default package: ${DEFAULT_PACKAGE}`);
			rl.close();
			startDevServer(DEFAULT_PACKAGE);
		}, SELECTION_TIMEOUT);
	}

	rl.question("", (answer) => {
		// Clear the timeout if user provided input
		if (hasDefaultPackage) {
			clearTimeout(timeoutId);
		}

		rl.close();

		if (!answer.trim() && hasDefaultPackage) {
			// If user just pressed enter with no selection, use default
			console.log(`Starting default package: ${DEFAULT_PACKAGE}`);
			startDevServer(DEFAULT_PACKAGE);
			return;
		}

		const selection = parseInt(answer.trim(), 10);
		if (isNaN(selection) || selection < 1 || selection > availablePackages.length) {
			console.error("Invalid selection!");
			if (hasDefaultPackage) {
				console.log(`Falling back to default package: ${DEFAULT_PACKAGE}`);
				startDevServer(DEFAULT_PACKAGE);
				return;
			}
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

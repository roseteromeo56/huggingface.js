import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const args = parseArgs({
	allowPositionals: true,
});

const dep = args.positionals[0];

if (!dep) {
	console.error("Error: No dependency specified.");
	process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(dep)) {
	console.error("Error: Invalid dependency name.");
	process.exit(1);
}

const packagePath = join("packages", dep);
if (!existsSync(join(packagePath, "package.json"))) {
	console.error(`Error: Could not find dependency package at ${packagePath}.`);
	process.exit(1);
}

process.chdir(packagePath);

const localPackageJson = readFileSync(`./package.json`, "utf-8");
const localVersion = JSON.parse(localPackageJson).version as string;
const remoteVersion = execFileSync("npm", ["view", `@huggingface/${dep}`, "version"], {
	encoding: "utf-8",
}).trim();

if (localVersion !== remoteVersion) {
	console.error(
		`Error: The local @huggingface/${dep} package version (${localVersion}) differs from the remote version (${remoteVersion}). Release halted.`
	);
	process.exit(1);
}

const localTarball = execFileSync("npm", ["pack"], {
	encoding: "utf-8",
}).trim();
renameSync(localTarball, `${dep}-local.tgz`);

const remoteTarball = execFileSync("npm", ["pack", `@huggingface/${dep}@${remoteVersion}`], {
	encoding: "utf-8",
}).trim();
renameSync(remoteTarball, `${dep}-remote.tgz`);

rmSync("local", { recursive: true, force: true });
mkdirSync("local");
execFileSync("tar", ["-xf", `${dep}-local.tgz`, "-C", "local"]);

rmSync("remote", { recursive: true, force: true });
mkdirSync("remote");
execFileSync("tar", ["-xf", `${dep}-remote.tgz`, "-C", "remote"]);

// Remove package.json files because they're modified by npm
rmSync("local/package/package.json");
rmSync("remote/package/package.json");

try {
	execFileSync("diff", ["--brief", "-r", "local", "remote"], {
		encoding: "utf-8",
		stdio: "pipe",
	});
} catch (e) {
	const output =
		typeof e === "object" &&
		e !== null &&
		"output" in e &&
		Array.isArray((e as { output?: unknown }).output)
			? (e as { output: unknown[] }).output.filter(Boolean).map(String).join("\n")
			: "";
	if (output) {
		console.error(output);
	}
	console.error(`Error: The local and remote @huggingface/${dep} packages are inconsistent. Release halted.`);
	process.exit(1);
}

console.log(`The local and remote @huggingface/${dep} packages are consistent.`);

rmSync("local", { recursive: true, force: true });
rmSync("remote", { recursive: true, force: true });

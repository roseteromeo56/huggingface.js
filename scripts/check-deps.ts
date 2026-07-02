import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
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

const run = (command: string, args: string[]): string => execFileSync(command, args, { encoding: "utf-8" }).trim();

process.chdir(`./packages/${dep}`);

const localPackageJson = readFileSync(`./package.json`, "utf-8");
const localVersion = JSON.parse(localPackageJson).version as string;
const remoteVersion = run("npm", ["view", `@huggingface/${dep}`, "version"]);

if (localVersion !== remoteVersion) {
	console.error(
		`Error: The local @huggingface/${dep} package version (${localVersion}) differs from the remote version (${remoteVersion}). Release halted.`
	);
	process.exit(1);
}

run("npm", ["pack"]);
renameSync(`huggingface-${dep}-${localVersion}.tgz`, `${dep}-local.tgz`);

run("npm", ["pack", `@huggingface/${dep}@${remoteVersion}`]);
renameSync(`huggingface-${dep}-${remoteVersion}.tgz`, `${dep}-remote.tgz`);

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
	execFileSync("diff", ["--brief", "-r", "local", "remote"], { encoding: "utf-8" });
} catch (e) {
	const error = e as Error & { stdout?: Buffer | string; stderr?: Buffer | string };
	const stdout = typeof error.stdout === "string" ? error.stdout : error.stdout?.toString();
	const stderr = typeof error.stderr === "string" ? error.stderr : error.stderr?.toString();
	console.error([stdout, stderr].filter(Boolean).join("\n"));
	console.error(`Error: The local and remote @huggingface/${dep} packages are inconsistent. Release halted.`);
	process.exit(1);
}

console.log(`The local and remote @huggingface/${dep} packages are consistent.`);

rmSync("local", { recursive: true, force: true });
rmSync("remote", { recursive: true, force: true });

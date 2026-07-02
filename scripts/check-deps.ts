import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
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
	console.error(`Error: Invalid dependency "${dep}".`);
	process.exit(1);
}

try {
	process.chdir(join(".", "packages", dep));
} catch {
	console.error(`Error: Unknown dependency "${dep}".`);
	process.exit(1);
}

const localPackageJson = readFileSync(`./package.json`, "utf-8");
const localVersion = JSON.parse(localPackageJson).version as string;
const remoteVersion = execFileSync("npm", ["view", `@huggingface/${dep}`, "version"], { encoding: "utf-8" }).trim();

if (localVersion !== remoteVersion) {
	console.error(
		`Error: The local @huggingface/${dep} package version (${localVersion}) differs from the remote version (${remoteVersion}). Release halted.`
	);
	process.exit(1);
}

execFileSync("npm", ["pack"], { stdio: "inherit" });
renameSync(`huggingface-${dep}-${localVersion}.tgz`, `${dep}-local.tgz`);

execFileSync("npm", ["pack", `@huggingface/${dep}@${remoteVersion}`], { stdio: "inherit" });
renameSync(`huggingface-${dep}-${remoteVersion}.tgz`, `${dep}-remote.tgz`);

rmSync("local", { recursive: true, force: true });
rmSync("remote", { recursive: true, force: true });
mkdirSync("local");
mkdirSync("remote");
execFileSync("tar", ["-xf", `${dep}-local.tgz`, "-C", "local"], { stdio: "inherit" });
execFileSync("tar", ["-xf", `${dep}-remote.tgz`, "-C", "remote"], { stdio: "inherit" });

// Remove package.json files because they're modified by npm
rmSync(join("local", "package", "package.json"), { force: true });
rmSync(join("remote", "package", "package.json"), { force: true });

try {
	execFileSync("diff", ["--brief", "-r", "local", "remote"], { encoding: "utf-8" });
} catch (error) {
	if (typeof error === "object" && error !== null && ("stdout" in error || "stderr" in error)) {
		const stdout = "stdout" in error ? String((error as { stdout?: unknown }).stdout ?? "").trim() : "";
		const stderr = "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "").trim() : "";
		const output = [stdout, stderr].filter(Boolean).join("\n");
		if (output) {
			console.error(output);
		}
	}

	console.error(`Error: The local and remote @huggingface/${dep} packages are inconsistent. Release halted.`);
	process.exit(1);
}

console.log(`The local and remote @huggingface/${dep} packages are consistent.`);

rmSync("local", { recursive: true, force: true });
rmSync("remote", { recursive: true, force: true });

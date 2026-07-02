import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
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

const packagePath = resolve("./packages", dep);

if (!existsSync(packagePath)) {
	console.error(`Error: Package ${dep} not found in ./packages.`);
	process.exit(1);
}

process.chdir(packagePath);

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

rmSync("local", { force: true, recursive: true });
mkdirSync("local");
execFileSync("tar", ["-xf", `${dep}-local.tgz`, "-C", "local"]);

rmSync("remote", { force: true, recursive: true });
mkdirSync("remote");
execFileSync("tar", ["-xf", `${dep}-remote.tgz`, "-C", "remote"]);

// Remove package.json files because they're modified by npm
rmSync("local/package/package.json", { force: true });
rmSync("remote/package/package.json", { force: true });

try {
	execFileSync("diff", ["--brief", "-r", "local", "remote"]).toString();
} catch (e) {
	const output = (e as { output?: Array<Buffer | string | null> }).output ?? [];
	console.error(
		output
			.filter((entry): entry is Buffer | string => Boolean(entry))
			.map((entry) => entry.toString())
			.join("\n")
	);
	console.error(`Error: The local and remote @huggingface/${dep} packages are inconsistent. Release halted.`);
	process.exit(1);
}

console.log(`The local and remote @huggingface/${dep} packages are consistent.`);

rmSync("local", { force: true, recursive: true });
rmSync("remote", { force: true, recursive: true });

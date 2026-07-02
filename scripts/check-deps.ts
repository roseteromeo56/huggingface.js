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
	console.error(`Error: Invalid dependency "${dep}".`);
	process.exit(1);
}

process.chdir(`./packages/${dep}`);

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

execFileSync("npm", ["pack"]);
renameSync(`huggingface-${dep}-${localVersion}.tgz`, `${dep}-local.tgz`);

execFileSync("npm", ["pack", `@huggingface/${dep}@${remoteVersion}`]);
renameSync(`huggingface-${dep}-${remoteVersion}.tgz`, `${dep}-remote.tgz`);

rmSync("local", { recursive: true, force: true });
rmSync("remote", { recursive: true, force: true });
mkdirSync("local");
mkdirSync("remote");
execFileSync("tar", ["-xf", `${dep}-local.tgz`, "-C", "local"]);
execFileSync("tar", ["-xf", `${dep}-remote.tgz`, "-C", "remote"]);

// Remove package.json files because they're modified by npm
rmSync("local/package/package.json");
rmSync("remote/package/package.json");

try {
	execFileSync("diff", ["--brief", "-r", "local", "remote"]);
} catch (e) {
	const output = (e as { output?: Array<string | Buffer | null | undefined> }).output ?? [];
	console.error(output.filter(Boolean).map((entry) => entry?.toString()).join("\n"));
	console.error(`Error: The local and remote @huggingface/${dep} packages are inconsistent. Release halted.`);
	process.exit(1);
}

console.log(`The local and remote @huggingface/${dep} packages are consistent.`);

rmSync("local", { recursive: true, force: true });
rmSync("remote", { recursive: true, force: true });

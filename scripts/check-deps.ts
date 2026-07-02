import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
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

const packageDirs = new Set(
	readdirSync("./packages", { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
);

if (!packageDirs.has(dep)) {
	console.error(`Error: Invalid dependency "${dep}".`);
	process.exit(1);
}

process.chdir(join("./packages", dep));

const localPackageJson = readFileSync(`./package.json`, "utf-8");
const localVersion = JSON.parse(localPackageJson).version as string;
const remoteVersion = execFileSync("npm", ["view", `@huggingface/${dep}`, "version"]).toString().trim();

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
mkdirSync("local");
execFileSync("tar", ["-xf", `${dep}-local.tgz`, "-C", "local"]);

rmSync("remote", { recursive: true, force: true });
mkdirSync("remote");
execFileSync("tar", ["-xf", `${dep}-remote.tgz`, "-C", "remote"]);

// Remove package.json files because they're modified by npm
rmSync("local/package/package.json");
rmSync("remote/package/package.json");

try {
	execFileSync("diff", ["--brief", "-r", "local", "remote"], { stdio: "pipe" });
} catch (e: unknown) {
	if (e && typeof e === "object" && "stdout" in e && "stderr" in e) {
		const stdout = e.stdout ? String(e.stdout) : "";
		const stderr = e.stderr ? String(e.stderr) : "";
		console.error([stdout, stderr].filter(Boolean).join("\n"));
	}
	console.error(`Error: The local and remote @huggingface/${dep} packages are inconsistent. Release halted.`);
	process.exit(1);
}

console.log(`The local and remote @huggingface/${dep} packages are consistent.`);

rmSync("local", { recursive: true, force: true });
rmSync("remote", { recursive: true, force: true });

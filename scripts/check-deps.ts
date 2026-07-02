import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync } from "node:fs"; dd/fix/check-deps-command-injection-lir7nS
import { join } from "node:path"; main
import { parseArgs } from "node:util";

const args = parseArgs({
	allowPositionals: true,
});

const dep = args.positionals[0];

if (!dep) {
	console.error("Error: No dependency specified.");
	process.exit(1);
} dd/fix/check-deps-command-injection-lir7nS
if (!/^[a-z0-9-]+$/i.test(dep)) {
if (!/^[a-z0-9-]+$/.test(dep)) { main
	console.error("Error: Invalid dependency name.");
	process.exit(1);
} dd/fix/check-deps-command-injection-lir7nS
const runCommand = (command: string, args: string[]): string =>
	execFileSync(command, args, { encoding: "utf-8" }).trim();

process.chdir(`./packages/${dep}`);

const localPackageJson = readFileSync(`./package.json`, "utf-8");
const localVersion = JSON.parse(localPackageJson).version as string;
const remoteVersion = runCommand("npm", ["view", `@huggingface/${dep}`, "version"]);
process.chdir(join("packages", dep));

const localPackageJson = readFileSync(`./package.json`, "utf-8");
const localVersion = JSON.parse(localPackageJson).version as string;
const remoteVersion = execFileSync("npm", ["view", `@huggingface/${dep}`, "version"], { encoding: "utf-8" }).trim(); main

if (localVersion !== remoteVersion) {
	console.error(
		`Error: The local @huggingface/${dep} package version (${localVersion}) differs from the remote version (${remoteVersion}). Release halted.`
	);
	process.exit(1);
} dd/fix/check-deps-command-injection-lir7nS
runCommand("npm", ["pack"]);
renameSync(`huggingface-${dep}-${localVersion}.tgz`, `${dep}-local.tgz`);

runCommand("npm", ["pack", `@huggingface/${dep}@${remoteVersion}`]);
renameSync(`huggingface-${dep}-${remoteVersion}.tgz`, `${dep}-remote.tgz`);

rmSync("local", { recursive: true, force: true });
mkdirSync("local");
runCommand("tar", ["-xf", `${dep}-local.tgz`, "-C", "local"]);

rmSync("remote", { recursive: true, force: true });
mkdirSync("remote");
runCommand("tar", ["-xf", `${dep}-remote.tgz`, "-C", "remote"]);
const localTarball = execFileSync("npm", ["pack"], { encoding: "utf-8" }).trim();
renameSync(localTarball, `${dep}-local.tgz`);

const remoteTarball = execFileSync("npm", ["pack", `@huggingface/${dep}@${remoteVersion}`], { encoding: "utf-8" }).trim();
renameSync(remoteTarball, `${dep}-remote.tgz`);

rmSync("local", { recursive: true, force: true });
mkdirSync("local", { recursive: true });
execFileSync("tar", ["-xf", `${dep}-local.tgz`, "-C", "local"]);

rmSync("remote", { recursive: true, force: true });
mkdirSync("remote", { recursive: true });
execFileSync("tar", ["-xf", `${dep}-remote.tgz`, "-C", "remote"]); main

// Remove package.json files because they're modified by npm
rmSync("local/package/package.json");
rmSync("remote/package/package.json");

try {
	runCommand("diff", ["--brief", "-r", "local", "remote"]);
} catch (error) {
	const diffError = error as { stdout?: string | Buffer; stderr?: string | Buffer };
	const diffOutput = [diffError.stdout, diffError.stderr]
		.filter((chunk): chunk is string | Buffer => Boolean(chunk))
		.map((chunk) => chunk.toString())
		.join("\n");

	if (diffOutput) {
		console.error(diffOutput);
	}

	execFileSync("diff", ["--brief", "-r", "local", "remote"]);
} catch (e) {
	const output = (e as { output?: Array<string | Buffer | null> }).output;
	if (output) {
		console.error(
			output
				.filter((entry): entry is string | Buffer => Boolean(entry))
				.map((entry) => entry.toString())
				.join("\n")
		);
	}
	console.error(`Error: The local and remote @huggingface/${dep} packages are inconsistent. Release halted.`);
	process.exit(1);
}

console.log(`The local and remote @huggingface/${dep} packages are consistent.`);

rmSync("local", { recursive: true, force: true });
rmSync("remote", { recursive: true, force: true });

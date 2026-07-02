import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { parseArgs } from "node:util";

const args = parseArgs({
	allowPositionals: true,
});

const dep = args.positionals[0];

if (!dep) {
	console.error("Error: No dependency specified.");
	process.exit(1);
}

if (!/^[a-z0-9-]+$/i.test(dep)) {
	console.error(`Error: Invalid dependency name "${dep}".`);
	process.exit(1);
}

const packageDir = `./packages/${dep}`;

if (!existsSync(packageDir)) {
	console.error(`Error: Unknown dependency "${dep}".`);
	process.exit(1);
}

process.chdir(packageDir);

const localPackageJson = readFileSync(`./package.json`, "utf-8");
const localVersion = JSON.parse(localPackageJson).version as string;
const remoteVersion = execFileSync("npm", ["view", `@huggingface/${dep}`, "version"], { encoding: "utf-8" }).trim();

if (localVersion !== remoteVersion) {
	console.error(
		`Error: The local @huggingface/${dep} package version (${localVersion}) differs from the remote version (${remoteVersion}). Release halted.`
	);
	process.exit(1);
}

const localTarball = execFileSync("npm", ["pack"], { encoding: "utf-8" }).trim();
renameSync(localTarball, `${dep}-local.tgz`);

const remoteTarball = execFileSync("npm", ["pack", `@huggingface/${dep}@${remoteVersion}`], { encoding: "utf-8" }).trim();
renameSync(remoteTarball, `${dep}-remote.tgz`);

const unpackTarball = (tarball: string, destination: string) => {
	rmSync(destination, { force: true, recursive: true });
	mkdirSync(destination, { recursive: true });
	execFileSync("tar", ["-xf", tarball, "-C", destination]);
};

unpackTarball(`${dep}-local.tgz`, "local");
unpackTarball(`${dep}-remote.tgz`, "remote");

// Remove package.json files because they're modified by npm
rmSync(`local/package/package.json`, { force: true });
rmSync(`remote/package/package.json`, { force: true });

try {
	execFileSync("diff", ["--brief", "-r", "local", "remote"]);
} catch (error) {
	const commandError = error as { stderr?: Buffer | string; stdout?: Buffer | string };
	const commandOutput = [commandError.stderr, commandError.stdout]
		.filter(Boolean)
		.map((entry) => (typeof entry === "string" ? entry : entry.toString()))
		.join("\n")
		.trim();

	if (commandOutput) {
		console.error(commandOutput);
	}

	console.error(`Error: The local and remote @huggingface/${dep} packages are inconsistent. Release halted.`);
	process.exit(1);
}

console.log(`The local and remote @huggingface/${dep} packages are consistent.`);

rmSync(`local`, { force: true, recursive: true });
rmSync(`remote`, { force: true, recursive: true });

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
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

const packageDirectories = new Set(
	readdirSync("./packages", { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
);

if (!packageDirectories.has(dep)) {
	console.error(`Error: Unknown dependency "${dep}".`);
	process.exit(1);
}

process.chdir(join("./packages", dep));

const localPackageJson = readFileSync(`./package.json`, "utf-8");
const localVersion = JSON.parse(localPackageJson).version as string;
const packageName = `@huggingface/${dep}`;
const remoteVersion = execFileSync("npm", ["view", packageName, "version"], { encoding: "utf-8" }).trim();

if (localVersion !== remoteVersion) {
	console.error(
		`Error: The local @huggingface/${dep} package version (${localVersion}) differs from the remote version (${remoteVersion}). Release halted.`
	);
	process.exit(1);
}

const pack = (pkg?: string): string => {
	const packArgs = ["pack", "--json"];

	if (pkg) {
		packArgs.push(pkg);
	}

	const output = execFileSync("npm", packArgs, { encoding: "utf-8" }).trim();
	const packedFiles = JSON.parse(output) as Array<{ filename?: string }>;
	const filename = packedFiles[0]?.filename;

	if (!filename) {
		throw new Error("npm pack did not return a filename.");
	}

	return filename;
};

renameSync(pack(), `${dep}-local.tgz`);
renameSync(pack(`${packageName}@${remoteVersion}`), `${dep}-remote.tgz`);

rmSync("local", { recursive: true, force: true });
mkdirSync("local", { recursive: true });
execFileSync("tar", ["-xf", `${dep}-local.tgz`, "-C", "local"]);

rmSync("remote", { recursive: true, force: true });
mkdirSync("remote", { recursive: true });
execFileSync("tar", ["-xf", `${dep}-remote.tgz`, "-C", "remote"]);

// Remove package.json files because they're modified by npm
rmSync("local/package/package.json", { force: true });
rmSync("remote/package/package.json", { force: true });

try {
	execFileSync("diff", ["--brief", "-r", "local", "remote"], { encoding: "utf-8" });
} catch (e) {
	if (e && typeof e === "object" && ("stdout" in e || "stderr" in e)) {
		const stdout = "stdout" in e && typeof e.stdout === "string" ? e.stdout : "";
		const stderr = "stderr" in e && typeof e.stderr === "string" ? e.stderr : "";
		const diffOutput = [stdout, stderr].filter(Boolean).join("\n");

		if (diffOutput) {
			console.error(diffOutput);
		}
	}

	console.error(`Error: The local and remote @huggingface/${dep} packages are inconsistent. Release halted.`);
	process.exit(1);
}

console.log(`The local and remote @huggingface/${dep} packages are consistent.`);

rmSync("local", { recursive: true, force: true });
rmSync("remote", { recursive: true, force: true });

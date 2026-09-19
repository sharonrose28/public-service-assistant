import {lstat, mkdir, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

// Keep this explicit: unrelated files, credentials and optional experiments must
// never be included just because they sit beside a runtime module.
export const PACKAGE_FILES = Object.freeze([
  'lambda.mjs',
  'server.mjs',
  'package.json',
  'lib/assistant.mjs',
  'lib/authority.mjs',
  'lib/civic.mjs',
  'lib/directory.mjs',
  'lib/http.mjs',
  'lib/locations.mjs',
  'lib/model.mjs',
  'lib/understanding.mjs',
  'lib/workflow.mjs',
  'public/app.js',
  'public/catalog.js',
  'public/content.js',
  'public/session-state.js',
  'public/index.html',
  'public/style.css',
  'data/accountability.json',
  'data/civic-contacts.json',
  'data/civic-extras.json',
  'data/india-locations.json',
  'data/LOCATION-DATA-LICENSE.txt',
  'data/ration-portals.json',
  'data/services-civic.json',
  'data/services-government.json',
  'data/service-pilot.json',
  'data/state-portals-a.json',
  'data/state-portals-b.json'
]);

function assertWithin(root, candidate) {
  const path = relative(root, candidate);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error(`Unsafe package path: ${candidate}`);
  }
}

async function assertRealDirectory(path) {
  let info;
  try { info = await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) {
    throw new Error(`Package directory must not be a link: ${path}`);
  }
  return true;
}

export async function packageAws({projectRoot = repositoryRoot} = {}) {
  const root = await realpath(projectRoot);
  const buildRoot = resolve(root, '.build');
  const outputPath = resolve(buildRoot, 'aws');
  assertWithin(root, buildRoot);
  assertWithin(buildRoot, outputPath);

  // Check the entire source set before replacing a previously valid package.
  const entries = [];
  for (const file of PACKAGE_FILES) {
    const source = resolve(root, file);
    assertWithin(root, source);
    const info = await lstat(source);
    if (!info.isFile() || info.isSymbolicLink() || await realpath(source) !== source) {
      throw new Error(`Package source must be a regular file, without links: ${file}`);
    }
    entries.push({file, content: await readFile(source)});
  }

  await assertRealDirectory(buildRoot);
  await mkdir(buildRoot, {recursive: true});
  await assertRealDirectory(buildRoot);
  const exists = await assertRealDirectory(outputPath);
  if (exists) {
    // Only this resolved, link-free staging directory belongs to the packager.
    // Clearing it also removes files left behind by an older allowlist.
    await rm(outputPath, {recursive: true, force: true});
  }
  await mkdir(outputPath);
  for (const {file, content} of entries) {
    const destination = resolve(outputPath, file);
    assertWithin(outputPath, destination);
    await mkdir(dirname(destination), {recursive: true});
    await writeFile(destination, content);
  }
  return {
    outputPath,
    files: entries.map(({file}) => file),
    bytes: entries.reduce((total, {content}) => total + content.length, 0)
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/package-aws.mjs');
  const result = await packageAws();
  console.log(`Prepared ${result.files.length} runtime files (${result.bytes} bytes) in ${result.outputPath}`);
  console.log('No AWS resources were created. The deployment/template.yaml CodeUri points to this directory.');
}

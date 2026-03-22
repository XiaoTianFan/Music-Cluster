/**
 * Regenerate or merge fields into public/default_features.json using Essentia.js (same library as the web worker).
 *
 * Requirements:
 *   - FFmpeg: install devDependency `ffmpeg-static`, or set FFMPEG_PATH to an ffmpeg executable, or put `ffmpeg` on PATH.
 *
 * Usage (from musiccluster/):
 *   npm run regenerate-default-features
 *   npm run regenerate-default-features -- --merge bpmSlow
 *   npm run regenerate-default-features -- --output public/default_features.json
 *   npm run regenerate-default-features -- --dry-run
 *
 * Modes:
 *   --merge onsetRate (default) — decode each cached song with FFmpeg to mono f32 @ 44100 Hz, run Essentia OnsetRate, merge into JSON.
 *   --merge bpmSlow — same decode path, run RhythmExtractor2013(..., 'multifeature', ...) → bpmSlow (matches worker BPM Slow).
 *   Full recomputation of all MIR features is not implemented here; use the app export flow or extend this script.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const esPkg = require('essentia.js');

const DEFAULT_REL_OUTPUT = path.join('public', 'default_features.json');

const SUPPORTED_MERGE_MODES = ['onsetRate', 'bpmSlow'];

function parseArgs(argv) {
  const out = { dryRun: false, output: null, merge: 'onsetRate' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--output' && argv[i + 1]) {
      out.output = argv[++i];
    } else if (a === '--merge' && argv[i + 1]) {
      out.merge = argv[++i];
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    return require('ffmpeg-static');
  } catch {
    return 'ffmpeg';
  }
}

/**
 * Decode audio file to mono float32 PCM at 44100 Hz (matches worker expectations for OnsetRate / full-signal rhythm).
 */
function decodeAudioToMonoF32At44100(ffmpegPath, filePath) {
  const r = spawnSync(
    ffmpegPath,
    [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      filePath,
      '-f',
      'f32le',
      '-acodec',
      'pcm_f32le',
      '-ac',
      '1',
      '-ar',
      '44100',
      'pipe:1',
    ],
    { maxBuffer: 512 * 1024 * 1024 }
  );
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const errText = (r.stderr && r.stderr.toString()) || `exit ${r.status}`;
    throw new Error(`ffmpeg: ${errText}`);
  }
  const buf = r.stdout;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function createEssentia() {
  try {
    if (esPkg.EssentiaWASM) {
      return new esPkg.Essentia(esPkg.EssentiaWASM);
    }
  } catch {
    /* try fallback */
  }
  return new esPkg.Essentia();
}

function computeOnsetRate(essentia, samples) {
  const asArray = samples instanceof Float32Array ? Array.from(samples) : samples;
  const vec = essentia.arrayToVector(asArray);
  try {
    const res = essentia.OnsetRate(vec);
    return res.onsetRate;
  } finally {
    if (vec && typeof vec.delete === 'function') vec.delete();
  }
}

/** RhythmExtractor2013 multifeature — same as essentia-worker rhythmSlow → bpmSlow */
function computeBpmSlow(essentia, samples) {
  const asArray = samples instanceof Float32Array ? Array.from(samples) : samples;
  const vec = essentia.arrayToVector(asArray);
  try {
    const res = essentia.RhythmExtractor2013(vec, 208, 'multifeature', 40);
    return res.bpm;
  } finally {
    if (vec && typeof vec.delete === 'function') vec.delete();
  }
}

function ensureAvailableKey(keys, key) {
  const k = keys && keys.length ? [...keys] : [];
  if (k.includes(key)) return k;
  const bpm = k.indexOf('bpm');
  if (bpm >= 0) k.splice(bpm + 1, 0, key);
  else k.push(key);
  return k;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`
regenerate-default-features.cjs

  --output <path>   Output JSON (default: ${DEFAULT_REL_OUTPUT})
  --dry-run         Compute values but do not write
  --merge <name>    Merge strategy: onsetRate | bpmSlow (default: onsetRate)
`);
    process.exit(0);
  }

  if (!SUPPORTED_MERGE_MODES.includes(args.merge)) {
    console.error(`Unsupported --merge mode: ${args.merge}. Use one of: ${SUPPORTED_MERGE_MODES.join(', ')}`);
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, '..');
  const outPath = path.resolve(projectRoot, args.output || DEFAULT_REL_OUTPUT);
  const publicRoot = path.join(projectRoot, 'public');

  if (!fs.existsSync(outPath)) {
    console.error(`Missing file: ${outPath}`);
    process.exit(1);
  }

  const ffmpegPath = resolveFfmpegPath();
  const probe = spawnSync(ffmpegPath, ['-version'], { encoding: 'utf8' });
  if (probe.status !== 0 && probe.error) {
    console.error(
      'FFmpeg not found. Install ffmpeg-static (npm i) or set FFMPEG_PATH, or add ffmpeg to PATH.'
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(outPath, 'utf8');
  const data = JSON.parse(raw);

  if (!data.songData || typeof data.songData !== 'object') {
    console.error('Invalid JSON: expected songData object');
    process.exit(1);
  }

  const essentia = createEssentia();
  console.log('Essentia version:', essentia.version);
  console.log('Merge mode:', args.merge);

  const dataKey = args.merge === 'onsetRate' ? 'onsetRate' : 'bpmSlow';
  data.availableDataKeys = ensureAvailableKey(data.availableDataKeys || [], dataKey);

  const songIds = Object.keys(data.songData);
  let ok = 0;
  for (const songId of songIds) {
    const rel = songId.startsWith('/') ? songId.slice(1) : songId;
    const audioPath = path.join(publicRoot, rel);
    if (!fs.existsSync(audioPath)) {
      console.warn(`[skip] missing file for ${songId}`);
      continue;
    }
    try {
      const samples = decodeAudioToMonoF32At44100(ffmpegPath, audioPath);
      if (args.merge === 'onsetRate') {
        const onsetRate = computeOnsetRate(essentia, samples);
        data.songData[songId].onsetRate = onsetRate;
        console.log(`[ok] ${songId} onsetRate=${onsetRate}`);
      } else {
        const bpmSlow = computeBpmSlow(essentia, samples);
        data.songData[songId].bpmSlow = bpmSlow;
        console.log(`[ok] ${songId} bpmSlow=${bpmSlow}`);
      }
      ok++;
    } catch (e) {
      console.error(`[fail] ${songId}:`, e.message || e);
    }
  }

  if (args.dryRun) {
    console.log(`Dry run: would write ${outPath} (${ok} songs updated).`);
    return;
  }

  fs.writeFileSync(outPath, JSON.stringify(data, null, 4) + '\n', 'utf8');
  console.log(`Wrote ${outPath} (${ok} songs).`);
}

main();

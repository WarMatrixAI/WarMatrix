require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const isWin = process.platform === 'win32';

const npmCmd = isWin ? 'npm.cmd' : 'npm';
const pythonVenvPath = isWin
  ? path.join(root, '.venv', 'Scripts', 'python.exe')
  : path.join(root, '.venv', 'bin', 'python');

const pythonCmd = fs.existsSync(pythonVenvPath) ? pythonVenvPath : 'python';

const processes = [];
let shuttingDown = false;

function prefixAndWrite(stream, label, data) {
  const text = data.toString();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    stream.write(`[${label}] ${line}\n`);
  }
}

function startProcess({ label, cmd, args, cwd, shell = false, env = process.env }) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
    env,
  });

  child.stdout.on('data', (d) => prefixAndWrite(process.stdout, label, d));
  child.stderr.on('data', (d) => prefixAndWrite(process.stderr, label, d));

  child.on('exit', (code) => {
    if (shuttingDown) return;
    if (code !== 0) {
      console.error(`[${label}] exited with code ${code}. Shutting down all processes.`);
      shutdown(code || 1);
    }
  });

  processes.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const p of processes) {
    if (!p.killed) {
      try {
        p.kill('SIGTERM');
      } catch {
        // Ignore process kill failures during shutdown.
      }
    }
  }

  setTimeout(() => {
    for (const p of processes) {
      if (!p.killed) {
        try {
          p.kill('SIGKILL');
        } catch {
          // Ignore force-kill failures.
        }
      }
    }
    process.exit(exitCode);
  }, 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startProcess({
  label: 'NEXT',
  cmd: npmCmd,
  args: ['run', 'dev:next'],
  cwd: root,
  shell: false,
});

startProcess({
  label: 'BACKEND',
  cmd: pythonCmd,
  args: ['-m', 'uvicorn', 'main:app', '--reload', '--host', '0.0.0.0', '--port', '8001'],
  cwd: path.join(root, 'backend'),
  shell: false,
});

startProcess({
  label: 'AI_SERVER',
  cmd: pythonCmd,
  args: [path.join(root, 'ai_server', 'backend_server.py')],
  cwd: path.join(root, 'ai_server'),
  shell: false,
  env: {
    ...process.env,
    HF_TOKEN: process.env.HF_TOKEN,
    USE_LM_STUDIO: process.env.USE_LM_STUDIO || 'true', // 'true' or 'false'
    LM_STUDIO_IP: process.env.LM_STUDIO_IP || 'localhost',
    LM_STUDIO_PORT: process.env.LM_STUDIO_PORT || '1234',
    LM_STUDIO_API_KEY: process.env.LM_STUDIO_API_KEY || '',
    MODEL_PATH: path.join('wargaming_llm', 'wargame_final_outputs', 'checkpoint-125'),
    LOAD_IN_4BIT: 'true',
    USE_8BIT: 'false',
    CPU_OFFLOAD: 'true',
    MAX_GPU_MEMORY_GB: '24',
    COMPUTE_DTYPE: 'float16',
    USE_CACHE: 'true',
    EMPTY_CUDA_CACHE_AFTER_REQUEST: 'true',
    HF_HUB_DISABLE_SYMLINKS: '1',
    PYTHONUNBUFFERED: '1'
  }
});

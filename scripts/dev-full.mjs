import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';

function start(command, args) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    windowsHide: true
  });
}

const children = [
  start('node', ['server.mjs']),
  start(isWindows ? 'npx.cmd' : 'npx', ['vite', '--configLoader', 'runner', '--port=3000', '--host=0.0.0.0'])
];

function stopAll(signal = 'SIGTERM') {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}

process.on('SIGINT', () => {
  stopAll('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll('SIGTERM');
  process.exit(0);
});

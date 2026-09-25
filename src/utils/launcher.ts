import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getNodeExecutable(): string {
  const candidates = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
    `${process.env.LOCALAPPDATA}\\Programs\\node\\node.exe`,
    `${process.env.APPDATA}\\nvm\\current\\node.exe`,
    'node',
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return c;
      }
    } catch {
      // ignora
    }
  }

  return 'node';
}

function findLauncherScript(): { scriptPath: string; cwd: string } {
  const candidates = [
    // 1. In project directory relative to dist/
    {
      scriptPath: path.resolve(__dirname, '..', 'server', 'launcher.js'),
      cwd: path.resolve(__dirname, '..'),
    },
    // 2. In same folder (if server is copied into dist or extension folder)
    {
      scriptPath: path.resolve(__dirname, 'server', 'launcher.js'),
      cwd: __dirname,
    },
    // 3. In process working directory
    {
      scriptPath: path.resolve(process.cwd(), 'server', 'launcher.js'),
      cwd: process.cwd(),
    },
    // 4. In installed Raycast extension folder
    {
      scriptPath: path.join(os.homedir(), '.config', 'raycast', 'extensions', 'fotoduo', 'server', 'launcher.js'),
      cwd: path.join(os.homedir(), '.config', 'raycast', 'extensions', 'fotoduo'),
    },
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c.scriptPath)) {
        return c;
      }
    } catch {}
  }

  return candidates[0];
}

export function launchFotoduoWindow(imagePaths: string[] = []): Promise<void> {
  return new Promise((resolve) => {
    const nodeBin = getNodeExecutable();
    const launcher = findLauncherScript();

    const child = spawn(nodeBin, [launcher.scriptPath, JSON.stringify(imagePaths)], {
      cwd: launcher.cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    child.unref();
    resolve();
  });
}


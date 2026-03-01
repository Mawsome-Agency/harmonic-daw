import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { EngineBridge } from './engineBridge';
import { ProjectManager } from './projectManager';

let mainWindow: BrowserWindow | null = null;
let engineBridge: EngineBridge | null = null;
let projectManager: ProjectManager | null = null;

const isDev = process.env.NODE_ENV === 'development';

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f0f0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 12, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !isDev,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, '../renderer/index.html')
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window close with unsaved changes
  mainWindow.on('close', async (e) => {
    if (projectManager?.hasUnsavedChanges()) {
      e.preventDefault();
      const { response } = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        message: 'Save changes before closing?',
        detail: 'Your project has unsaved changes.',
      });
      if (response === 0) {
        await projectManager?.saveProject();
        mainWindow?.destroy();
      } else if (response === 1) {
        mainWindow?.destroy();
      }
      // response === 2: cancel, do nothing
    }
  });
}

async function initializeEngine() {
  engineBridge = new EngineBridge(mainWindow!);
  await engineBridge.initialize();
  registerEngineHandlers(engineBridge);
}

function registerEngineHandlers(bridge: EngineBridge) {
  ipcMain.handle('engine:get-state', () => bridge.getState());
  ipcMain.handle('engine:list-devices', () => bridge.listDevices());
  ipcMain.handle('engine:set-device', (_, config) => bridge.setDevice(config));
  ipcMain.handle('engine:transport', (_, cmd) => bridge.handleTransport(cmd));
  ipcMain.handle('engine:get-transport', () => bridge.getTransport());
  ipcMain.handle('engine:list-midi-devices', () => bridge.listMidiDevices());
  ipcMain.handle('engine:scan-plugins', (_, paths) => bridge.scanPlugins(paths));
  ipcMain.handle('engine:load-plugin', (_, trackId, pluginId, position) =>
    bridge.loadPlugin(trackId, pluginId, position));
  ipcMain.handle('engine:unload-plugin', (_, trackId, instanceId) =>
    bridge.unloadPlugin(trackId, instanceId));
  ipcMain.handle('engine:set-plugin-param', (_, instanceId, paramId, value) =>
    bridge.setPluginParam(instanceId, paramId, value));
  ipcMain.handle('engine:open-plugin-editor', (_, instanceId) =>
    bridge.openPluginEditor(instanceId));
  ipcMain.handle('engine:close-plugin-editor', (_, instanceId) =>
    bridge.closePluginEditor(instanceId));
  ipcMain.handle('engine:get-plugins', () => bridge.getScannedPlugins());
}

function registerFsHandlers() {
  projectManager = new ProjectManager();

  ipcMain.handle('fs:save-project', async (_, project, filePath) => {
    return projectManager!.saveProject(project, filePath);
  });

  ipcMain.handle('fs:load-project', async (_, filePath) => {
    return projectManager!.loadProject(filePath);
  });

  ipcMain.handle('fs:get-recent-projects', () => {
    return projectManager!.getRecentProjects();
  });

  ipcMain.handle('fs:open-file-dialog', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: options.title,
      filters: options.filters,
      properties: options.multiSelect ? ['openFile', 'multiSelections'] : ['openFile'],
      defaultPath: options.defaultPath,
    });
    return result.filePaths;
  });

  ipcMain.handle('fs:export-audio', async (_, options) => {
    return engineBridge?.exportAudio(options);
  });
}

app.whenReady().then(async () => {
  await createWindow();
  await initializeEngine();
  registerFsHandlers();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  engineBridge?.shutdown();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

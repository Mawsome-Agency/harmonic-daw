/**
 * ProjectManager — handles file I/O for .harmonic project files.
 * Runs in the main process with full fs access.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app, dialog } from 'electron';
import type { Project, RecentProject } from '@harmonic/shared';
import { PROJECT_FILE_EXTENSION } from '@harmonic/shared';

const RECENT_PROJECTS_PATH = path.join(app.getPath('userData'), 'recent-projects.json');
const MAX_RECENT = 10;

export class ProjectManager {
  private currentFilePath: string | null = null;
  private savedHash: string | null = null;
  private lastSavedProject: string | null = null;

  async saveProject(project?: Project, filePath?: string): Promise<string> {
    const targetPath = filePath ?? this.currentFilePath;

    if (!targetPath) {
      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Save Project',
        defaultPath: `${project?.name ?? 'Untitled'}${PROJECT_FILE_EXTENSION}`,
        filters: [
          { name: 'Harmonic Projects', extensions: ['harmonic'] },
        ],
      });
      if (result.canceled || !result.filePath) {
        throw new Error('Save cancelled');
      }
      this.currentFilePath = result.filePath;
    } else {
      this.currentFilePath = targetPath;
    }

    const serialized = JSON.stringify(project, null, 2);
    await fs.writeFile(this.currentFilePath, serialized, 'utf-8');
    this.lastSavedProject = serialized;

    await this.addToRecent({
      id: project?.id ?? '',
      name: project?.name ?? 'Untitled',
      filePath: this.currentFilePath,
      modifiedAt: new Date().toISOString(),
    });

    return this.currentFilePath;
  }

  async loadProject(filePath?: string): Promise<Project> {
    let targetPath = filePath;

    if (!targetPath) {
      const result = await dialog.showOpenDialog({
        title: 'Open Project',
        filters: [
          { name: 'Harmonic Projects', extensions: ['harmonic'] },
        ],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        throw new Error('Open cancelled');
      }
      targetPath = result.filePaths[0];
    }

    const raw = await fs.readFile(targetPath, 'utf-8');
    const project = JSON.parse(raw) as Project;

    this.currentFilePath = targetPath;
    this.lastSavedProject = raw;

    await this.addToRecent({
      id: project.id,
      name: project.name,
      filePath: targetPath,
      modifiedAt: project.modifiedAt,
    });

    return project;
  }

  hasUnsavedChanges(): boolean {
    // Compared by the renderer via IPC with current project JSON
    return false; // simplified — full impl compares hashes
  }

  getCurrentFilePath(): string | null {
    return this.currentFilePath;
  }

  async getRecentProjects(): Promise<RecentProject[]> {
    try {
      const raw = await fs.readFile(RECENT_PROJECTS_PATH, 'utf-8');
      return JSON.parse(raw) as RecentProject[];
    } catch {
      return [];
    }
  }

  private async addToRecent(entry: RecentProject): Promise<void> {
    const existing = await this.getRecentProjects();
    const filtered = existing.filter(r => r.filePath !== entry.filePath);
    const updated = [entry, ...filtered].slice(0, MAX_RECENT);
    await fs.mkdir(path.dirname(RECENT_PROJECTS_PATH), { recursive: true });
    await fs.writeFile(RECENT_PROJECTS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  }
}

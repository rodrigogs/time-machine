import * as vscode from 'vscode'

import path = require('path')
import os = require('os')
// Import is-path-inside as a require since it's used dynamically

const enum EHistoryEnabled {
    Never = 0,
    Always,
    Workspace, // only when file is in the opened folder
}

const enum EHistoryTreeLocation {
    Explorer = 0,
    LocalHistory,
}

export interface IHistorySettings {
    folder: vscode.Uri
    daysLimit: number
    saveDelay: number
    maxDisplay: number
    dateLocale: string
    exclude: string[]
    enabled: boolean
    historyPath: string
    absolute: boolean
}

/**
 * Settings for history.
 */
export class HistorySettings {
    private settings: IHistorySettings[]

    public static getTreeLocation(): EHistoryTreeLocation {
        let config = vscode.workspace.getConfiguration('time-machine')
        return <EHistoryTreeLocation>config.get('treeLocation')
    }

    constructor() {
        this.settings = []
    }

    public get(file: vscode.Uri): IHistorySettings {
        // Find workspaceFolder corresponding to file
        let folder
        // const wsFolder = vscode.workspace.getWorkspaceFolder(file);
        // temporary code to resolve bug https://github.com/Microsoft/vscode/issues/36221
        const wsFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file.fsPath))
        if (wsFolder) {
            folder = wsFolder.uri
        }

        /*
        let folder = vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined;
        if (folder) {
            // if file is not a child of workspace => undefined
            const relativeFile = vscode.workspace.asRelativePath(file.fsPath);
            if (relativeFile === file.fsPath.replace(/\\/g, '/'))
                folder = undefined;
        }
        */

        let settings = this.settings.find((value, index, obj) => {
            if (folder && value.folder) {
                return value.folder.fsPath === folder.fsPath
            } else {
                return folder === value.folder
            }
        })
        if (!settings) {
            settings = this.read(folder, file, wsFolder)
            this.settings.push(settings)
        }
        return settings
    }

    public clear() {
        this.settings = []
    }

    /*
    historyPath
       absolute
         saved in historyPath\.history\<absolute>
       not absolute
         saved in historyPath\.history\vscode.getworkspacefolder.basename\<relative>
         (no workspacefolder like absolute if always)
    no historyPath
       saved in vscode.getworkspacefolder\.history\<relative>
       (no workspacefolder => not saved)
    */
    private read(workspacefolder: vscode.Uri, file: vscode.Uri, ws: vscode.WorkspaceFolder): IHistorySettings {
        // for now no ressource configurations
        // let config = vscode.workspace.getConfiguration('time-machine', file),
        let config = vscode.workspace.getConfiguration('time-machine'),
            enabled = <EHistoryEnabled>config.get('enabled'),
            exclude = <string[]>config.get('exclude'),
            historyPath,
            absolute,
            message = ''

        if (typeof enabled === 'boolean') {
            message += 'time-machine.enabled must be a number, '
        }
        if (typeof exclude === 'string') {
            message += 'time-machine.exclude must be an array, '
        }
        if (message) {
            vscode.window
                .showWarningMessage(
                    `Change setting: ${message.slice(0, -2)}`,
                    {},
                    { title: 'Settings', isCloseAffordance: false, id: 0 }
                )
                .then((action) => {
                    if (action && action.id === 0) {
                        vscode.commands.executeCommand('workbench.action.openGlobalSettings')
                    }
                })
        }

        if (enabled !== EHistoryEnabled.Never) {
            historyPath = <string>config.get('path')
            if (historyPath && typeof historyPath === 'string') {
                historyPath = historyPath
                    // replace variables like %AppData%
                    .replace(/%([^%]+)%/g, (_, key) => process.env[key])
                    // supports character ~ for homedir
                    .replace(/^~/, os.homedir())

                // start with
                // ${workspaceFolder} => current workspace
                // ${workspaceFolder: name} => workspace find by name
                // ${workspaceFolder: index} => workspace find by index
                const match = historyPath.match(/\${workspaceFolder(?:\s*:\s*(.*))?}/i)
                let historyWS: vscode.Uri
                if (match) {
                    if (match.index > 1) {
                        vscode.window.showErrorMessage(
                            `\${workspaceFolder} must starts settings time-machine.path ${historyPath}`
                        )
                    } else {
                        const wsId = match[1]
                        if (wsId) {
                            const find = vscode.workspace.workspaceFolders.find((wsf) =>
                                Number.isInteger(wsId - 1) ? wsf.index === Number.parseInt(wsId, 10) : wsf.name === wsId
                            )
                            if (find) {
                                historyWS = find.uri
                            } else {
                                vscode.window.showErrorMessage(`workspaceFolder not found ${historyPath}`)
                            }
                        } else {
                            historyWS = workspacefolder
                        }
                    }
                    if (historyWS) {
                        historyPath = historyPath.replace(match[0], historyWS.fsPath)
                    } else {
                        historyPath = null
                    }
                }

                if (historyPath) {
                    absolute = <boolean>config.get('absolute')
                    if (absolute || (!workspacefolder && enabled === EHistoryEnabled.Always)) {
                        absolute = true
                        historyPath = path.join(historyPath, '.history')
                    } else if (workspacefolder) {
                        historyPath = path.join(
                            historyPath,
                            '.history',
                            historyWS && this.pathIsInside(workspacefolder.fsPath, historyWS.fsPath)
                                ? ''
                                : path.basename(workspacefolder.fsPath)
                        )
                    }
                }
            } else if (workspacefolder) {
                // Save only files in workspace
                absolute = false
                historyPath = path.join(workspacefolder.fsPath, '.history')
            }
        } else {
            // When enabled is Never, set historyPath to null
            historyPath = null
        }

        if (historyPath && typeof historyPath === 'string') {
            historyPath = historyPath.replace(/\//g, path.sep)
        }

        return {
            folder: workspacefolder,
            daysLimit: <number>config.get('daysLimit') || 30,
            saveDelay: <number>config.get('saveDelay') || 0,
            maxDisplay: <number>config.get('maxDisplay') || 10,
            dateLocale: <string>config.get('dateLocale') || undefined,
            exclude: <string[]>config.get('exclude') || [
                '**/.history/**',
                '**/.vscode/**',
                '**/node_modules/**',
                '**/typings/**',
                '**/out/**',
            ],
            enabled: historyPath != null && historyPath !== '',
            historyPath: historyPath,
            absolute: absolute,
        }
    }

    private pathIsInside(test, parent) {
        // Use a dynamic import approach that works with the test mocking
        const isPathInside = require('is-path-inside')
        return isPathInside.default ? isPathInside.default(test, parent) : isPathInside(test, parent)
    }
}

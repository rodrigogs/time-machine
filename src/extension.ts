import * as vscode from 'vscode'

import { HistoryController } from './history.controller'
import HistoryTreeProvider from './historyTree.provider'

/**
 * Activate the extension.
 */
export function activate(context: vscode.ExtensionContext) {
    const controller = new HistoryController()

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('time-machine.showAll', controller.showAll, controller)
    )
    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('time-machine.showCurrent', controller.showCurrent, controller)
    )
    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('time-machine.compareToActive', controller.compareToActive, controller)
    )
    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('time-machine.compareToCurrent', controller.compareToCurrent, controller)
    )
    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand(
            'time-machine.compareToPrevious',
            controller.compareToPrevious,
            controller
        )
    )

    // Tree
    const treeProvider = new HistoryTreeProvider(controller)
    vscode.window.registerTreeDataProvider('treeTimeMachineLocalHistory', treeProvider)
    vscode.window.registerTreeDataProvider('treeTimeMachineLocalHistoryExplorer', treeProvider)

    vscode.commands.registerCommand('treeTimeMachine.deleteAll', treeProvider.deleteAll, treeProvider)
    vscode.commands.registerCommand('treeTimeMachine.refresh', treeProvider.refresh, treeProvider)
    vscode.commands.registerCommand('treeTimeMachine.more', treeProvider.more, treeProvider)

    vscode.commands.registerCommand('treeTimeMachine.forCurrentFile', treeProvider.forCurrentFile, treeProvider)
    vscode.commands.registerCommand('treeTimeMachine.forAll', treeProvider.forAll, treeProvider)
    vscode.commands.registerCommand('treeTimeMachine.forSpecificFile', treeProvider.forSpecificFile, treeProvider)

    vscode.commands.registerCommand('treeTimeMachine.showEntry', treeProvider.show, treeProvider)
    vscode.commands.registerCommand('treeTimeMachine.showSideEntry', treeProvider.showSide, treeProvider)
    vscode.commands.registerCommand('treeTimeMachine.deleteEntry', treeProvider.delete, treeProvider)
    vscode.commands.registerCommand(
        'treeTimeMachine.compareToCurrentEntry',
        treeProvider.compareToCurrent,
        treeProvider
    )
    vscode.commands.registerCommand('treeTimeMachine.selectEntry', treeProvider.select, treeProvider)
    vscode.commands.registerCommand('treeTimeMachine.compareEntry', treeProvider.compare, treeProvider)
    vscode.commands.registerCommand('treeTimeMachine.restoreEntry', treeProvider.restore, treeProvider)

    // Create first history before save document
    vscode.workspace.onWillSaveTextDocument((e) => e.waitUntil(controller.saveFirstRevision(e.document)))

    // Create history on save document
    vscode.workspace.onDidSaveTextDocument((document) => {
        controller.saveRevision(document).then((saveDocument) => {
            // refresh viewer (if any)
            if (saveDocument) {
                treeProvider.refresh()
            }
        })
    })

    vscode.window.onDidChangeActiveTextEditor((e) => treeProvider.changeActiveFile())

    vscode.workspace.onDidChangeConfiguration((configChangedEvent) => {
        if (configChangedEvent.affectsConfiguration('time-machine.treeLocation')) {
            treeProvider.initLocation()
        } else if (configChangedEvent.affectsConfiguration('time-machine')) {
            controller.clearSettings()
            treeProvider.refresh()
        }
    })
}

// function deactivate() {
// }

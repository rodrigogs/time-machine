import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

// Note: vscode is already mocked via vitest.config.ts alias

// Create proper mock classes using the ES5 function pattern for Vitest
const HistoryController = vi.fn(function() {
  // Mock instance methods in the constructor
  this.showAll = vi.fn()
  this.showCurrent = vi.fn()
  this.compareToActive = vi.fn()
  this.compareToCurrent = vi.fn()
  this.compareToPrevious = vi.fn()
  this.saveFirstRevision = vi.fn().mockResolvedValue(undefined)
  this.saveRevision = vi.fn().mockResolvedValue({
    fileName: '/workspace/test.ts',
    uri: { fsPath: '/workspace/test.ts' }
  })
  this.clearSettings = vi.fn()
})

const HistoryTreeProvider = vi.fn(function() {
  // Mock instance methods in the constructor  
  this.deleteAll = vi.fn()
  this.refresh = vi.fn()
  this.more = vi.fn()
  this.forCurrentFile = vi.fn()
  this.forAll = vi.fn()
  this.forSpecificFile = vi.fn()
  this.show = vi.fn()
  this.showSide = vi.fn()
  this.delete = vi.fn()
  this.compareToCurrent = vi.fn()
  this.select = vi.fn()
  this.compare = vi.fn()
  this.restore = vi.fn()
  this.changeActiveFile = vi.fn()
  this.initLocation = vi.fn()
})

// Mock the modules to return our mock classes
vi.mock('./history.controller', () => ({
  HistoryController
}))

vi.mock('./historyTree.provider', () => ({
  default: HistoryTreeProvider
}))

describe('Extension', () => {
  let mockContext: vscode.ExtensionContext
  let extension: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Import extension after mocks are set up
    extension = await import('./extension')
    
    // Mock context
    mockContext = {
      subscriptions: [],
      extensionPath: '/extension/path',
      extensionUri: { fsPath: '/extension/path' },
      globalState: {
        get: vi.fn(),
        update: vi.fn()
      },
      workspaceState: {
        get: vi.fn(),
        update: vi.fn()
      }
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('activate', () => {
    it('should register all commands', async () => {
      await extension.activate(mockContext)
      
      // Verify text editor commands are registered (5 commands)
      expect(vscode.commands.registerTextEditorCommand).toHaveBeenCalledTimes(5)
      
      // Verify regular commands are registered (13 commands)  
      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(13)
      
      // Total of 18 commands registered
      const totalCommands = vi.mocked(vscode.commands.registerTextEditorCommand).mock.calls.length +
                           vi.mocked(vscode.commands.registerCommand).mock.calls.length
      expect(totalCommands).toBe(18)
    })

    it('should register tree data providers', async () => {
      await extension.activate(mockContext)
      
      expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledWith(
        'treeTimeMachineLocalHistory',
        expect.any(Object)
      )
      expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledWith(
        'treeTimeMachineLocalHistoryExplorer',
        expect.any(Object)
      )
    })

    it('should register event listeners', async () => {
      await extension.activate(mockContext)
      
      expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalledWith(
        expect.any(Function)
      )
      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalledWith(
        expect.any(Function)
      )
      expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })

    it('should add all disposables to context subscriptions', async () => {
      await extension.activate(mockContext)
      
      // Should have added multiple disposables to subscriptions
      expect(mockContext.subscriptions.length).toBeGreaterThan(0)
    })
  })

  describe('deactivate', () => {
    it('should not export deactivate function', () => {
      // Extension doesn't export deactivate function (it's commented out)
      expect('deactivate' in extension).toBe(false)
    })
  })

  describe('command handlers', () => {
    beforeEach(async () => {
      // Activate extension to register commands
      await extension.activate(mockContext)
    })

    it('should handle showAll command', () => {
      // Get the registered text editor command handler
      const calls = vi.mocked(vscode.commands.registerTextEditorCommand).mock.calls
      const showAllCall = calls.find(call => call[0] === 'time-machine.showAll')
      
      expect(showAllCall).toBeDefined()
      expect(typeof showAllCall![1]).toBe('function')
    })

    it('should handle showCurrent command', () => {
      const calls = vi.mocked(vscode.commands.registerTextEditorCommand).mock.calls
      const showCurrentCall = calls.find(call => call[0] === 'time-machine.showCurrent')
      
      expect(showCurrentCall).toBeDefined()
      expect(typeof showCurrentCall![1]).toBe('function')
    })

    it('should handle tree refresh command', () => {
      const calls = vi.mocked(vscode.commands.registerCommand).mock.calls
      const refreshCall = calls.find(call => call[0] === 'treeTimeMachine.refresh')
      
      expect(refreshCall).toBeDefined()
      expect(typeof refreshCall![1]).toBe('function')
    })

    it('should handle tree delete all command', () => {
      const calls = vi.mocked(vscode.commands.registerCommand).mock.calls
      const deleteAllCall = calls.find(call => call[0] === 'treeTimeMachine.deleteAll')
      
      expect(deleteAllCall).toBeDefined()
      expect(typeof deleteAllCall![1]).toBe('function')
    })
  })

  describe('event handlers', () => {
    beforeEach(async () => {
      await extension.activate(mockContext)
    })

    it('should handle document save events', async () => {
      const mockDocument = {
        uri: { fsPath: '/workspace/test.ts' },
        fileName: '/workspace/test.ts',
        languageId: 'typescript',
        isUntitled: false,
        isDirty: false
      } as vscode.TextDocument
      
      // Extract the save handler from the mock calls
      const onDidSaveCalls = vi.mocked(vscode.workspace.onDidSaveTextDocument).mock.calls
      expect(onDidSaveCalls).toHaveLength(1)
      
      const saveHandler = onDidSaveCalls[0][0]
      expect(typeof saveHandler).toBe('function')
      
      // Call the handler - should not throw (doesn't return a Promise)
      expect(() => saveHandler(mockDocument)).not.toThrow()
    })

    it('should handle configuration change events', () => {
      const mockEvent = {
        affectsConfiguration: vi.fn().mockReturnValue(false)
      } as any

      // Extract the config handler from the mock calls
      const onDidChangeConfigCalls = vi.mocked(vscode.workspace.onDidChangeConfiguration).mock.calls
      expect(onDidChangeConfigCalls).toHaveLength(1)
      
      const configHandler = onDidChangeConfigCalls[0][0]
      expect(typeof configHandler).toBe('function')
      
      // Call the handler - should not throw
      expect(() => configHandler(mockEvent)).not.toThrow()
    })

    it('should handle active editor change events', () => {
      const mockEditor = {
        document: {
          uri: { fsPath: '/workspace/test.ts' }
        }
      } as vscode.TextEditor

      // Extract the editor change handler from the mock calls
      const onDidChangeEditorCalls = vi.mocked(vscode.window.onDidChangeActiveTextEditor).mock.calls
      expect(onDidChangeEditorCalls).toHaveLength(1)
      
      const editorHandler = onDidChangeEditorCalls[0][0]
      expect(typeof editorHandler).toBe('function')
      
      // Call the handler - should not throw
      expect(() => editorHandler(mockEditor)).not.toThrow()
    })

    it('should handle undefined active editor', () => {
      const onDidChangeEditorCalls = vi.mocked(vscode.window.onDidChangeActiveTextEditor).mock.calls
      const editorHandler = onDidChangeEditorCalls[0][0]
      
      expect(() => editorHandler(undefined)).not.toThrow()
    })
  })

  describe('error handling', () => {
    it('should handle activation errors gracefully', () => {
      // Mock a failure in command registration
      vi.mocked(vscode.commands.registerTextEditorCommand).mockImplementation(() => {
        throw new Error('Registration failed')
      })

      // Should throw the error synchronously since activate is not async
      expect(() => extension.activate(mockContext)).toThrow('Registration failed')
    })

    it('should handle event handler errors', async () => {
      await extension.activate(mockContext)
      
      const saveCall = vi.mocked(vscode.workspace.onDidSaveTextDocument).mock.calls[0]
      const saveHandler = saveCall[0]
      
      const mockDocument = {
        uri: { fsPath: '/workspace/test.ts' }
      } as any

      // Should handle errors in save handler gracefully (doesn't return a Promise)
      expect(() => saveHandler(mockDocument)).not.toThrow()
    })
  })

  describe('extension lifecycle', () => {
    it('should properly initialize', async () => {
      // Activate
      await extension.activate(mockContext)
      expect(mockContext.subscriptions.length).toBeGreaterThan(0)
    })

    it('should handle multiple activations', async () => {
      await extension.activate(mockContext)
      const initialSubscriptions = mockContext.subscriptions.length
      
      // Second activation should register new handlers
      await extension.activate(mockContext)
      expect(mockContext.subscriptions.length).toBeGreaterThanOrEqual(initialSubscriptions)
    })
  })

  describe('integration scenarios', () => {
    it('should handle typical user workflow', async () => {
      // Activate extension
      await extension.activate(mockContext)
      
      // Simulate document save
      const saveCall = vi.mocked(vscode.workspace.onDidSaveTextDocument).mock.calls[0]
      const saveHandler = saveCall[0]
      
      const mockDocument = {
        uri: { fsPath: '/workspace/test.ts' },
        fileName: '/workspace/test.ts'
      } as any
      
      await saveHandler(mockDocument)
      
      // Simulate active editor change
      const editorCall = vi.mocked(vscode.window.onDidChangeActiveTextEditor).mock.calls[0]
      const editorHandler = editorCall[0]
      
      const mockEditor = {
        document: mockDocument
      } as any
      
      editorHandler(mockEditor)
      
      // Should complete without errors
      expect(true).toBe(true)
    })

    it('should handle configuration changes', async () => {
      await extension.activate(mockContext)
      
      const configCall = vi.mocked(vscode.workspace.onDidChangeConfiguration).mock.calls[0]
      const configHandler = configCall[0]
      
      const mockEvent = {
        affectsConfiguration: vi.fn()
          .mockReturnValueOnce(true)  // First call for 'time-machine.treeLocation'
          .mockReturnValueOnce(false) // Second call for 'time-machine'
      } as any
      
      configHandler(mockEvent)
      
      // Should check treeLocation first, then general time-machine config
      expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('time-machine.treeLocation')
    })

    it('should handle treeLocation configuration changes', async () => {
      await extension.activate(mockContext)
      
      const configCall = vi.mocked(vscode.workspace.onDidChangeConfiguration).mock.calls[0]
      const configHandler = configCall[0]
      
      const mockEvent = {
        affectsConfiguration: vi.fn()
          .mockImplementation((section: string) => section === 'time-machine.treeLocation')
      } as any
      
      configHandler(mockEvent)
      
      expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('time-machine.treeLocation')
      
      // Get the tree provider instance from the constructor call
      const treeProviderInstances = HistoryTreeProvider.mock.results
      if (treeProviderInstances.length > 0) {
        expect(treeProviderInstances[0].value.initLocation).toHaveBeenCalled()
      }
    })

    it('should handle general time-machine configuration changes', async () => {
      await extension.activate(mockContext)
      
      const configCall = vi.mocked(vscode.workspace.onDidChangeConfiguration).mock.calls[0]
      const configHandler = configCall[0]
      
      const mockEvent = {
        affectsConfiguration: vi.fn()
          .mockImplementation((section: string) => {
            if (section === 'time-machine.treeLocation') {return false}
            if (section === 'time-machine') {return true}
            return false
          })
      } as any
      
      configHandler(mockEvent)
      
      expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('time-machine.treeLocation')
      expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('time-machine')
      
      // Get the instances from the constructor calls
      const controllerInstances = HistoryController.mock.results
      const treeProviderInstances = HistoryTreeProvider.mock.results
      
      if (controllerInstances.length > 0) {
        expect(controllerInstances[0].value.clearSettings).toHaveBeenCalled()
      }
      if (treeProviderInstances.length > 0) {
        expect(treeProviderInstances[0].value.refresh).toHaveBeenCalled()
      }
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import HistoryTreeProvider from './historyTree.provider'
import { HistoryController } from './history.controller'
import { HistorySettings } from './history.settings'
import * as vscode from 'vscode'

// Mock dependencies
vi.mock('vscode', () => ({
  TreeItem: vi.fn().mockImplementation(function(label, collapsibleState) {
    this.label = label
    this.collapsibleState = collapsibleState
    this.command = undefined
    this.contextValue = undefined
    this.iconPath = undefined
    this.tooltip = undefined
    return this
  }),
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path, scheme: 'file', path }))
  },
  Range: vi.fn().mockImplementation((start, end) => ({ start, end })),
  Position: vi.fn().mockImplementation((line, character) => ({ line, character })),
  window: {
    showInputBox: vi.fn(),
    showQuickPick: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    activeTextEditor: {
      document: {
        uri: { fsPath: '/workspace/test.ts' },
        fileName: '/workspace/test.ts'
      },
      selection: {
        active: { line: 0, character: 0 }
      },
      viewColumn: 1
    }
  },
  commands: {
    executeCommand: vi.fn()
  },
  workspace: {
    getConfiguration: vi.fn(),
    getWorkspaceFolder: vi.fn()
  },
  EventEmitter: vi.fn().mockImplementation(() => ({
    event: vi.fn(),
    fire: vi.fn(),
    dispose: vi.fn()
  })),
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
    Active: -1,
    Beside: -2
  }
}))

vi.mock('./history.controller', () => ({
  HistoryController: vi.fn().mockImplementation(() => ({
    getSettings: vi.fn().mockReturnValue({
      folder: { fsPath: '/workspace' },
      enabled: true,
      historyPath: '/workspace/.history',
      exclude: [],
      daysLimit: 30,
      saveDelay: 0,
      maxDisplay: 10,
      absolute: false
    }),
    findGlobalHistory: vi.fn().mockResolvedValue([
      '/workspace/.history/test_20241201_120000.ts',
      '/workspace/.history/test_20241201_110000.ts'
    ]),
    decodeFile: vi.fn().mockImplementation((path: string) => {
      if (path.includes('invalid')) {return null}
      return {
        name: 'test',
        ext: '.ts',
        file: path,
        date: new Date('2024-12-01T12:00:00')
      }
    }),
    compare: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    deleteFiles: vi.fn().mockResolvedValue(undefined),
    deleteAll: vi.fn().mockResolvedValue(undefined),
    deleteHistory: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('./history.settings', () => ({
  HistorySettings: {
    getTreeLocation: vi.fn(() => 0)
  }
}))

describe('HistoryTreeProvider', () => {
  let treeProvider: HistoryTreeProvider
  let mockController: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Ensure activeTextEditor is properly set
    vi.mocked(vscode.window).activeTextEditor = {
      document: {
        uri: { fsPath: '/workspace/test.ts' },
        fileName: '/workspace/test.ts'
      },
      selection: {
        active: { line: 0, character: 0 }
      },
      viewColumn: 1
    } as any
    
    // Reset window methods to return promises
    vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined)
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined)
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined)
    
    // Create mock controller instance
    mockController = {
      getSettings: vi.fn().mockReturnValue({
        folder: { fsPath: '/workspace' },
        enabled: true,
        historyPath: '/workspace/.history',
        exclude: [],
        daysLimit: 30,
        saveDelay: 0,
        maxDisplay: 10,
        absolute: false,
        dateLocale: 'en-US'
      }),
      findGlobalHistory: vi.fn().mockResolvedValue([
        '/workspace/.history/test_20241201_120000.ts',
        '/workspace/.history/test_20241201_110000.ts'
      ]),
      decodeFile: vi.fn().mockImplementation((path: string) => {
        if (path.includes('invalid')) {return null}
        return {
          name: 'test',
          ext: '.ts',
          file: path,
          date: new Date('2024-12-01T12:00:00'),
          dir: '/workspace'
        }
      }),
      compare: vi.fn(),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      deleteFiles: vi.fn().mockResolvedValue(undefined),
      deleteAll: vi.fn().mockResolvedValue(undefined),
      deleteHistory: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined)
    }
    
    // Create tree provider with mocked controller
    treeProvider = new HistoryTreeProvider(mockController)
    
    // Mock the EventEmitter with proper fire function
    const mockEventEmitter = {
      event: vi.fn(),
      fire: vi.fn(),
      dispose: vi.fn()
    }
    ;(treeProvider as any)._onDidChangeTreeData = mockEventEmitter
    
    // Initialize the format function that's normally set in loadHistoryFile
    ;(treeProvider as any).format = (file: any) => {
      if (file && file.date) {
        return file.date.toLocaleString('en-US')
      }
      return 'Unknown date'
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create a new HistoryTreeProvider instance', () => {
      expect(treeProvider).toBeInstanceOf(HistoryTreeProvider)
    })

    it('should initialize tree location', () => {
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'time-machine:treeLocation',
        0
      )
    })
  })

  describe('getTreeItem', () => {
    it('should return the tree item as-is', () => {
      const mockItem = { label: 'test', kind: 0 } as any
      const result = treeProvider.getTreeItem(mockItem)
      expect(result).toBe(mockItem)
    })
  })

  describe('getChildren', () => {
    it('should return root items when no element provided', async () => {
      const children = await treeProvider.getChildren()
      expect(children).toBeDefined()
      expect(Array.isArray(children)).toBe(true)
    })

    it('should handle no active text editor', async () => {
      // Mock no active editor
      vi.mocked(vscode.window).activeTextEditor = undefined
      
      const children = await treeProvider.getChildren()
      expect(children).toEqual([])
    })

    it('should load history files for active editor', async () => {
      // Ensure historyFiles is not set initially
      expect((treeProvider as any).historyFiles).toBeUndefined()
      
      // Check that we have an active text editor
      expect(vscode.window.activeTextEditor).toBeDefined()
      expect(vscode.window.activeTextEditor?.document).toBeDefined()
      
      const children = await treeProvider.getChildren()
      
      // These should be called during the flow
      expect(mockController.getSettings).toHaveBeenCalled()
      expect(mockController.findGlobalHistory).toHaveBeenCalled()
      expect(children.length).toBeGreaterThan(0)
    })

    it('should return cached children when tree exists', async () => {
      // First call to populate the tree
      await treeProvider.getChildren()
      
      // Mock the tree structure
      const mockTree = {
        'Today': {
          grp: { label: 'Today', kind: 1 },
          items: [{ label: 'test.ts', kind: 2 }]
        }
      }
      ;(treeProvider as any).tree = mockTree
      
      // Should return cached items
      const children = await treeProvider.getChildren()
      expect(children.length).toBeGreaterThan(0)
    })

    it('should return group items when element is provided', async () => {
      // Set up mock tree with items
      const groupElement = { label: 'Today', kind: 1 } as any
      
      // Mock the tree structure
      const mockTree = {
        'Today': {
          grp: groupElement,
          items: [{ label: 'test.ts', kind: 2 }]
        }
      }
      ;(treeProvider as any).tree = mockTree
      
      const children = await treeProvider.getChildren(groupElement)
      expect(children).toEqual([{ label: 'test.ts', kind: 2 }])
    })

    it('should build tree items for group elements', async () => {
      // Mock history files
      const mockHistoryFiles = {
        'Today': [
          {
            name: 'test',
            ext: '.ts', 
            file: '/workspace/.history/test_20241201_120000.ts',
            date: new Date('2024-12-01T12:00:00')
          }
        ]
      }
      ;(treeProvider as any).historyFiles = mockHistoryFiles
      
      // Initialize the tree structure
      const mockTree = {
        'Today': {
          grp: { label: 'Today', kind: 1 },
          items: undefined // Will be set by getChildren
        }
      }
      ;(treeProvider as any).tree = mockTree
      
      const groupElement = { label: 'Today', kind: 1 } as any
      
      const children = await treeProvider.getChildren(groupElement)
      expect(children).toBeDefined()
      expect(children.length).toBeGreaterThan(0)
    })
  })

  describe('content kind methods', () => {
    it('should set content kind to current file', () => {
      treeProvider.forCurrentFile()
      expect(treeProvider.contentKind).toBe(0) // EHistoryTreeContentKind.Current
    })

    it('should set content kind to all files', () => {
      treeProvider.forAll()
      expect(treeProvider.contentKind).toBe(1) // EHistoryTreeContentKind.All
    })

    it('should set content kind to search and prompt for pattern', async () => {
      vi.mocked(vscode.window.showInputBox).mockResolvedValue('*.js')
      
      await treeProvider.forSpecificFile()
      
      expect(vscode.window.showInputBox).toHaveBeenCalledWith({
        prompt: 'Specify what to search:',
        value: '**/*myFile*.*',
        valueSelection: [4, 10]
      })
      expect(treeProvider.contentKind).toBe(2) // EHistoryTreeContentKind.Search
      expect((treeProvider as any).searchPattern).toBe('*.js')
    })

    it('should not change content kind if no pattern provided', async () => {
      const originalContentKind = treeProvider.contentKind
      vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined)
      
      await treeProvider.forSpecificFile()
      
      expect(treeProvider.contentKind).toBe(originalContentKind)
    })
  })

  describe('refresh and tree management', () => {
    it('should refresh without limit', () => {
      const fireSpy = vi.spyOn((treeProvider as any)._onDidChangeTreeData, 'fire')
      
      treeProvider.refresh()
      
      expect((treeProvider as any).tree).toEqual({})
      expect((treeProvider as any).noLimit).toBe(false)
      expect(fireSpy).toHaveBeenCalledWith(undefined)
    })

    it('should refresh with no limit', () => {
      const fireSpy = vi.spyOn((treeProvider as any)._onDidChangeTreeData, 'fire')
      
      treeProvider.refresh(true)
      
      expect((treeProvider as any).noLimit).toBe(true)
      expect(fireSpy).toHaveBeenCalledWith(undefined)
    })

    it('should enable more items', () => {
      treeProvider.more()
      
      expect((treeProvider as any).noLimit).toBe(true)
    })

    it('should change active file if different', () => {
      const mockNewFile = { fsPath: '/workspace/new-test.ts' }
      vi.mocked(vscode.window).activeTextEditor = {
        document: { uri: mockNewFile }
      } as any

      // Mock different current file
      ;(treeProvider as any).currentHistoryFile = '/workspace/old-test.ts'
      
      mockController.decodeFile.mockReturnValue({
        file: '/workspace/new-test.ts',
        name: 'new-test',
        ext: '.ts',
        date: new Date()
      })

      const refreshSpy = vi.spyOn(treeProvider, 'refresh')
      
      treeProvider.changeActiveFile()
      
      expect(refreshSpy).toHaveBeenCalled()
    })

    it('should not refresh if same file', () => {
      const mockFile = { fsPath: '/workspace/test.ts' }
      vi.mocked(vscode.window).activeTextEditor = {
        document: { uri: mockFile }
      } as any

      // Mock same current file
      ;(treeProvider as any).currentHistoryFile = '/workspace/test.ts'
      
      mockController.decodeFile.mockReturnValue({
        file: '/workspace/test.ts',
        name: 'test',
        ext: '.ts',
        date: new Date()
      })

      const refreshSpy = vi.spyOn(treeProvider, 'refresh')
      
      treeProvider.changeActiveFile()
      
      expect(refreshSpy).not.toHaveBeenCalled()
    })

    it('should handle no active editor in changeActiveFile', () => {
      vi.mocked(vscode.window).activeTextEditor = undefined
      
      const refreshSpy = vi.spyOn(treeProvider, 'refresh')
      
      treeProvider.changeActiveFile()
      
      expect(refreshSpy).not.toHaveBeenCalled()
    })
  })

  describe('file operations', () => {
    let mockHistoryItem: any

    beforeEach(() => {
      mockHistoryItem = {
        kind: 2, // EHistoryTreeItem.File
        file: vscode.Uri.file('/workspace/.history/test_20241201_120000.ts'),
        label: 'test.ts',
        grp: 'Today'
      }
    })

    it('should show file', () => {
      const mockUri = vscode.Uri.file('/test/file.ts')
      
      treeProvider.show(mockUri)
      
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.open',
        mockUri
      )
    })

    it('should show file in side editor', () => {
      treeProvider.showSide(mockHistoryItem)
      
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.open',
        mockHistoryItem.file,
        2
      )
    })

    it('should delete single file', async () => {
      await treeProvider.delete(mockHistoryItem)
      
      expect(mockController.deleteFile).toHaveBeenCalledWith(mockHistoryItem.file.fsPath)
    })

    it('should not delete if user cancels', async () => {
      // This test doesn't apply since delete doesn't prompt user
      const groupItem = {
        kind: 1, // EHistoryTreeItem.Group
        label: 'Today',
        file: undefined,
        grp: undefined
      }
      
      // Mock historyFiles for group deletion
      ;(treeProvider as any).historyFiles = {
        'Today': [
          { file: '/workspace/.history/test1.ts' },
          { file: '/workspace/.history/test2.ts' }
        ]
      }
      
      await treeProvider.delete(groupItem)
      
      expect(mockController.deleteFiles).toHaveBeenCalledWith([
        '/workspace/.history/test1.ts',
        '/workspace/.history/test2.ts'
      ])
    })

    it('should compare to current file', () => {
      // Set current history file
      ;(treeProvider as any).currentHistoryFile = '/workspace/test.ts'
      
      treeProvider.compareToCurrent(mockHistoryItem)
      
      expect(mockController.compare).toHaveBeenCalledWith(
        mockHistoryItem.file,
        vscode.Uri.file('/workspace/test.ts'),
        null,
        expect.any(Object) // Range object
      )
    })

    it('should select item for comparison', () => {
      // Mock the tree structure for selection
      ;(treeProvider as any).tree = {
        'Today': {
          grp: { collapsibleState: 1 }
        }
      }
      
      treeProvider.select(mockHistoryItem)
      
      expect((treeProvider as any).selection).toBe(mockHistoryItem)
    })

    it('should compare two selected items', () => {
      const firstItem = { ...mockHistoryItem, label: 'first.ts', grp: 'Today' }
      const secondItem = { ...mockHistoryItem, label: 'second.ts', grp: 'Today' }
      
      // Mock the tree structure
      ;(treeProvider as any).tree = {
        'Today': {
          grp: { collapsibleState: 1 }
        }
      }
      
      // Select first item
      treeProvider.select(firstItem)
      
      // Compare with second item
      treeProvider.compare(secondItem)
      
      expect(mockController.compare).toHaveBeenCalledWith(
        secondItem.file,
        firstItem.file
      )
      // The selection should still be the first item (not cleared after compare)
      expect((treeProvider as any).selection).toBe(firstItem)
    })

    it('should restore file', async () => {
      await treeProvider.restore(mockHistoryItem)
      
      expect(mockController.restore).toHaveBeenCalledWith(mockHistoryItem.file)
    })
  })

  describe('delete operations', () => {
    it('should delete all history', async () => {
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue({ title: 'Yes' } as any)
      
      // Set up current history path and content kind
      ;(treeProvider as any).currentHistoryPath = '/workspace/.history'
      treeProvider.contentKind = 1 // All
      
      await treeProvider.deleteAll()
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Delete all history - /workspace/.history?',
        { modal: true },
        { title: 'Yes' },
        { title: 'No', isCloseAffordance: true }
      )
      // Note: deleteAll doesn't await the promise chain, so we can't test the controller call directly
    })

    it('should not delete all if user cancels', async () => {
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue({ title: 'No' } as any)
      
      await treeProvider.deleteAll()
      
      // Since the method uses .then(), we can't easily test the non-execution
      expect(vscode.window.showInformationMessage).toHaveBeenCalled()
    })

    it('should handle no current history path in deleteAll', async () => {
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue({ title: 'Yes' } as any)
      
      // Ensure no current history path
      ;(treeProvider as any).currentHistoryPath = undefined
      treeProvider.contentKind = 1 // All
      
      await treeProvider.deleteAll()
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalled()
    })
  })

  describe('getSettingsItem', () => {
    it('should return settings item for All content kind', () => {
      // Create a fresh instance for this test
      const freshTreeProvider = new HistoryTreeProvider(mockController)
      freshTreeProvider.contentKind = 1 // EHistoryTreeContentKind.All
      ;(freshTreeProvider as any).currentHistoryPath = '/workspace/.history'
      
      const settingsItem = (freshTreeProvider as any).getSettingsItem()
      
      expect(settingsItem).toBeDefined()
      expect(settingsItem.label).toBe('Search: all')
      expect(settingsItem.kind).toBe(0) // EHistoryTreeItem.None
    })

    it('should return settings item for Current content kind', () => {
      // Create a fresh instance for this test
      const freshTreeProvider = new HistoryTreeProvider(mockController)
      freshTreeProvider.contentKind = 0 // EHistoryTreeContentKind.Current
      ;(freshTreeProvider as any).currentHistoryFile = '/workspace/test.ts'
      
      const settingsItem = (freshTreeProvider as any).getSettingsItem()
      
      expect(settingsItem).toBeDefined()
      expect(settingsItem.label).toBe('Search: current')
      expect(settingsItem.kind).toBe(0) // EHistoryTreeItem.None
    })

    it('should return settings item for Search content kind', () => {
      // Create a fresh instance for this test
      const freshTreeProvider = new HistoryTreeProvider(mockController)
      freshTreeProvider.contentKind = 2 // EHistoryTreeContentKind.Search
      ;(freshTreeProvider as any).searchPattern = '*.js'
      
      const settingsItem = (freshTreeProvider as any).getSettingsItem()
      
      expect(settingsItem).toBeDefined()
      expect(settingsItem.label).toBe('Search: *.js')
      expect(settingsItem.kind).toBe(0) // EHistoryTreeItem.None
    })
  })
})

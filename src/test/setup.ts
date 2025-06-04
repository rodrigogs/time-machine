import { vi } from 'vitest'

// Mock VS Code API
const mockVscode = {
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn()
    })),
    getWorkspaceFolder: vi.fn(),
    asRelativePath: vi.fn(),
    workspaceFolders: [],
    rootPath: undefined,
    onWillSaveTextDocument: vi.fn(),
    onDidSaveTextDocument: vi.fn(),
    onDidChangeConfiguration: vi.fn(),
    openTextDocument: vi.fn()
  },
  window: {
    activeTextEditor: undefined,
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
    showErrorMessage: vi.fn().mockResolvedValue(undefined),
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
    showQuickPick: vi.fn().mockResolvedValue(undefined),
    showInputBox: vi.fn().mockResolvedValue(undefined),
    showTextDocument: vi.fn().mockResolvedValue(undefined),
    registerTreeDataProvider: vi.fn(),
    onDidChangeActiveTextEditor: vi.fn(),
    visibleTextEditors: [],
    tabGroups: { all: [] }
  },
  commands: {
    registerCommand: vi.fn(),
    registerTextEditorCommand: vi.fn(),
    executeCommand: vi.fn()
  },
  Uri: {
    file: vi.fn((path: string) => ({ 
      fsPath: path, 
      path: path,
      scheme: 'file'
    })),
    parse: vi.fn()
  },
  Range: vi.fn(),
  Position: vi.fn(),
  TreeItem: class MockTreeItem {
    label: any
    collapsibleState: any
    constructor(label: any, collapsibleState: any) {
      this.label = label
      this.collapsibleState = collapsibleState
    }
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },
  EventEmitter: class MockEventEmitter {
    private _event = vi.fn()
    
    get event() {
      return this._event
    }
    
    fire(data?: any) {
      this._event(data)
    }
    
    dispose() {}
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
    Active: -1,
    Beside: -2
  }
}

// Mock the vscode module
vi.mock('vscode', () => mockVscode)

// Mock Node.js modules that VS Code extensions typically use
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  copyFile: vi.fn((src, dest, callback) => {
    // Default implementation that succeeds
    setTimeout(() => callback(null), 0)
  }),
  statSync: vi.fn(() => ({
    isFile: () => true,
    mtime: new Date(),
    birthtime: new Date(),
    size: 1024
  })),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  unlink: vi.fn((path, callback) => {
    // Default implementation that succeeds
    setTimeout(() => callback(null), 0)
  }),
  existsSync: vi.fn(() => true)
}))

vi.mock('path', () => ({
  dirname: vi.fn(),
  basename: vi.fn(),
  extname: vi.fn((path: string) => {
    const parts = path.split('.')
    return parts.length > 1 ? '.' + parts[parts.length - 1] : ''
  }),
  join: vi.fn((...args) => args.join('/')),
  parse: vi.fn((path: string) => ({
    dir: '/test/dir',
    name: 'filename',
    ext: '.ts'
  })),
  relative: vi.fn(),
  sep: '/'
}))

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user')
}))

vi.mock('is-path-inside', () => {
  return vi.fn((test: string, parent: string) => {
    return test.startsWith(parent)
  })
})

// Export mock for use in tests
export { mockVscode }

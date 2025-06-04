import { describe, it, expect, vi, beforeEach, afterEach, test } from 'vitest'
import { HistorySettings, IHistorySettings } from './history.settings'
import * as vscode from 'vscode'

// Mock VS Code API
vi.mock('vscode', () => {
  return {
    workspace: {
      getConfiguration: vi.fn(),
      getWorkspaceFolder: vi.fn(),
      workspaceFolders: [],
      asRelativePath: vi.fn()
    },
    window: {
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn()
    },
    commands: {
      executeCommand: vi.fn()
    },
    Uri: {
      file: vi.fn((path: string) => ({
        fsPath: path,
        scheme: 'file',
        path: path
      }))
    }
  }
})

describe('HistorySettings', () => {
  let historySettings: HistorySettings
  let mockConfiguration: any

  beforeEach(() => {
    vi.clearAllMocks()
    historySettings = new HistorySettings()
    
    // Setup default mock configuration
    mockConfiguration = {
      get: vi.fn((key: string) => {
        const defaults = {
          'enabled': 1, // Always enabled
          'exclude': [
            '**/.history/**',
            '**/.vscode/**',
            '**/node_modules/**',
            '**/typings/**',
            '**/out/**'
          ],
          'path': '',
          'absolute': false,
          'daysLimit': 30,
          'saveDelay': 0,
          'maxDisplay': 10,
          'dateLocale': '',
          'treeLocation': 0 // Explorer
        }
        return defaults[key]
      })
    }
    
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfiguration)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create a new HistorySettings instance', () => {
      expect(historySettings).toBeInstanceOf(HistorySettings)
    })

    it('should initialize with empty settings array', () => {
      expect(historySettings['settings']).toEqual([])
    })
  })

  describe('getTreeLocation', () => {
    it('should return Explorer location by default', () => {
      const location = HistorySettings.getTreeLocation()
      expect(location).toBe(0) // EHistoryTreeLocation.Explorer
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('time-machine')
    })

    it('should return LocalHistory location when configured', () => {
      mockConfiguration.get.mockImplementation((key: string) => {
        if (key === 'treeLocation') {return 1} // EHistoryTreeLocation.LocalHistory
        return 0
      })
      
      const location = HistorySettings.getTreeLocation()
      expect(location).toBe(1)
    })
  })

  describe('get', () => {
    const testFile = vscode.Uri.file('/workspace/test/file.ts')
    const workspaceFolder = {
      uri: vscode.Uri.file('/workspace'),
      name: 'test-workspace',
      index: 0
    }

    beforeEach(() => {
      vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(workspaceFolder)
    })

    it('should return settings for a file in workspace', () => {
      const settings = historySettings.get(testFile)
      expect(settings).toBeDefined()
      expect(settings.folder).toEqual(workspaceFolder.uri)
      expect(settings.enabled).toBe(true)
      expect(settings.historyPath).toBe('/workspace/.history')
      expect(settings.absolute).toBe(false)
      expect(vscode.workspace.getWorkspaceFolder).toHaveBeenCalledWith(testFile)
    })

    it('should handle files outside workspace', () => {
      vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(undefined)
      
      const settings = historySettings.get(vscode.Uri.file('/outside/file.ts'))
      expect(settings.folder).toBeUndefined()
      expect(settings.enabled).toBe(false) // No history path when outside workspace
    })

    it('should apply default configuration values', () => {
      const settings = historySettings.get(testFile)
      expect(settings.daysLimit).toBe(30)
      expect(settings.saveDelay).toBe(0)
      expect(settings.maxDisplay).toBe(10)
      expect(settings.dateLocale).toBeUndefined()
      expect(settings.exclude).toEqual([
        '**/.history/**',
        '**/.vscode/**',
        '**/node_modules/**',
        '**/typings/**',
        '**/out/**'
      ])
    })
  })

  describe('clear', () => {
    it('should clear all cached settings', () => {
      const testFile = vscode.Uri.file('/workspace/file.ts')
      vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue({
        uri: vscode.Uri.file('/workspace'),
        name: 'test',
        index: 0
      })

      // Create some cached settings
      historySettings.get(testFile)
      expect(historySettings['settings']).toHaveLength(1)

      // Clear cache
      historySettings.clear()
      expect(historySettings['settings']).toHaveLength(0)
    })
  })

  describe('edge cases and error handling', () => {
    // Comprehensive helper functions for test configurations
    const createConfig = (overrides: any = {}) => ({
      get: vi.fn((key: string) => {
        const defaults = {
          enabled: 1,
          exclude: ['**/.history/**'],
          path: '',
          absolute: true
        }
        return overrides[key] !== undefined ? overrides[key] : defaults[key] || []
      })
    })

    const setupMockEnvironment = (options: {
      workspaceFolders?: any[],
      workspaceFolderReturn?: any,
      fileUri?: string,
      config?: any,
      setupWarning?: boolean
    } = {}) => {
      const fileUri = vscode.Uri.file(options.fileUri || '/workspace/test.ts')
      
      if (options.setupWarning) {
        vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined)
      }
      
      if (options.workspaceFolders) {
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          value: options.workspaceFolders,
          configurable: true
        })
      }
      
      if (options.workspaceFolderReturn !== undefined) {
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(options.workspaceFolderReturn)
      }
      
      if (options.config) {
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(options.config)
      }
      
      return fileUri
    }

    // Test cases for invalid configuration validation
    test.each([
      {
        name: 'invalid enabled setting type',
        enabled: true, // boolean instead of number
        exclude: ['**/.history/**'],
        expectedMessage: 'Change setting: time-machine.enabled must be a number'
      },
      {
        name: 'invalid exclude setting type', 
        enabled: 1,
        exclude: '**/.history/**', // string instead of array
        expectedMessage: 'Change setting: time-machine.exclude must be an array'
      },
      {
        name: 'both invalid enabled and exclude settings',
        enabled: true, // boolean instead of number
        exclude: '**/.history/**', // string instead of array
        expectedMessage: 'Change setting: time-machine.enabled must be a number, time-machine.exclude must be an array'
      }
    ])('should handle $name', ({ enabled, exclude, expectedMessage }) => {
      const fileUri = setupMockEnvironment({ setupWarning: true })
      
      const config = createConfig({ enabled, exclude })
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as any)
      
      historySettings.get(fileUri)
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expectedMessage,
        {},
        { title: 'Settings', isCloseAffordance: false, id: 0 }
      )
    })

    it('should open settings when user clicks Settings button', async () => {
      const fileUri = setupMockEnvironment({ setupWarning: true })
      
      const config = createConfig({ enabled: true })
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as any)
      
      // Mock user clicking Settings button
      vi.mocked(vscode.window.showWarningMessage).mockResolvedValue({ title: 'Settings', id: 0 } as any)
      
      historySettings.get(fileUri)
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.openGlobalSettings')
    })

    // Test cases for path variable replacement
    test.each([
      {
        name: 'environment variable replacement in path',
        pathValue: '%TEST_VAR%/history',
        setupEnv: () => process.env.TEST_VAR = '/test/path',
        cleanupEnv: () => delete process.env.TEST_VAR,
        expectedContains: '/test/path/history'
      },
      {
        name: 'home directory replacement in path',
        pathValue: '~/history',
        setupEnv: () => {},
        cleanupEnv: () => {},
        expectedMatches: /^\/.*\/history/
      }
    ])('should handle $name', ({ pathValue, setupEnv, cleanupEnv, expectedContains, expectedMatches }) => {
      const fileUri = setupMockEnvironment()
      
      setupEnv()
      
      const config = createConfig({ path: pathValue, absolute: true })
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as any)
      
      const result = historySettings.get(fileUri)
      
      if (expectedContains) {
        expect(result.historyPath).toContain(expectedContains)
      }
      if (expectedMatches) {
        expect(result.historyPath).toMatch(expectedMatches)
      }
      
      cleanupEnv()
    })

    // Test cases for workspaceFolder variable handling
    test.each([
      {
        name: 'workspaceFolder variable in path',
        workspaceFolders: [{ uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 }],
        workspaceFolderReturn: { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 },
        pathValue: '${workspaceFolder}/custom-history',
        expectedContains: '/workspace/custom-history'
      },
      {
        name: 'workspaceFolder with index in path',
        workspaceFolders: [
          { index: 0, uri: vscode.Uri.file('/workspace1'), name: 'workspace1' },
          { index: 1, uri: vscode.Uri.file('/workspace2'), name: 'workspace2' }
        ],
        pathValue: '${workspaceFolder: 1}/custom-history',
        expectedContains: '/workspace2/custom-history'
      },
      {
        name: 'workspaceFolder with name in path',
        workspaceFolders: [
          { name: 'project1', uri: vscode.Uri.file('/workspace1'), index: 0 },
          { name: 'project2', uri: vscode.Uri.file('/workspace2'), index: 1 }
        ],
        pathValue: '${workspaceFolder: project2}/custom-history',
        expectedContains: '/workspace2/custom-history'
      }
    ])('should handle $name', ({ workspaceFolders, workspaceFolderReturn, pathValue, expectedContains }) => {
      const fileUri = vscode.Uri.file('/workspace/test.ts')
      
      // Setup workspace environment
      if (workspaceFolders) {
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          value: workspaceFolders,
          configurable: true
        })
      }
      
      if (workspaceFolderReturn !== undefined) {
        vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(workspaceFolderReturn)
      }
      
      const config = createConfig({ path: pathValue, absolute: true, enabled: 1 })
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as any)
      
      const result = historySettings.get(fileUri)
      
      expect(result.historyPath).toContain(expectedContains)
    })

    // Test cases for error conditions
    test.each([
      {
        name: 'workspaceFolder not at start of path',
        workspaceFolders: [],
        pathValue: '/some/path/${workspaceFolder}/history',
        expectError: 'showErrorMessage',
        expectedMessage: '${workspaceFolder} must starts settings'
      },
      {
        name: 'workspaceFolder not found by name',
        workspaceFolders: [],
        pathValue: '${workspaceFolder: nonexistent}/history',
        expectError: 'showErrorMessage',
        expectedMessage: 'workspaceFolder not found'
      }
    ])('should show error when $name', ({ workspaceFolders, pathValue, expectError, expectedMessage }) => {
      const fileUri = vscode.Uri.file('/workspace/test.ts')
      
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: workspaceFolders,
        configurable: true
      })
      
      const config = createConfig({ path: pathValue, enabled: 1 })
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as any)
      
      historySettings.get(fileUri)
      
      if (expectError === 'showErrorMessage') {
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
          expect.stringContaining(expectedMessage)
        )
      }
    })

    // Test cases for different enabled states and configurations
    test.each([
      {
        name: 'enabled Never case',
        configValues: { enabled: 0 }, // Never
        expectedEnabled: false,
        expectedHistoryPath: null
      },
      {
        name: 'relative path with workspaceFolder',
        configValues: { enabled: 1, path: '/custom/path', absolute: false },
        setupMocks: () => {
          const mockWorkspaceFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 }
          vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(mockWorkspaceFolder)
        },
        expectedAbsolute: false,
        expectedHistoryPath: '/custom/path/.history/workspace'
      },
      {
        name: 'files outside workspace',
        fileUri: '/outside/test.ts',
        configValues: { enabled: 1, exclude: [] },
        setupMocks: () => {
          vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(null)
        },
        expectedFolder: undefined
      }
    ])('should handle $name', ({ 
      configValues, 
      setupMocks, 
      expectedEnabled, 
      expectedHistoryPath, 
      expectedAbsolute,
      expectedFolder,
      fileUri: customFileUri 
    }) => {
      const fileUri = vscode.Uri.file(customFileUri || '/workspace/test.ts')
      
      if (setupMocks) {setupMocks()}
      
      const config = {
        get: vi.fn((key: string) => {
          return configValues[key] !== undefined ? configValues[key] : undefined
        })
      }
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as any)
      
      const result = historySettings.get(fileUri)
      
      if (expectedEnabled !== undefined) {expect(result.enabled).toBe(expectedEnabled)}
      if (expectedHistoryPath !== undefined) {expect(result.historyPath).toBe(expectedHistoryPath)}
      if (expectedAbsolute !== undefined) {expect(result.absolute).toBe(expectedAbsolute)}
      if (expectedFolder !== undefined) {expect(result.folder).toBe(expectedFolder)}
    })
  })

  describe('cache behavior', () => {
    it('should retrieve cached settings when same folder is accessed again', () => {
      const fileUri = vscode.Uri.file('/workspace/test.ts')
      const workspaceFolder = {
        uri: vscode.Uri.file('/workspace'),
        name: 'test-workspace',
        index: 0
      }
      
      vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(workspaceFolder)
      
      // First call should create cache
      const firstResult = historySettings.get(fileUri)
      
      // Second call should retrieve from cache (covers lines 66-70)
      const secondResult = historySettings.get(fileUri)
      
      expect(firstResult).toBe(secondResult)
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledTimes(1) // Should only be called once due to caching
    })

    it('should handle files with no workspace folder in cache', () => {
      const fileUri = vscode.Uri.file('/outside/test.ts')
      
      vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(null)
      
      const config = {
        get: vi.fn((key: string) => {
          if (key === 'enabled') {return 0} // Never
          if (key === 'exclude') {return []}
          return undefined
        })
      }
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as any)
      
      // First call
      const firstResult = historySettings.get(fileUri)
      
      // Second call should retrieve from cache (covers cache logic for no folder)
      const secondResult = historySettings.get(fileUri)
      
      expect(firstResult).toBe(secondResult)
      expect(firstResult.folder).toBeUndefined()
    })
  })

  describe('pathIsInside', () => {
    it('should use is-path-inside library', () => {
      const historySettingsInstance = new HistorySettings()
      
      // Access private method for testing
      const pathIsInside = (historySettingsInstance as any).pathIsInside
      
      // Mock the require call
      const mockIsPathInside = vi.fn().mockReturnValue(true)
      vi.doMock('is-path-inside', () => mockIsPathInside)
      
      const result = pathIsInside('/test/child', '/test')
      
      expect(result).toBe(true)
    })
  })

  describe('workspace path resolution with pathIsInside', () => {
    it('should include workspace basename when workspace is not inside history workspace', () => {
      const fileUri = vscode.Uri.file('/current-workspace/test.ts')
      const currentWorkspaceFolder = { 
        uri: vscode.Uri.file('/current-workspace'),
        name: 'current',
        index: 0
      }
      const historyWorkspaceFolder = { 
        uri: vscode.Uri.file('/history-workspace'),
        name: 'history',
        index: 1
      }
      
      vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(currentWorkspaceFolder)
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [currentWorkspaceFolder, historyWorkspaceFolder],
        configurable: true
      })
      
      const config = {
        get: vi.fn((key: string) => {
          if (key === 'enabled') {return 1}
          if (key === 'path') {return '${workspaceFolder: history}/custom-path'}
          if (key === 'absolute') {return false}
          return []
        })
      }
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as any)
      
      const historySettingsInstance = new HistorySettings()
      const pathIsInsideSpy = vi.spyOn(historySettingsInstance as any, 'pathIsInside').mockReturnValue(false)
      
      const result = historySettingsInstance.get(fileUri)
      
      expect(pathIsInsideSpy).toHaveBeenCalledWith('/current-workspace', '/history-workspace')
      expect(result.historyPath).toContain('current-workspace') // basename included
      
      pathIsInsideSpy.mockRestore()
    })

    it('should exclude workspace basename when workspace is inside history workspace', () => {
      const fileUri = vscode.Uri.file('/current-workspace/test.ts')
      const currentWorkspaceFolder = { 
        uri: vscode.Uri.file('/current-workspace'),
        name: 'current',
        index: 0
      }
      const historyWorkspaceFolder = { 
        uri: vscode.Uri.file('/history-workspace'),
        name: 'history',
        index: 1
      }
      
      vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(currentWorkspaceFolder)
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [currentWorkspaceFolder, historyWorkspaceFolder],
        configurable: true
      })
      
      const config = {
        get: vi.fn((key: string) => {
          if (key === 'enabled') {return 1}
          if (key === 'path') {return '${workspaceFolder: history}/custom-path'}
          if (key === 'absolute') {return false}
          return []
        })
      }
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config as any)
      
      const historySettingsInstance = new HistorySettings()
      const pathIsInsideSpy = vi.spyOn(historySettingsInstance as any, 'pathIsInside').mockReturnValue(true)
      
      const result = historySettingsInstance.get(fileUri)
      
      expect(pathIsInsideSpy).toHaveBeenCalledWith('/current-workspace', '/history-workspace')
      expect(result.historyPath).not.toContain('current-workspace') // basename excluded
      expect(result.historyPath).toContain('.history')
      
      pathIsInsideSpy.mockRestore()
    })
  })
})

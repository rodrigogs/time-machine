import { describe, it, expect, vi, beforeEach, afterEach, test } from 'vitest'

// Mock dependencies before any imports that might use them
vi.mock('glob')
vi.mock('rimraf')
vi.mock('./history.settings')

import { HistoryController, IHistoryFileProperties } from './history.controller'
import { HistorySettings, IHistorySettings } from './history.settings'
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { glob } from 'glob'
import { rimraf } from 'rimraf'

describe('HistoryController', () => {
  let historyController: HistoryController
  let mockHistorySettings: any
  let mockSettings: IHistorySettings

  // Helper functions
  const createMockSettings = (overrides: Partial<IHistorySettings> = {}): IHistorySettings => ({
    folder: { fsPath: '/workspace' } as any,
    enabled: true,
    historyPath: '/workspace/.history',
    exclude: ['**/.history/**', '**/node_modules/**'],
    daysLimit: 30,
    saveDelay: 0,
    maxDisplay: 10,
    absolute: false,
    dateLocale: undefined,
    ...overrides
  })

  const createTestDocument = (overrides: any = {}) => ({
    uri: { fsPath: '/workspace/test.ts' },
    fileName: '/workspace/test.ts',
    getText: vi.fn(() => 'test file content'),
    isDirty: true,
    ...overrides
  })

  // Mock setup
  const setupMocks = () => {
    mockSettings = createMockSettings()
    mockHistorySettings = { get: vi.fn().mockReturnValue(mockSettings), clear: vi.fn() }
    vi.mocked(HistorySettings).mockImplementation(() => mockHistorySettings)
    
    Object.assign(vi.mocked(fs), {
      existsSync: vi.fn().mockReturnValue(true),
      statSync: vi.fn().mockReturnValue({
        isFile: () => true,
        mtime: new Date(),
        birthtime: new Date(),
        size: 1024
      }),
      mkdirSync: vi.fn(),
      copyFile: vi.fn((src: any, dest: any, callback: any) => setTimeout(() => callback?.(null), 0)),
      unlink: vi.fn((path: any, callback: any) => setTimeout(() => callback?.(null), 0)),
      readFileSync: vi.fn().mockReturnValue('file content'),
      writeFileSync: vi.fn()
    })
    
    vi.mocked(vscode.workspace.asRelativePath).mockImplementation((pathOrUri: any) => {
      const path = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath
      return path?.replace('/workspace/', '') || pathOrUri
    })
    
    Object.assign(vi.mocked(path), {
      dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
      basename: vi.fn((p: string) => p.split('/').pop() || ''),
      parse: vi.fn((p: string) => {
        const base = path.basename(p)
        const ext = path.extname(p)
        return { dir: path.dirname(p), root: '/', base, name: base.replace(ext, ''), ext }
      }),
      join: vi.fn((...args: string[]) => args.join('/')),
      relative: vi.fn((from: string, to: string) => to.replace(from + '/', ''))
    })
    
    vi.mocked(glob).mockResolvedValue(['/workspace/.history/file_20241201_120000.ts'])
    vi.mocked(rimraf).mockResolvedValue(true)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
    historyController = new HistoryController()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('basic functionality', () => {
    it('should create a new HistoryController instance', () => {
      expect(historyController).toBeInstanceOf(HistoryController)
      expect(HistorySettings).toHaveBeenCalled()
    })

    it('should delegate getSettings to HistorySettings.get', () => {
      const fileUri = vscode.Uri.file('/workspace/test.ts')
      const result = historyController.getSettings(fileUri)
      
      expect(mockHistorySettings.get).toHaveBeenCalledWith(fileUri)
      expect(result).toBe(mockSettings)
    })
  })

  describe('decodeFile', () => {
    // Test cases for file path decoding
    test.each([
      {
        name: 'valid history file path',
        input: '/workspace/.history/test_20241201120000.ts',
        expected: { name: 'test', ext: '.ts', hasDate: true }
      },
      {
        name: 'file with multiple dots in name',
        input: '/workspace/.history/test.config_20241201120000.js',
        expected: { name: 'test.config', ext: '.js', hasDate: true }
      },
      {
        name: 'non-history file path',
        input: '/workspace/invalid_file.ts',
        expected: { name: 'invalid_file', ext: '.ts', hasDate: false }
      },
      {
        name: 'file with no extension',
        input: '/workspace/.history/README_20241201120000',
        expected: { name: 'README', ext: '', hasDate: true }
      },
      {
        name: 'file with special characters',
        input: '/workspace/.history/test-file@2024#1.spec_20241201120000.ts',
        expected: { name: 'test-file@2024#1.spec', ext: '.ts', hasDate: true }
      },
      {
        name: 'malformed history file name',
        input: '/workspace/.history/invalid_filename.ts',
        expected: null
      }
    ])('should handle $name', ({ input, expected }) => {
      const result = historyController.decodeFile(input, mockSettings)
      
      if (expected === null) {
        expect(result).toBeNull()
        return
      }
      
      expect(result).toBeDefined()
      expect(result?.name).toBe(expected.name)
      expect(result?.ext).toBe(expected.ext)
      expect(result?.file).toBe(input)
      
      if (expected.hasDate) {
        expect(result?.date).toBeInstanceOf(Date)
      } else {
        expect(result?.date).toBeUndefined()
      }
    })

    it('should parse date correctly from filename', () => {
      const historyFilePath = '/workspace/.history/test_20241225143000.ts'
      const result = historyController.decodeFile(historyFilePath, mockSettings)
      
      expect(result?.date.getFullYear()).toBe(2024)
      expect(result?.date.getMonth()).toBe(11) // December (0-based)
      expect(result?.date.getDate()).toBe(25)
      expect(result?.date.getHours()).toBe(14)
      expect(result?.date.getMinutes()).toBe(30)
    })
  })

  describe('saveRevision', () => {
    // Test cases for different save scenarios
    test.each([
      {
        name: 'should save when enabled and handle errors',
        settings: { enabled: true },
        expectGetCall: true,
        shouldThrow: true
      },
      {
        name: 'should not save when disabled',
        settings: { enabled: false },
        expectGetCall: true,
        shouldThrow: false
      },
      {
        name: 'should handle save delay configuration',
        settings: { enabled: true, saveDelay: 1 },
        expectGetCall: true,
        shouldThrow: true
      }
    ])('$name', async ({ settings, expectGetCall, shouldThrow }) => {
      const testDocument = createTestDocument()
      mockSettings = createMockSettings(settings)
      mockHistorySettings.get.mockReturnValue(mockSettings)
      
      if (!settings.enabled) {
        const result = await historyController.saveRevision(testDocument as any)
        expect(result).toBeUndefined()
        expect(mockHistorySettings.get).toHaveBeenCalledWith(testDocument.uri)
        return
      }
      
      if (shouldThrow) {
        await expect(historyController.saveRevision(testDocument as any)).rejects.toBe('Error occured')
      }
      
      if (expectGetCall) {
        expect(mockHistorySettings.get).toHaveBeenCalledWith(testDocument.uri)
      }
    })

    it('should create directory structure when needed', async () => {
      const testDocument = createTestDocument()
      const mkDirSpy = vi.spyOn(historyController as any, 'mkDirRecursive').mockReturnValue(false)
      
      await expect(historyController.saveRevision(testDocument as any)).rejects.toBe('Error occured')
      expect(mkDirSpy).toHaveBeenCalled()
    })
  })

  describe('file operations', () => {
    // Test cases for various file operations
    test.each([
      {
        name: 'findGlobalHistory should find matching files',
        operation: async () => {
          const result = await historyController.findGlobalHistory('**/*.ts', false, mockSettings, false)
          expect(glob).toHaveBeenCalledWith(
            expect.stringContaining('**/*.ts'),
            expect.objectContaining({ cwd: mockSettings.historyPath, absolute: true })
          )
          expect(result).toEqual(['/workspace/.history/file_20241201_120000.ts'])
        }
      },
      {
        name: 'findGlobalHistory should handle multiple results',
        operation: async () => {
          vi.mocked(glob).mockResolvedValueOnce([
            '/workspace/.history/file1_20241201_120000.ts',
            '/workspace/.history/file2_20241201_120100.ts'
          ])
          const result = await historyController.findGlobalHistory('**/*.ts', false, mockSettings, false)
          expect(result).toHaveLength(2)
        }
      },
      {
        name: 'deleteFile should handle single file deletion',
        operation: async () => {
          await expect(historyController.deleteFile('/workspace/.history/test.ts')).resolves.toBeUndefined()
        }
      },
      {
        name: 'deleteFiles should handle multiple file deletion',
        operation: async () => {
          await expect(historyController.deleteFiles(['/workspace/.history/file1.ts', '/workspace/.history/file2.ts'])).resolves.toBeUndefined()
        }
      },
      {
        name: 'deleteAll should remove entire history directory',
        operation: async () => {
          await historyController.deleteAll('/workspace/.history')
          expect(rimraf).toHaveBeenCalledWith('/workspace/.history')
        }
      }
    ])('$name', async ({ operation }) => {
      await operation()
    })

    // Test cases for compare and restore operations
    test.each([
      {
        name: 'compare should execute diff command',
        operation: () => {
          const file1 = vscode.Uri.file('/workspace/file1.ts')
          const file2 = vscode.Uri.file('/workspace/file2.ts')
          historyController.compare(file1, file2)
          expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'vscode.diff', file1, file2, 'file1.ts<->file2.ts', { selection: undefined }
          )
        }
      },
      {
        name: 'compare should handle range selection',
        operation: () => {
          const file1 = vscode.Uri.file('/workspace/file1.ts')
          const file2 = vscode.Uri.file('/workspace/file2.ts')
          const range = new vscode.Range(0, 0, 10, 0)
          historyController.compare(file1, file2, '2', range)
          expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'vscode.diff', file1, file2, 'file1.ts<->file2.ts', { selection: range, viewColumn: 2 }
          )
        }
      },
      {
        name: 'restore should handle malformed file paths',
        operation: async () => {
          const result = await historyController.restore(vscode.Uri.file('/workspace/.history/invalid.ts'))
          expect(result).toBeUndefined()
        }
      }
    ])('$name', async ({ operation }) => {
      await operation()
    })
  })

  describe('showAll', () => {
    it('should call internalShowAll with actionOpen when editor and document are valid', () => {
      const mockEditor = {
        document: createTestDocument(),
        viewColumn: vscode.ViewColumn.One
      } as any
      
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      const actionOpenSpy = vi.spyOn(historyController as any, 'actionOpen')
      
      historyController.showAll(mockEditor)
      
      expect(internalShowAllSpy).toHaveBeenCalledWith(
        expect.any(Function), // actionOpen function
        mockEditor,
        mockSettings
      )
      expect(mockHistorySettings.get).toHaveBeenCalledWith(mockEditor.document.uri)
    })

    it('should not call internalShowAll when editor is null', () => {
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      
      historyController.showAll(null as any)
      
      expect(internalShowAllSpy).not.toHaveBeenCalled()
    })

    it('should not call internalShowAll when editor.document is null', () => {
      const mockEditor = { document: null } as any
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      
      historyController.showAll(mockEditor)
      
      expect(internalShowAllSpy).not.toHaveBeenCalled()
    })
  })

  describe('showCurrent', () => {
    it('should call internalOpen with findCurrent result when editor and document are valid', () => {
      const mockEditor = {
        document: createTestDocument(),
        viewColumn: vscode.ViewColumn.One
      } as any
      
      const expectedUri = vscode.Uri.file('/workspace/current.ts')
      const findCurrentSpy = vi.spyOn(historyController as any, 'findCurrent').mockReturnValue(expectedUri)
      const internalOpenSpy = vi.spyOn(historyController as any, 'internalOpen').mockImplementation(() => {})
      
      historyController.showCurrent(mockEditor)
      
      expect(findCurrentSpy).toHaveBeenCalledWith(
        mockEditor.document.fileName,
        mockSettings
      )
      expect(internalOpenSpy).toHaveBeenCalledWith(expectedUri, mockEditor.viewColumn)
      expect(mockHistorySettings.get).toHaveBeenCalledWith(mockEditor.document.uri)
    })

    it('should not call internalOpen when editor is null', () => {
      const internalOpenSpy = vi.spyOn(historyController as any, 'internalOpen').mockImplementation(() => {})
      
      const result = historyController.showCurrent(null as any)
      
      expect(internalOpenSpy).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should not call internalOpen when editor.document is null', () => {
      const mockEditor = { document: null } as any
      const internalOpenSpy = vi.spyOn(historyController as any, 'internalOpen').mockImplementation(() => {})
      
      const result = historyController.showCurrent(mockEditor)
      
      expect(internalOpenSpy).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })
  })

  describe('compareToActive', () => {
    it('should call internalShowAll with actionCompareToActive when editor and document are valid', () => {
      const mockEditor = {
        document: createTestDocument(),
        viewColumn: vscode.ViewColumn.One
      } as any
      
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      const actionCompareToActiveSpy = vi.spyOn(historyController as any, 'actionCompareToActive')
      
      historyController.compareToActive(mockEditor)
      
      expect(internalShowAllSpy).toHaveBeenCalledWith(
        actionCompareToActiveSpy,
        mockEditor,
        mockSettings
      )
      expect(mockHistorySettings.get).toHaveBeenCalledWith(mockEditor.document.uri)
    })

    it('should not call internalShowAll when editor is null', () => {
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      
      const result = historyController.compareToActive(null as any)
      
      expect(internalShowAllSpy).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should not call internalShowAll when editor.document is null', () => {
      const mockEditor = { document: null } as any
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      
      const result = historyController.compareToActive(mockEditor)
      
      expect(internalShowAllSpy).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })
  })

  describe('compareToCurrent', () => {
    it('should call internalShowAll with actionCompareToCurrent when editor and document are valid', () => {
      const mockEditor = {
        document: createTestDocument(),
        viewColumn: vscode.ViewColumn.One
      } as any
      
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      const actionCompareToCurrentSpy = vi.spyOn(historyController as any, 'actionCompareToCurrent')
      
      historyController.compareToCurrent(mockEditor)
      
      expect(internalShowAllSpy).toHaveBeenCalledWith(
        actionCompareToCurrentSpy,
        mockEditor,
        mockSettings
      )
      expect(mockHistorySettings.get).toHaveBeenCalledWith(mockEditor.document.uri)
    })

    it('should not call internalShowAll when editor is null', () => {
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      
      const result = historyController.compareToCurrent(null as any)
      
      expect(internalShowAllSpy).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should not call internalShowAll when editor.document is null', () => {
      const mockEditor = { document: null } as any
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      
      const result = historyController.compareToCurrent(mockEditor)
      
      expect(internalShowAllSpy).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })
  })

  describe('compareToPrevious', () => {
    it('should call internalShowAll with actionCompareToPrevious when editor and document are valid', () => {
      const mockEditor = {
        document: createTestDocument(),
        viewColumn: vscode.ViewColumn.One
      } as any
      
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      const actionCompareToPreviousSpy = vi.spyOn(historyController as any, 'actionCompareToPrevious')
      
      historyController.compareToPrevious(mockEditor)
      
      expect(internalShowAllSpy).toHaveBeenCalledWith(
        actionCompareToPreviousSpy,
        mockEditor,
        mockSettings
      )
      expect(mockHistorySettings.get).toHaveBeenCalledWith(mockEditor.document.uri)
    })

    it('should not call internalShowAll when editor is null', () => {
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      
      const result = historyController.compareToPrevious(null as any)
      
      expect(internalShowAllSpy).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should not call internalShowAll when editor.document is null', () => {
      const mockEditor = { document: null } as any
      const internalShowAllSpy = vi.spyOn(historyController as any, 'internalShowAll').mockImplementation(() => {})
      
      const result = historyController.compareToPrevious(mockEditor)
      
      expect(internalShowAllSpy).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })
  })

  describe('compare', () => {
    it('should delegate to internalCompare with all parameters', () => {
      const file1 = vscode.Uri.file('/workspace/file1.ts')
      const file2 = vscode.Uri.file('/workspace/file2.ts')
      const column = 'beside'
      const range = new vscode.Range(0, 0, 1, 10)
      
      const internalCompareSpy = vi.spyOn(historyController as any, 'internalCompare').mockReturnValue(Promise.resolve())
      
      const result = historyController.compare(file1, file2, column, range)
      
      expect(internalCompareSpy).toHaveBeenCalledWith(file1, file2, column, range)
      expect(result).toBeInstanceOf(Promise)
    })

    it('should delegate to internalCompare with minimal parameters', () => {
      const file1 = vscode.Uri.file('/workspace/file1.ts')
      const file2 = vscode.Uri.file('/workspace/file2.ts')
      
      const internalCompareSpy = vi.spyOn(historyController as any, 'internalCompare').mockReturnValue(Promise.resolve())
      
      const result = historyController.compare(file1, file2)
      
      expect(internalCompareSpy).toHaveBeenCalledWith(file1, file2, undefined, undefined)
      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('findAllHistory', () => {
    it('should resolve undefined when settings.enabled is false', async () => {
      const disabledSettings = { ...mockSettings, enabled: false }
      
      const result = await historyController.findAllHistory('/workspace/test.ts', disabledSettings)
      
      expect(result).toBeUndefined()
    })

    it('should resolve with history when settings.enabled is true', async () => {
      const fileName = '/workspace/test.ts'
      const historyFiles = ['file1.ts', 'file2.ts']
      const mockFileProperties = { file: 'test.ts' }
      
      const decodeFileSpy = vi.spyOn(historyController as any, 'decodeFile').mockReturnValue(mockFileProperties)
      const getHistoryFilesSpy = vi.spyOn(historyController as any, 'getHistoryFiles').mockResolvedValue(historyFiles)
      
      const result = await historyController.findAllHistory(fileName, mockSettings)
      
      expect(decodeFileSpy).toHaveBeenCalledWith(fileName, mockSettings, true)
      expect(getHistoryFilesSpy).toHaveBeenCalledWith(mockFileProperties.file, mockSettings, undefined)
      expect(result).toEqual({ ...mockFileProperties, history: historyFiles })
    })

    it('should handle error from getHistoryFiles', async () => {
      const fileName = '/workspace/test.ts'
      const mockFileProperties = { file: 'test.ts' }
      const error = new Error('Failed to get history files')
      
      vi.spyOn(historyController as any, 'decodeFile').mockReturnValue(mockFileProperties)
      vi.spyOn(historyController as any, 'getHistoryFiles').mockRejectedValue(error)
      
      await expect(historyController.findAllHistory(fileName, mockSettings)).rejects.toThrow('Failed to get history files')
    })
  })

  describe('findGlobalHistory', () => {
    it('should resolve empty array when settings.enabled is false', async () => {
      const disabledSettings = { ...mockSettings, enabled: false }
      
      const result = await historyController.findGlobalHistory('/workspace/test.ts', false, disabledSettings)
      
      expect(result).toEqual([])
    })

    it('should use findAllHistory when findFile is true', async () => {
      const find = '/workspace/test.ts'
      const mockFileProperties = { history: ['file1.ts', 'file2.ts'] }
      
      const findAllHistorySpy = vi.spyOn(historyController, 'findAllHistory').mockResolvedValue(mockFileProperties as any)
      
      const result = await historyController.findGlobalHistory(find, true, mockSettings)
      
      expect(findAllHistorySpy).toHaveBeenCalledWith(find, mockSettings, undefined)
      expect(result).toEqual(mockFileProperties.history)
    })

    it('should use getHistoryFiles when findFile is false', async () => {
      const find = '/workspace/test.ts'
      const historyFiles = ['file1.ts', 'file2.ts']
      
      const getHistoryFilesSpy = vi.spyOn(historyController as any, 'getHistoryFiles').mockResolvedValue(historyFiles)
      
      const result = await historyController.findGlobalHistory(find, false, mockSettings)
      
      expect(getHistoryFilesSpy).toHaveBeenCalledWith(find, mockSettings, undefined)
      expect(result).toEqual(historyFiles)
    })

    it('should handle error from getHistoryFiles when findFile is false', async () => {
      const find = '/workspace/test.ts'
      const error = new Error('Failed to get history files')
      
      vi.spyOn(historyController as any, 'getHistoryFiles').mockRejectedValue(error)
      
      await expect(historyController.findGlobalHistory(find, false, mockSettings)).rejects.toThrow('Failed to get history files')
    })

    it('should pass noLimit parameter correctly', async () => {
      const find = '/workspace/test.ts'
      const getHistoryFilesSpy = vi.spyOn(historyController as any, 'getHistoryFiles').mockResolvedValue([])
      
      await historyController.findGlobalHistory(find, false, mockSettings, true)
      
      expect(getHistoryFilesSpy).toHaveBeenCalledWith(find, mockSettings, true)
    })
  })
})

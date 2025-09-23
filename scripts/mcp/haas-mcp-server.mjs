#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PROJECT_ROOT = '/Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template';

const server = new Server(
  {
    name: 'haas-mcp-server',
    version: '1.0.0',
    description: 'HAAS Project MCP Server - テスト生成、コード検索、ビルド管理'
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ツールリスト
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'generate_test',
        description: 'ファイルのテストを生成する',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'テスト対象ファイルのパス（例: app/api/attendance/punch/route.ts）',
            },
            testType: {
              type: 'string',
              enum: ['unit', 'integration', 'e2e'],
              description: 'テストタイプ',
            },
          },
          required: ['filePath', 'testType'],
        },
      },
      {
        name: 'search_code',
        description: 'HAASプロジェクト内のコードを検索',
        inputSchema: {
          type: 'object',
          properties: {
            searchType: {
              type: 'string',
              enum: ['gps', 'qr', 'skills', 'line', 'attendance', 'shift'],
              description: '検索カテゴリ',
            },
            keyword: {
              type: 'string',
              description: '追加の検索キーワード（オプション）',
            },
          },
          required: ['searchType'],
        },
      },
      {
        name: 'run_command',
        description: '開発コマンドを実行',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              enum: ['dev', 'build', 'test', 'lint', 'typecheck'],
              description: '実行するコマンド',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'check_status',
        description: 'プロジェクトの状態を確認',
        inputSchema: {
          type: 'object',
          properties: {
            check: {
              type: 'string',
              enum: ['tests', 'types', 'build', 'coverage'],
              description: '確認項目',
            },
          },
          required: ['check'],
        },
      },
    ],
  };
});

// ツール実行ハンドラ
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'generate_test':
        return await generateTest(args.filePath, args.testType);

      case 'search_code':
        return await searchCode(args.searchType, args.keyword);

      case 'run_command':
        return await runCommand(args.command);

      case 'check_status':
        return await checkStatus(args.check);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `エラーが発生しました: ${error.message}`,
        },
      ],
    };
  }
});

// テスト生成
async function generateTest(filePath, testType) {
  const fullPath = path.join(PROJECT_ROOT, filePath);

  try {
    const fileContent = await fs.readFile(fullPath, 'utf-8');

    // ファイルタイプを判定
    const isComponent = filePath.includes('/components/') || filePath.includes('.tsx');
    const isAPI = filePath.includes('/api/');
    const isUtil = filePath.includes('/lib/') || filePath.includes('/utils/');

    let testTemplate = '';

    if (testType === 'unit') {
      if (isComponent) {
        testTemplate = `import { render, screen } from '@testing-library/react';
import { ${path.basename(filePath, '.tsx')} } from '${filePath.replace('.tsx', '')}';

describe('${path.basename(filePath, '.tsx')}', () => {
  it('should render without crashing', () => {
    render(<${path.basename(filePath, '.tsx')} />);
    // Add assertions here
  });

  it('should display expected content', () => {
    render(<${path.basename(filePath, '.tsx')} />);
    // Add content checks
  });
});`;
      } else if (isAPI) {
        testTemplate = `import { POST, GET } from '${filePath.replace('.ts', '')}';
import { NextRequest } from 'next/server';

describe('${path.basename(filePath, '.ts')} API', () => {
  it('should handle GET request', async () => {
    const request = new NextRequest('http://localhost:3000');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('should handle POST request', async () => {
    const request = new NextRequest('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});`;
      } else {
        testTemplate = `import { functionName } from '${filePath.replace('.ts', '')}';

describe('${path.basename(filePath, '.ts')}', () => {
  it('should work correctly', () => {
    // Add test implementation
    expect(true).toBe(true);
  });
});`;
      }
    } else if (testType === 'integration') {
      testTemplate = `// Integration test for ${filePath}
import { createClient } from '@supabase/supabase-js';

describe('${path.basename(filePath)} Integration', () => {
  it('should integrate with database', async () => {
    // Add integration test
  });

  it('should handle GPS validation (300m radius)', async () => {
    // Test GPS validation logic
  });

  it('should validate QR token', async () => {
    // Test QR token validation
  });
});`;
    } else if (testType === 'e2e') {
      testTemplate = `import { test, expect } from '@playwright/test';

test.describe('${path.basename(filePath)} E2E', () => {
  test('should complete user flow', async ({ page }) => {
    await page.goto('/');
    // Add E2E test steps
  });

  test('should handle GPS-based check-in', async ({ page }) => {
    await page.goto('/attendance');
    // Test GPS check-in flow
  });
});`;
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ ${testType}テストを生成しました:\n\n\`\`\`typescript\n${testTemplate}\n\`\`\`\n\nファイル: ${filePath}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ ファイルが見つかりません: ${filePath}\nエラー: ${error.message}`,
        },
      ],
    };
  }
}

// コード検索
async function searchCode(searchType, keyword) {
  const searchPatterns = {
    gps: 'GPS|location|coordinates|latitude|longitude|ST_Distance|300',
    qr: 'QR|qr_token|token|scanner',
    skills: 'PA|音源再生|照明|バックヤード|skills|skill_type',
    line: 'LINE|webhook|notification|message',
    attendance: 'attendance|punch|checkin|checkout|出勤|退勤',
    shift: 'shift|assignment|assign|schedule',
  };

  const pattern = searchPatterns[searchType];
  const additionalPattern = keyword ? `|${keyword}` : '';

  try {
    const { stdout } = await execAsync(
      `grep -r "${pattern}${additionalPattern}" ${PROJECT_ROOT}/app ${PROJECT_ROOT}/lib --include="*.ts" --include="*.tsx" -l | head -20`,
      { cwd: PROJECT_ROOT }
    );

    const files = stdout.trim().split('\n').filter(Boolean);

    if (files.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `検索結果が見つかりませんでした: ${searchType} ${keyword || ''}`,
          },
        ],
      };
    }

    const results = files.map(file => {
      const relativePath = file.replace(PROJECT_ROOT + '/', '');
      return `📁 ${relativePath}`;
    }).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `🔍 ${searchType}関連のファイル (${files.length}件):\n\n${results}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `検索エラー: ${error.message}`,
        },
      ],
    };
  }
}

// コマンド実行
async function runCommand(command) {
  const commands = {
    dev: 'npm run dev',
    build: 'npm run build',
    test: 'npm test',
    lint: 'npm run lint',
    typecheck: 'npm run type-check',
  };

  const cmd = commands[command];

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: PROJECT_ROOT,
      timeout: 60000 // 60秒タイムアウト
    });

    const output = stdout || stderr;
    const trimmedOutput = output.length > 2000 ? output.substring(0, 2000) + '...' : output;

    return {
      content: [
        {
          type: 'text',
          text: `🚀 コマンド実行: ${cmd}\n\n\`\`\`\n${trimmedOutput}\n\`\`\``,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ コマンド実行エラー: ${cmd}\n\`\`\`\n${error.message}\n\`\`\``,
        },
      ],
    };
  }
}

// ステータスチェック
async function checkStatus(check) {
  try {
    let result = '';

    switch (check) {
      case 'tests': {
        const { stdout } = await execAsync('npm test -- --listTests | wc -l', { cwd: PROJECT_ROOT });
        const testCount = parseInt(stdout.trim());
        result = `📊 テストファイル数: ${testCount}件`;
        break;
      }

      case 'types': {
        try {
          await execAsync('npm run type-check', { cwd: PROJECT_ROOT });
          result = '✅ 型チェック: エラーなし';
        } catch (error) {
          result = `⚠️ 型エラーあり:\n${error.message.substring(0, 500)}`;
        }
        break;
      }

      case 'build': {
        const nextDirExists = await fs.access(path.join(PROJECT_ROOT, '.next')).then(() => true).catch(() => false);
        result = nextDirExists ? '✅ ビルド済み (.next存在)' : '⚠️ 未ビルド (.nextなし)';
        break;
      }

      case 'coverage': {
        try {
          const coverage = await fs.readFile(path.join(PROJECT_ROOT, 'coverage', 'coverage-summary.json'), 'utf-8');
          const data = JSON.parse(coverage);
          const total = data.total;
          result = `📈 カバレッジ:
- Lines: ${total.lines.pct}%
- Functions: ${total.functions.pct}%
- Branches: ${total.branches.pct}%
- Statements: ${total.statements.pct}%`;
        } catch {
          result = '📊 カバレッジデータなし (npm run test:coverage を実行)';
        }
        break;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `ステータスチェックエラー: ${error.message}`,
        },
      ],
    };
  }
}

// サーバー起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HAAS MCP Server started successfully');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
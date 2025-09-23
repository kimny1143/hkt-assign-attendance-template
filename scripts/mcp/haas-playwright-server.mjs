#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const PROJECT_ROOT = '/Users/kimny/Dropbox/_DevProjects/Solid_Staff_Assign_Management/hkt-assign-attendance-template';

const server = new Server(
  {
    name: 'haas-playwright',
    version: '1.0.0',
    description: 'HAAS Playwright E2E テスト実行・管理サーバー'
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
        name: 'run_e2e_test',
        description: 'Playwright E2Eテストを実行',
        inputSchema: {
          type: 'object',
          properties: {
            testFile: {
              type: 'string',
              description: 'テストファイル名（例: basic, auth, punch, staff）。空の場合は全テスト実行',
            },
            browser: {
              type: 'string',
              enum: ['chromium', 'firefox', 'webkit', 'all'],
              description: 'ブラウザタイプ',
              default: 'chromium',
            },
            headed: {
              type: 'boolean',
              description: 'ブラウザを表示するか（デバッグ用）',
              default: false,
            },
          },
        },
      },
      {
        name: 'generate_e2e_test',
        description: 'HAAS用のE2Eテストを生成',
        inputSchema: {
          type: 'object',
          properties: {
            feature: {
              type: 'string',
              enum: ['login', 'gps-checkin', 'qr-scan', 'skill-assignment', 'line-notification', 'shift-management'],
              description: 'テストする機能',
            },
            scenario: {
              type: 'string',
              description: 'テストシナリオの説明',
            },
          },
          required: ['feature'],
        },
      },
      {
        name: 'debug_e2e_test',
        description: 'デバッグモードでE2Eテストを実行',
        inputSchema: {
          type: 'object',
          properties: {
            testFile: {
              type: 'string',
              description: 'デバッグするテストファイル',
            },
          },
          required: ['testFile'],
        },
      },
      {
        name: 'list_e2e_tests',
        description: '利用可能なE2Eテストをリスト表示',
        inputSchema: {
          type: 'object',
          properties: {},
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
      case 'run_e2e_test':
        return await runE2ETest(args);

      case 'generate_e2e_test':
        return await generateE2ETest(args.feature, args.scenario);

      case 'debug_e2e_test':
        return await debugE2ETest(args.testFile);

      case 'list_e2e_tests':
        return await listE2ETests();

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ エラー: ${error.message}`,
        },
      ],
    };
  }
});

// E2Eテスト実行
async function runE2ETest({ testFile, browser = 'chromium', headed = false }) {
  try {
    let command = 'npx playwright test';

    if (testFile) {
      command += ` ${testFile}`;
    }

    if (browser !== 'all') {
      command += ` --project=${browser}`;
    }

    if (headed) {
      command += ' --headed';
    }

    console.error(`Executing: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        CI: 'false',
        PLAYWRIGHT_BASE_URL: 'http://localhost:3000',
      },
      timeout: 120000 // 2分タイムアウト
    });

    const output = stdout || stderr;
    const summary = extractTestSummary(output);

    return {
      content: [
        {
          type: 'text',
          text: `🎭 Playwright E2Eテスト実行結果:\n\n${summary}\n\n詳細:\n\`\`\`\n${output.substring(0, 1500)}\n\`\`\``,
        },
      ],
    };
  } catch (error) {
    // テスト失敗もエラーとして扱われるので、出力を解析
    const output = error.stdout || error.stderr || error.message;
    const summary = extractTestSummary(output);

    return {
      content: [
        {
          type: 'text',
          text: `⚠️ テスト実行完了（失敗あり）:\n\n${summary}\n\n詳細:\n\`\`\`\n${output.substring(0, 1500)}\n\`\`\``,
        },
      ],
    };
  }
}

// E2Eテスト生成
async function generateE2ETest(feature, scenario) {
  const templates = {
    'login': `import { test, expect } from '@playwright/test';

test.describe('ログイン機能', () => {
  test('正常なログインフロー', async ({ page }) => {
    await page.goto('/login');

    // メールアドレス入力
    await page.fill('input[type="email"]', 'test@example.com');

    // パスワード入力
    await page.fill('input[type="password"]', 'password123');

    // ログインボタンクリック
    await page.click('button[type="submit"]');

    // ダッシュボードへのリダイレクトを確認
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('無効な認証情報でのエラー表示', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // エラーメッセージの表示を確認
    await expect(page.locator('.bg-red-100')).toBeVisible();
  });
});`,

    'gps-checkin': `import { test, expect } from '@playwright/test';

test.describe('GPS出勤打刻', () => {
  test('会場から300m以内での出勤打刻', async ({ page, context }) => {
    // GPS位置情報のモック
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 35.6762, longitude: 139.6503 });

    await page.goto('/attendance');

    // QRコードスキャン（モック）
    await page.evaluate(() => {
      window.mockQRCode = 'valid-qr-token-123';
    });

    // 写真撮影ボタンクリック
    await page.click('button:has-text("写真を撮影")');

    // 出勤ボタンクリック
    await page.click('button:has-text("出勤")');

    // 成功メッセージ確認
    await expect(page.locator('text=出勤を記録しました')).toBeVisible();
  });

  test('会場から離れた場所での打刻エラー', async ({ page, context }) => {
    // 会場から500m離れた位置
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 35.6812, longitude: 139.6553 });

    await page.goto('/attendance');

    await page.click('button:has-text("出勤")');

    // エラーメッセージ確認
    await expect(page.locator('text=会場から離れています')).toBeVisible();
  });
});`,

    'qr-scan': `import { test, expect } from '@playwright/test';

test.describe('QRコードスキャン', () => {
  test('有効なQRトークンのスキャン', async ({ page }) => {
    await page.goto('/attendance/scan');

    // QRスキャナーのモック
    await page.evaluate(() => {
      // QRスキャナーコンポーネントに直接値を設定
      const event = new CustomEvent('qr-scanned', {
        detail: { data: 'valid-token-2024-09-23' }
      });
      window.dispatchEvent(event);
    });

    // トークン検証の成功を確認
    await expect(page.locator('text=QRコードが確認されました')).toBeVisible();
  });

  test('期限切れトークンのエラー', async ({ page }) => {
    await page.goto('/attendance/scan');

    await page.evaluate(() => {
      const event = new CustomEvent('qr-scanned', {
        detail: { data: 'expired-token-2024-09-01' }
      });
      window.dispatchEvent(event);
    });

    await expect(page.locator('text=QRコードの有効期限が切れています')).toBeVisible();
  });
});`,

    'skill-assignment': `import { test, expect } from '@playwright/test';

test.describe('4スキル割り当てシステム', () => {
  test('PAスキルのスタッフ割り当て', async ({ page }) => {
    await page.goto('/shifts/assign');

    // シフト選択
    await page.selectOption('select[name="shift"]', 'shift-001');

    // スキルフィルター: PA
    await page.click('input[value="PA"]');

    // 利用可能なスタッフリストを確認
    await expect(page.locator('.staff-list')).toContainText('PAスキル保有者');

    // スタッフを選択して割り当て
    await page.click('input[name="staff-001"]');
    await page.click('button:has-text("割り当て")');

    await expect(page.locator('text=割り当てが完了しました')).toBeVisible();
  });

  test('複数スキル（照明+音源再生）の検索', async ({ page }) => {
    await page.goto('/staff/search');

    // 複数スキル選択
    await page.click('input[value="照明"]');
    await page.click('input[value="音源再生"]');

    await page.click('button:has-text("検索")');

    // 結果確認
    const results = page.locator('.search-results');
    await expect(results).toContainText('照明');
    await expect(results).toContainText('音源再生');
  });
});`,

    'line-notification': `import { test, expect } from '@playwright/test';

test.describe('LINE通知連携', () => {
  test('シフト確認通知の送信', async ({ page }) => {
    await page.goto('/admin/notifications');

    // 通知タイプ選択
    await page.selectOption('select[name="notification-type"]', 'shift-confirmation');

    // 対象シフト選択
    await page.click('input[name="shift-tomorrow"]');

    // 送信ボタンクリック
    await page.click('button:has-text("LINE通知を送信")');

    // 送信確認
    await expect(page.locator('text=通知を送信しました')).toBeVisible();

    // 送信ログ確認
    await expect(page.locator('.notification-log')).toContainText('送信成功');
  });
});`,

    'shift-management': `import { test, expect } from '@playwright/test';

test.describe('シフト管理', () => {
  test('新規シフト作成と公開', async ({ page }) => {
    await page.goto('/admin/shifts');

    await page.click('button:has-text("新規シフト")');

    // シフト情報入力
    await page.fill('input[name="event-name"]', 'テストイベント');
    await page.fill('input[name="date"]', '2024-10-01');
    await page.fill('input[name="start-time"]', '09:00');
    await page.fill('input[name="end-time"]', '18:00');

    // 必要人数設定
    await page.fill('input[name="pa-count"]', '2');
    await page.fill('input[name="lighting-count"]', '1');

    await page.click('button:has-text("作成")');

    // 作成確認
    await expect(page.locator('text=シフトを作成しました')).toBeVisible();
  });

  test('週40時間制限の確認', async ({ page }) => {
    await page.goto('/staff/001/schedule');

    // 週間労働時間の表示確認
    await expect(page.locator('.weekly-hours')).toContainText('現在: 38時間');

    // 40時間超過時の警告
    await page.goto('/shifts/assign');
    await page.click('input[name="staff-001"]'); // 38時間のスタッフ
    await page.selectOption('select[name="shift-hours"]', '5'); // 5時間のシフト

    // 警告メッセージ
    await expect(page.locator('.warning')).toContainText('週40時間を超過します');
  });
});`
  };

  const template = templates[feature] || templates['login'];
  const customScenario = scenario ? `\n\n  // カスタムシナリオ: ${scenario}` : '';

  return {
    content: [
      {
        type: 'text',
        text: `✅ ${feature} のE2Eテストを生成しました:${customScenario}\n\n\`\`\`typescript\n${template}\n\`\`\`\n\n保存先: __tests__/e2e/${feature}.spec.ts`,
      },
    ],
  };
}

// デバッグモードでE2E実行
async function debugE2ETest(testFile) {
  try {
    const command = `npx playwright test ${testFile} --debug`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PWDEBUG: '1',
      },
      timeout: 300000 // 5分（デバッグ用）
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔍 デバッグモードで起動しました:\n\nPlaywright Inspectorが開きます。\nステップ実行でテストをデバッグできます。`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ デバッグ起動エラー: ${error.message}`,
        },
      ],
    };
  }
}

// E2Eテスト一覧
async function listE2ETests() {
  try {
    const testDir = path.join(PROJECT_ROOT, '__tests__/e2e');
    const files = await fs.readdir(testDir);

    const testFiles = files.filter(f => f.endsWith('.spec.ts') || f.endsWith('.spec.js'));

    let fileInfo = [];
    for (const file of testFiles) {
      const content = await fs.readFile(path.join(testDir, file), 'utf-8');
      const testCount = (content.match(/test\(/g) || []).length;
      const isDisabled = file.includes('.disabled');

      fileInfo.push({
        name: file,
        tests: testCount,
        status: isDisabled ? '🔴 無効' : '🟢 有効'
      });
    }

    const list = fileInfo.map(f =>
      `${f.status} ${f.name} (${f.tests}個のテスト)`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `📋 E2Eテストファイル一覧:\n\n${list}\n\n実行例:\n- 全テスト: run_e2e_test()\n- 特定ファイル: run_e2e_test(testFile: "basic")\n- ブラウザ指定: run_e2e_test(browser: "firefox")`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ テストファイル一覧取得エラー: ${error.message}`,
        },
      ],
    };
  }
}

// テスト結果サマリー抽出
function extractTestSummary(output) {
  const lines = output.split('\n');
  const summary = [];

  // パス/失敗の情報を探す
  for (const line of lines) {
    if (line.includes('passed') || line.includes('failed') || line.includes('skipped')) {
      summary.push(line.trim());
    }
  }

  if (summary.length === 0) {
    return '詳細は出力を確認してください';
  }

  return summary.slice(-3).join('\n');
}

// サーバー起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HAAS Playwright MCP Server started successfully');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
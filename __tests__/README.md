# HAAS Testing Guide

このドキュメントでは、HKT Assign & Attendance System (HAAS) のテスト環境とTDD（Test-Driven Development）の実践方法について説明します。

## 📋 目次

- [テスト環境概要](#テスト環境概要)
- [セットアップ手順](#セットアップ手順)
- [テストの実行方法](#テストの実行方法)
- [TDD開発フロー](#tdd開発フロー)
- [テストの種類と構造](#テストの種類と構造)
- [カバレッジ要件](#カバレッジ要件)
- [トラブルシューティング](#トラブルシューティング)

## 🎯 テスト環境概要

### テストフレームワーク

- **Unit/Integration Tests**: Jest + React Testing Library
- **E2E Tests**: Playwright
- **API Mocking**: MSW (Mock Service Worker)
- **Coverage**: Jest Coverage + Codecov

### テストターゲット

1. **認証・権限システム** (admin/manager/staff)
2. **スタッフCRUD操作** (複数スキル管理含む)
3. **GPS+QR打刻システム** (300m圏内検証)
4. **4スキル管理** (PA、音源再生、照明、バックヤード)
5. **労働基準法準拠機能**

## 🚀 セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
# テスト用環境変数をコピー
cp .env.test .env.local
```

### 3. テストデータベースの準備（必要に応じて）

```bash
# Supabaseローカル環境を使用する場合
supabase start
supabase db reset
```

## 🧪 テストの実行方法

### すべてのテストを実行

```bash
npm run test:all
```

### テストタイプ別実行

```bash
# ユニットテスト
npm run test

# ウォッチモード（開発時推奨）
npm run test:watch

# カバレッジ付きテスト
npm run test:coverage

# E2Eテスト
npm run test:e2e

# E2EテストUI（デバッグ用）
npm run test:e2e:ui

# E2Eテストデバッグ
npm run test:e2e:debug
```

### 特定のテストファイルを実行

```bash
# 認証テストのみ
npm test auth.test.ts

# パターンマッチング
npm test -- --testNamePattern="GPS"

# 特定のディレクトリ
npm test __tests__/integration
```

## 🔄 TDD開発フロー

### 基本サイクル: Red → Green → Refactor

#### 1. Red: 失敗するテストを書く

```typescript
// Example: 新機能のテストを先に書く
describe('新機能: スタッフスケジュール管理', () => {
  it('should create weekly schedule for staff', async () => {
    // Arrange
    const staffId = 'staff-1'
    const weekStart = '2025-01-20'
    const scheduleData = {
      monday: true,
      tuesday: true,
      wednesday: false,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false, // 週休確保
    }

    // Act
    const response = await createStaffSchedule(staffId, weekStart, scheduleData)

    // Assert
    expect(response.success).toBe(true)
    expect(response.schedule).toMatchObject(scheduleData)
  })
})
```

#### 2. Green: 最小限の実装でテストを通す

```typescript
// 最初は最小限の実装
export async function createStaffSchedule(staffId: string, weekStart: string, data: any) {
  return {
    success: true,
    schedule: data,
  }
}
```

#### 3. Refactor: コードを改善する

```typescript
// 実際のビジネスロジックを実装
export async function createStaffSchedule(
  staffId: string,
  weekStart: string,
  scheduleData: StaffScheduleData
): Promise<CreateScheduleResponse> {
  // バリデーション
  validateWeekStart(weekStart)
  validateWeeklyRestDay(scheduleData)

  // データベース操作
  const schedule = await supabase
    .from('staff_schedules')
    .insert({
      staff_id: staffId,
      week_start: weekStart,
      ...scheduleData,
    })
    .select()
    .single()

  return {
    success: true,
    schedule: schedule.data,
  }
}
```

### 新機能開発のテンプレート

```typescript
// __tests__/integration/api/new-feature.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals'
import { mockSupabaseClient, resetSupabaseMocks } from '@/__tests__/utils/supabase-mock'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

describe('/api/new-feature', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  describe('Happy Path', () => {
    it('should handle successful operation', async () => {
      // TODO: 成功パターンのテスト
    })
  })

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      // TODO: バリデーションエラーのテスト
    })

    it('should handle unauthorized access', async () => {
      // TODO: 認証エラーのテスト
    })
  })

  describe('Edge Cases', () => {
    it('should handle edge case scenario', async () => {
      // TODO: エッジケースのテスト
    })
  })
})
```

## 📁 テストの種類と構造

### ディレクトリ構造

```
__tests__/
├── unit/                 # ユニットテスト
│   ├── utils/           # ユーティリティ関数
│   └── components/      # Reactコンポーネント
├── integration/         # 統合テスト
│   ├── api/            # API エンドポイント
│   └── db/             # データベース操作
├── e2e/                # E2Eテスト
│   ├── auth.spec.ts    # 認証フロー
│   ├── staff.spec.ts   # スタッフ管理
│   └── punch.spec.ts   # 打刻フロー
├── fixtures/           # テストデータ
├── mocks/              # モック設定
└── utils/              # テストユーティリティ
```

### テストカテゴリ

#### 1. Unit Tests (ユニットテスト)
- 個別の関数やコンポーネントのテスト
- 外部依存を排除したテスト
- 高速実行が可能

#### 2. Integration Tests (統合テスト)
- API エンドポイントのテスト
- データベース連携のテスト
- 複数コンポーネントの連携テスト

#### 3. E2E Tests (エンドツーエンドテスト)
- 実際のユーザーシナリオテスト
- ブラウザ自動化によるテスト
- 全体的な動作確認

## 📊 カバレッジ要件

### 最低カバレッジ基準

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### カバレッジレポートの確認

```bash
# カバレッジ付きテスト実行
npm run test:coverage

# HTMLレポートの表示
open coverage/lcov-report/index.html
```

### カバレッジ除外対象

- `node_modules/`
- `*.d.ts` ファイル
- `__tests__/` ディレクトリ
- `.next/` ビルドファイル

## 🎯 重要なテストケース

### 1. 認証・権限テスト

```typescript
describe('Authentication & Authorization', () => {
  it('should enforce role-based access control', async () => {
    const testCases = [
      { role: 'admin', path: '/admin/staff/new', expectAccess: true },
      { role: 'manager', path: '/admin/staff/new', expectAccess: false },
      { role: 'staff', path: '/admin/staff/new', expectAccess: false },
    ]

    for (const testCase of testCases) {
      // テストケースを実行
    }
  })
})
```

### 2. 4スキル管理テスト

```typescript
describe('Skills Management', () => {
  it('should ensure all 4 skills are available', async () => {
    const requiredSkills = ['PA', '音源再生', '照明', 'バックヤード']

    const skills = await getSkills()

    requiredSkills.forEach(skillName => {
      expect(skills.some(s => s.label === skillName)).toBe(true)
    })
  })
})
```

### 3. GPS+QR打刻テスト

```typescript
describe('GPS + QR Punch System', () => {
  it('should validate location within 300m range', async () => {
    const withinRange = { lat: 33.5924, lng: 130.4017 } // ~220m from venue
    const outOfRange = { lat: 33.5954, lng: 130.4017 }  // ~550m from venue

    // 範囲内テスト
    const validResult = await attendancePunch({
      qr_code: 'VALID-QR',
      location: withinRange,
      purpose: 'checkin'
    })
    expect(validResult.success).toBe(true)

    // 範囲外テスト
    const invalidResult = await attendancePunch({
      qr_code: 'VALID-QR',
      location: outOfRange,
      purpose: 'checkin'
    })
    expect(invalidResult.success).toBe(false)
    expect(invalidResult.error).toMatch(/Too far from venue/)
  })
})
```

### 4. 労働基準法準拠テスト

```typescript
describe('Labor Law Compliance', () => {
  it('should enforce weekly 40-hour limit', async () => {
    const staffId = 'staff-1'
    const weekStart = '2025-01-20'

    // 40時間を超える勤務を試行
    const result = await validateWeeklyHours(staffId, weekStart, 45)

    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/週40時間を超えています/)
  })

  it('should ensure weekly rest day', async () => {
    const scheduleWithoutRest = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true, // 週休なし
    }

    const result = await validateSchedule(scheduleWithoutRest)

    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/週休が設定されていません/)
  })
})
```

## 🔧 CI/CDでのテスト実行

### GitHub Actions ワークフロー

テストは以下のタイミングで自動実行されます：

1. **Pull Request作成時**
2. **main/developブランチへのpush時**
3. **手動実行**

### 並列テスト実行

```yaml
strategy:
  matrix:
    test-group: [unit, integration]
    browser: [chromium, firefox, webkit]  # E2E用
```

### 品質ゲート

以下の条件をすべて満たす必要があります：

- ✅ 全テストが成功
- ✅ カバレッジが70%以上
- ✅ Lintエラーなし
- ✅ TypeScriptビルド成功

## 🐛 トラブルシューティング

### よくある問題と解決方法

#### 1. テストがタイムアウトする

```typescript
// jest.config.js
module.exports = {
  testTimeout: 30000, // 30秒に延長
}

// 個別テストでタイムアウト調整
it('should handle long operation', async () => {
  // テスト内容
}, 60000) // 60秒
```

#### 2. モックが期待通りに動作しない

```typescript
// モックをテスト前にリセット
beforeEach(() => {
  jest.clearAllMocks()
  resetSupabaseMocks()
})
```

#### 3. E2Eテストが不安定

```typescript
// 要素の表示を確実に待つ
await page.waitForSelector('[data-testid="element"]', { timeout: 10000 })

// ネットワーク完了を待つ
await page.waitForLoadState('networkidle')
```

#### 4. GPS位置情報のテストが失敗する

```typescript
// テスト前に位置情報のモックを設定
beforeEach(async ({ context }) => {
  await context.setGeolocation({ latitude: 33.5904, longitude: 130.4017 })
  await context.grantPermissions(['geolocation'])
})
```

### デバッグ方法

#### Jest テストのデバッグ

```bash
# Node.js デバッガーでテスト実行
node --inspect-brk node_modules/.bin/jest --runInBand

# VSCodeでデバッグ設定
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

#### Playwright E2Eテストのデバッグ

```bash
# デバッグモードで実行
npm run test:e2e:debug

# ヘッドフルモードで実行
npx playwright test --headed

# 特定のテストをデバッグ
npx playwright test auth.spec.ts --debug
```

## 📚 参考資料

- [Jest Documentation](https://jestjs.io/docs/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)

## 🤝 貢献ガイドライン

### 新しいテストを追加する際の手順

1. **要件を理解する**
2. **失敗するテストを書く** (Red)
3. **最小限の実装** (Green)
4. **リファクタリング** (Refactor)
5. **カバレッジを確認する**
6. **レビューを依頼する**

### テストの命名規則

```typescript
// ✅ Good
describe('POST /api/admin/staff', () => {
  it('should create new staff with valid data', () => {})
  it('should return 400 for invalid email format', () => {})
  it('should return 403 for non-admin users', () => {})
})

// ❌ Bad
describe('staff tests', () => {
  it('test1', () => {})
  it('test creation', () => {})
})
```

---

**最終更新**: 2025年1月20日
**作成者**: HAAS Development Team
-- staffテーブルの更新ポリシーを修正
-- 管理者・マネージャーのみが全フィールドを更新可能
-- 一般スタッフは更新不可（将来的に連絡先のみ更新可能にする場合は別途ポリシー追加）

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "staff_update_self" ON "public"."staff";
DROP POLICY IF EXISTS "staff_update_self_or_admin" ON "public"."staff";

-- 管理者・マネージャーのみ更新可能
CREATE POLICY "staff_update_admin_manager_only" ON "public"."staff"
FOR UPDATE TO "authenticated"
USING (
  "public"."is_admin_or_manager_user"()
)
WITH CHECK (
  "public"."is_admin_or_manager_user"()
);

-- RLSが有効になっていることを確認
ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;

-- 注意：
-- 現在は管理者・マネージャーのみがスタッフ情報を更新可能
-- 将来的にスタッフが自分の連絡先を更新できるようにする場合は、
-- 別途制限付きのポリシーを追加する必要があります
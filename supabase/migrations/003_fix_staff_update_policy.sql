-- staffテーブルの更新ポリシーを修正
-- 管理者とマネージャーは全スタッフを更新可能にする

-- 既存の自己更新ポリシーを削除
DROP POLICY IF EXISTS "staff_update_self" ON "public"."staff";

-- 新しい更新ポリシーを作成
-- 1. 自分自身のレコードを更新可能
-- 2. 管理者・マネージャーは全員を更新可能
CREATE POLICY "staff_update_self_or_admin" ON "public"."staff"
FOR UPDATE TO "authenticated"
USING (
  ("user_id" = "auth"."uid"()) OR
  "public"."is_admin_or_manager_user"()
)
WITH CHECK (
  ("user_id" = "auth"."uid"()) OR
  "public"."is_admin_or_manager_user"()
);

-- RLSが有効になっていることを確認
ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;
import { createClient } from '@/lib/supabase/client';

export class AuthRepository {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  // スタッフ招待メール送信
  async inviteStaff(email: string, staffId: string) {
    // Supabase Magic Linkを使った招待
    const { data, error } = await this.supabase.auth.signInWithOtp({
      email: email,
      options: {
        data: {
          staff_id: staffId,
          role: 'staff'
        }
      }
    });

    if (error) throw error;
    return data;
  }

  // 管理者による初期パスワード設定（方法2用）
  async createUserWithPassword(email: string, password: string, staffId: string) {
    // 管理者権限で新規ユーザー作成（サーバーサイドで実行が必要）
    const { data, error } = await this.supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        staff_id: staffId
      }
    });

    if (error) throw error;

    // staffテーブルのuser_idを更新
    if (data.user) {
      const { error: updateError } = await this.supabase
        .from('staff')
        .update({ user_id: data.user.id })
        .eq('id', staffId);

      if (updateError) throw updateError;
    }

    return data;
  }

  // パスワードリセット送信
  async sendPasswordReset(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) throw error;
    return data;
  }
}
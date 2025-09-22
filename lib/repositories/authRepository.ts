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

  // パスワード更新（開発環境用の実装）
  async updatePassword(email: string, newPassword: string) {
    // まず該当ユーザーを検索
    const { data: staffData } = await this.supabase
      .from('staff')
      .select('user_id, id')
      .eq('email', email)
      .single();

    if (!staffData) {
      throw new Error('スタッフが見つかりません');
    }

    // user_idがない場合は新規作成
    if (!staffData.user_id) {
      const { data: authData, error: signUpError } = await this.supabase.auth.signUp({
        email: email,
        password: newPassword
      });

      if (signUpError) throw signUpError;

      // staffテーブルのuser_idを更新
      if (authData.user) {
        const { error: updateError } = await this.supabase
          .from('staff')
          .update({ user_id: authData.user.id })
          .eq('id', staffData.id);

        if (updateError) throw updateError;
      }
      return authData;
    } else {
      // 既存ユーザーの場合
      // 開発環境の対処法：一旦削除して再作成（注意：本番環境では使用しないこと）

      // 1. auth.usersから削除（管理者権限が必要）
      // これはクライアントサイドではできないため、
      // 開発環境では以下の回避策を使用：

      // 既存のuser_idをnullにして、新しいアカウントを作成
      const { error: clearError } = await this.supabase
        .from('staff')
        .update({ user_id: null })
        .eq('id', staffData.id);

      if (clearError) throw clearError;

      // 新しいアカウントを作成
      const { data: authData, error: signUpError } = await this.supabase.auth.signUp({
        email: email,
        password: newPassword,
        options: {
          emailRedirectTo: undefined, // メール確認をスキップ（開発環境用）
        }
      });

      if (signUpError) {
        // エラーが「User already registered」の場合は、
        // そのユーザーでログインを試みる（パスワードが同じ場合）
        if (signUpError.message?.includes('already registered')) {
          const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
            email: email,
            password: newPassword
          });

          if (!signInError && signInData.user) {
            // ログイン成功したら、user_idを更新
            await this.supabase
              .from('staff')
              .update({ user_id: signInData.user.id })
              .eq('id', staffData.id);

            return signInData;
          }
          // ログイン失敗の場合は、パスワードが違うということ
          throw new Error('既存のアカウントがあります。Supabaseダッシュボードから手動で削除してください。');
        }
        throw signUpError;
      }

      // staffテーブルのuser_idを更新
      if (authData?.user) {
        const { error: updateError } = await this.supabase
          .from('staff')
          .update({ user_id: authData.user.id })
          .eq('id', staffData.id);

        if (updateError) throw updateError;
      }

      return authData;
    }
  }
}
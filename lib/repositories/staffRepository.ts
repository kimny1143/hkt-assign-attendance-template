import { createClient } from '@/lib/supabase/client';

export interface StaffData {
  id?: string;
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  hourly_rate?: number | null;
  daily_rate?: number | null;
  project_rate?: number | null;
  active?: boolean;
}

export interface StaffSkill {
  skill_id: number;
  proficiency_level: number;
  certified: boolean;
}

export class StaffRepository {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  // スタッフ一覧取得
  async getAll() {
    const { data, error } = await this.supabase
      .from('staff')
      .select(`
        *,
        user_roles!user_roles_staff_id_fkey (role),
        staff_skills (
          skill_id,
          proficiency_level,
          certified,
          skills (id, code, label)
        )
      `)
      .order('name');

    if (error) throw error;
    return data;
  }

  // スタッフ詳細取得
  async getById(id: string) {
    const { data, error } = await this.supabase
      .from('staff')
      .select(`
        *,
        user_roles!user_roles_staff_id_fkey (role, granted_at),
        staff_skills (
          skill_id,
          proficiency_level,
          certified,
          skills (id, code, label)
        ),
        attendances (
          id,
          check_in_ts,
          check_out_ts,
          status
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  // スタッフ作成
  async create(staffData: StaffData, skills: StaffSkill[] = [], role?: string, password?: string) {
    // メールアドレスがある場合は認証ユーザーも作成
    let userId = null;
    if (staffData.email && password) {
      // Supabase Authでユーザー作成
      const { data: authData, error: authError } = await this.supabase.auth.signUp({
        email: staffData.email,
        password: password,
        options: {
          data: {
            name: staffData.name,
            role: role || 'staff'
          }
        }
      });

      if (authError) throw authError;
      userId = authData.user?.id;
    }

    // スタッフレコード作成
    console.log('Creating staff with data:', { ...staffData, user_id: userId }); // デバッグ
    const { data: staff, error: staffError } = await this.supabase
      .from('staff')
      .insert([{
        ...staffData,
        user_id: userId
      }])
      .select()
      .single();

    if (staffError) {
      console.error('Staff creation error:', staffError); // デバッグ
      throw staffError;
    }
    console.log('Created staff:', staff); // デバッグ

    // スキルの登録
    if (skills.length > 0 && staff) {
      const skillsToInsert = skills.map(skill => ({
        staff_id: staff.id,
        ...skill
      }));

      const { error: skillsError } = await this.supabase
        .from('staff_skills')
        .insert(skillsToInsert);

      if (skillsError) throw skillsError;
    }

    // ロールの登録
    if (role && staff) {
      const { error: roleError } = await this.supabase
        .from('user_roles')
        .insert([{
          staff_id: staff.id,
          role: role
        }]);

      if (roleError) throw roleError;
    }

    return staff;
  }

  // スタッフ更新
  async update(id: string, staffData: Partial<StaffData>, skills?: StaffSkill[], role?: string | null) {
    // スタッフ情報を更新
    console.log('Updating staff with data:', staffData); // デバッグ
    const { data: updatedStaff, error: staffError } = await this.supabase
      .from('staff')
      .update(staffData)
      .eq('id', id)
      .select()
      .single();

    if (staffError) {
      console.error('Staff update error:', staffError); // デバッグ
      throw staffError;
    }
    console.log('Staff updated successfully, returned data:', updatedStaff); // デバッグ

    // スキルの更新（指定された場合）
    if (skills !== undefined) {
      // 既存のスキルを削除
      const { error: deleteError } = await this.supabase
        .from('staff_skills')
        .delete()
        .eq('staff_id', id);

      if (deleteError) throw deleteError;

      // 新しいスキルを登録
      if (skills.length > 0) {
        const skillsToInsert = skills.map(skill => ({
          staff_id: id,
          ...skill
        }));

        const { error: skillsError } = await this.supabase
          .from('staff_skills')
          .insert(skillsToInsert);

        if (skillsError) throw skillsError;
      }
    }

    // ロールの更新（指定された場合）
    if (role !== undefined) {
      // 既存のロールを削除
      const { error: deleteRoleError } = await this.supabase
        .from('user_roles')
        .delete()
        .eq('staff_id', id);

      if (deleteRoleError) throw deleteRoleError;

      // 新しいロールを登録（roleがnullでない場合）
      if (role) {
        const { error: roleError } = await this.supabase
          .from('user_roles')
          .insert([{
            staff_id: id,
            role: role
          }]);

        if (roleError) throw roleError;
      }
    }

    return { id };
  }

  // スタッフ無効化
  async deactivate(id: string) {
    const { error } = await this.supabase
      .from('staff')
      .update({ active: false })
      .eq('id', id);

    if (error) throw error;
    return { id };
  }
}
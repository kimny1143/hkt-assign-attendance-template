import { createClient } from '@/lib/supabase/client';

export interface Skill {
  id: number;
  code: string;
  label: string;
  description?: string;
}

export class SkillRepository {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  // スキル一覧取得
  async getAll() {
    const { data, error } = await this.supabase
      .from('skills')
      .select('*')
      .order('code');

    if (error) throw error;
    return data as Skill[];
  }

  // スキル詳細取得
  async getById(id: number) {
    const { data, error } = await this.supabase
      .from('skills')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Skill;
  }
}
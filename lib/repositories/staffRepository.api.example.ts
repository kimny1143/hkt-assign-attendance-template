// 将来API実装時はこのように変更するだけ
export class StaffRepository {
  // Supabase直接接続からAPI呼び出しに変更
  async getAll() {
    const response = await fetch('/api/admin/staff');
    if (!response.ok) throw new Error('Failed to fetch staff');
    const data = await response.json();
    return data.staff;
  }

  async create(staffData: StaffData, skills: StaffSkill[] = []) {
    const response = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...staffData, skills })
    });

    if (!response.ok) throw new Error('Failed to create staff');
    const data = await response.json();
    return data.staff;
  }

  // 他のメソッドも同様に変更
}
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, User } from 'lucide-react';

interface Skill {
  id: number;
  code: string;
  label: string;
}

interface StaffEditData {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  hourly_rate: number | null;
  daily_rate: number | null;
  project_rate: number | null;
  active: boolean;
  staff_skills?: {
    skill_id: number;
    proficiency_level: number;
    certified: boolean;
  }[];
  user_roles?: {
    role: string;
  }[];
}

export default function StaffEditPage() {
  const params = useParams();
  const router = useRouter();

  const [formData, setFormData] = useState<StaffEditData>({
    id: '',
    name: '',
    code: null,
    email: null,
    phone: null,
    address: null,
    hourly_rate: null,
    daily_rate: null,
    project_rate: null,
    active: true,
    staff_skills: [],
    user_roles: []
  });

  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<{
    [key: number]: {
      proficiency_level: number;
      certified: boolean;
    }
  }>({});

  const [selectedRole, setSelectedRole] = useState<string>('staff');
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchStaffData(), fetchSkills()]);
  }, [params.id]);

  const fetchStaffData = async () => {
    try {
      const { StaffRepository } = await import('@/lib/repositories/staffRepository');
      const staffRepo = new StaffRepository();
      const data = await staffRepo.getById(params.id as string);

      setFormData({
        id: data.id,
        name: data.name || '',
        code: data.code,
        email: data.email,
        phone: data.phone,
        address: data.address,
        hourly_rate: data.hourly_rate,
        daily_rate: data.daily_rate,
        project_rate: data.project_rate,
        active: data.active,
        staff_skills: data.staff_skills || [],
        user_roles: data.user_roles || []
      });

      // スキル選択状態を設定
      const skills: any = {};
      data.staff_skills?.forEach((skill: any) => {
        skills[skill.skill_id] = {
          proficiency_level: skill.proficiency_level,
          certified: skill.certified
        };
      });
      setSelectedSkills(skills);

      // ロールを設定
      if (data.user_roles && data.user_roles.length > 0) {
        setSelectedRole(data.user_roles[0].role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データ取得エラー');
    } finally {
      setLoading(false);
    }
  };

  const fetchSkills = async () => {
    try {
      const { SkillRepository } = await import('@/lib/repositories/skillRepository');
      const skillRepo = new SkillRepository();
      const skills = await skillRepo.getAll();
      setAvailableSkills(skills);
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name.includes('_rate')) {
      setFormData(prev => ({
        ...prev,
        [name]: value ? parseFloat(value) : null
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value || null
      }));
    }
  };

  const handleSkillToggle = (skillId: number) => {
    setSelectedSkills(prev => {
      if (prev[skillId]) {
        const newSkills = { ...prev };
        delete newSkills[skillId];
        return newSkills;
      } else {
        return {
          ...prev,
          [skillId]: {
            proficiency_level: 3,
            certified: false
          }
        };
      }
    });
  };

  const handleSkillLevelChange = (skillId: number, level: number) => {
    setSelectedSkills(prev => ({
      ...prev,
      [skillId]: {
        ...prev[skillId],
        proficiency_level: level
      }
    }));
  };

  const handleSkillCertifiedChange = (skillId: number, certified: boolean) => {
    setSelectedSkills(prev => ({
      ...prev,
      [skillId]: {
        ...prev[skillId],
        certified
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // パスワード変更のバリデーション
    if (changePassword) {
      if (!newPassword) {
        setError('新しいパスワードを入力してください');
        setSaving(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('パスワードが一致しません');
        setSaving(false);
        return;
      }
      if (newPassword.length < 6) {
        setError('パスワードは6文字以上で設定してください');
        setSaving(false);
        return;
      }
    }

    try {
      const { StaffRepository } = await import('@/lib/repositories/staffRepository');
      const staffRepo = new StaffRepository();

      console.log('Form data before update:', formData); // デバッグ

      const staffData = {
        name: formData.name,
        code: formData.code,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        hourly_rate: formData.hourly_rate,
        daily_rate: formData.daily_rate,
        project_rate: formData.project_rate,
        active: formData.active
      };

      console.log('Staff data to be updated:', staffData); // デバッグ

      const skills = Object.entries(selectedSkills).map(([skillId, data]) => ({
        skill_id: parseInt(skillId),
        proficiency_level: data.proficiency_level,
        certified: data.certified
      }));

      await staffRepo.update(params.id as string, staffData, skills, selectedRole);

      // パスワード変更処理
      if (changePassword && formData.email) {
        const { AuthRepository } = await import('@/lib/repositories/authRepository');
        const authRepo = new AuthRepository();
        try {
          await authRepo.updatePassword(formData.email, newPassword);
          alert('パスワードを更新しました');
        } catch (pwError) {
          // パスワード更新エラーは警告のみ（スタッフ情報は保存済み）
          console.error('Password update error:', pwError);
          alert(`スタッフ情報は保存しましたが、パスワード更新に問題がありました: ${pwError instanceof Error ? pwError.message : 'エラー'}`);
        }
      }

      router.push(`/admin/staff/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新エラー');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/admin/staff/${params.id}`}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          戻る
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6" />
          スタッフ編集
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded shadow">
        {/* 基本情報 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">基本情報</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                スタッフコード
              </label>
              <input
                type="text"
                name="code"
                value={formData.code || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                権限ロール
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
              >
                <option value="staff">スタッフ</option>
                <option value="manager">マネージャー</option>
                <option value="admin">管理者</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                管理者: 全権限 / マネージャー: イベント管理 / スタッフ: 基本権限
              </p>
            </div>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                name="active"
                id="active"
                checked={formData.active}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="active" className="ml-2 text-sm font-medium text-gray-700">
                有効
              </label>
            </div>
          </div>
        </div>

        {/* 連絡先情報 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">連絡先</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                電話番号
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              住所
            </label>
            <input
              type="text"
              name="address"
              value={formData.address || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
            />
          </div>
        </div>

        {/* パスワード設定 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">パスワード設定</h2>

          <div>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={changePassword}
                onChange={(e) => setChangePassword(e.target.checked)}
                className="mr-2"
              />
              <span>パスワードを変更する</span>
            </label>
          </div>

          {changePassword && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  新しいパスワード <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
                  placeholder="6文字以上"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  パスワード（確認） <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
                  placeholder="もう一度入力"
                />
              </div>
            </div>
          )}
          {formData.email ? (
            <p className="text-sm text-gray-500">
              メールアドレス: {formData.email}
            </p>
          ) : (
            <p className="text-sm text-red-500">
              パスワード変更にはメールアドレスの登録が必要です
            </p>
          )}
        </div>

        {/* 報酬設定 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">報酬設定</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                時給（円）
              </label>
              <input
                type="number"
                name="hourly_rate"
                value={formData.hourly_rate || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
                placeholder="1500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                日給（円）
              </label>
              <input
                type="number"
                name="daily_rate"
                value={formData.daily_rate || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
                placeholder="12000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                プロジェクト単価（円）
              </label>
              <input
                type="number"
                name="project_rate"
                value={formData.project_rate || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2"
                placeholder="50000"
              />
            </div>
          </div>
        </div>

        {/* スキル設定 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">スキル</h2>

          <div className="space-y-2 border border-gray-200 rounded-md p-4">
            {availableSkills.map((skill) => {
              const isSelected = !!selectedSkills[skill.id];
              const skillData = selectedSkills[skill.id];

              return (
                <div key={skill.id} className="flex items-center space-x-4 p-2 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSkillToggle(skill.id)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />

                  <div className="flex-1">
                    <label className="font-medium">{skill.label}</label>
                    <span className="ml-2 text-sm text-gray-500">({skill.code})</span>
                  </div>

                  {isSelected && skillData && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500">習熟度</label>
                        <select
                          value={skillData.proficiency_level}
                          onChange={(e) => handleSkillLevelChange(skill.id, parseInt(e.target.value))}
                          className="mt-1 block w-24 border-gray-300 rounded-md shadow-sm text-sm"
                        >
                          <option value={1}>Lv1</option>
                          <option value={2}>Lv2</option>
                          <option value={3}>Lv3</option>
                          <option value={4}>Lv4</option>
                          <option value={5}>Lv5</option>
                        </select>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={skillData.certified}
                          onChange={(e) => handleSkillCertifiedChange(skill.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <label className="ml-2 text-sm">認定済み</label>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 送信ボタン */}
        <div className="flex justify-end space-x-4 pt-4 border-t">
          <Link
            href={`/admin/staff/${params.id}`}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
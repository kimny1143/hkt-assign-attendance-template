'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, User, Mail, Phone, DollarSign, Shield } from 'lucide-react';

interface StaffDetail {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
  hourly_rate: number | null;
  daily_rate: number | null;
  project_rate: number | null;
  created_at: string;
  user_roles?: { role: string; granted_at: string }[];
  staff_skills?: {
    skill_id: number;
    proficiency_level: number;
    certified: boolean;
    skills: {
      id: number;
      code: string;
      label: string;
    };
  }[];
  attendances?: {
    id: string;
    checkin_at: string;
    checkout_at: string;
    status: string;
  }[];
}

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaffDetail();
  }, [params.id]);

  const fetchStaffDetail = async () => {
    try {
      const { StaffRepository } = await import('@/lib/repositories/staffRepository');
      const staffRepo = new StaffRepository();
      const data = await staffRepo.getById(params.id as string);
      setStaff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600">エラー: {error || 'スタッフが見つかりません'}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/staff"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </Link>
          <h1 className="text-2xl font-bold">スタッフ詳細</h1>
        </div>
        <Link
          href={`/admin/staff/${staff.id}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Edit className="w-4 h-4" />
          編集
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 基本情報 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            基本情報
          </h2>
          <dl className="space-y-2">
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">名前:</dt>
              <dd className="flex-1">{staff.name}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">コード:</dt>
              <dd className="flex-1">{staff.code || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">ステータス:</dt>
              <dd className="flex-1">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  staff.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {staff.active ? '有効' : '無効'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* 連絡先 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            連絡先
          </h2>
          <dl className="space-y-2">
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">メール:</dt>
              <dd className="flex-1">{staff.email || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">電話:</dt>
              <dd className="flex-1">{staff.phone || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">住所:</dt>
              <dd className="flex-1">{staff.address || '-'}</dd>
            </div>
          </dl>
        </div>

        {/* 権限とロール */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            権限
          </h2>
          {staff.user_roles && staff.user_roles.length > 0 ? (
            <div className="space-y-2">
              {staff.user_roles.map((role, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    role.role === 'admin' ? 'bg-red-100 text-red-800' :
                    role.role === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {role.role}
                  </span>
                  <span className="text-sm text-gray-500">
                    付与日: {new Date(role.granted_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">権限が設定されていません</p>
          )}
        </div>

        {/* 報酬設定 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            報酬設定
          </h2>
          <dl className="space-y-2">
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">時給:</dt>
              <dd className="flex-1">
                {staff.hourly_rate ? `¥${staff.hourly_rate.toLocaleString()}` : '-'}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">日給:</dt>
              <dd className="flex-1">
                {staff.daily_rate ? `¥${staff.daily_rate.toLocaleString()}` : '-'}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium text-gray-600">プロジェクト:</dt>
              <dd className="flex-1">
                {staff.project_rate ? `¥${staff.project_rate.toLocaleString()}` : '-'}
              </dd>
            </div>
          </dl>
        </div>

        {/* スキル */}
        <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">スキル</h2>
          {staff.staff_skills && staff.staff_skills.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {staff.staff_skills.map((staffSkill) => (
                <div
                  key={staffSkill.skill_id}
                  className="border rounded-lg p-3 text-center"
                >
                  <div className="font-semibold">{staffSkill.skills.label}</div>
                  <div className="text-sm text-gray-500">
                    レベル {staffSkill.proficiency_level}
                  </div>
                  {staffSkill.certified && (
                    <div className="text-yellow-500 mt-1">⭐ 認定済み</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">スキルが登録されていません</p>
          )}
        </div>

        {/* 最近の勤怠記録 */}
        <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">最近の勤怠記録</h2>
          {staff.attendances && staff.attendances.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      チェックイン
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      チェックアウト
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      ステータス
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {staff.attendances.slice(0, 5).map((attendance) => (
                    <tr key={attendance.id}>
                      <td className="px-4 py-2 text-sm">
                        {attendance.check_in_ts
                          ? new Date(attendance.check_in_ts).toLocaleString('ja-JP')
                          : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {attendance.check_out_ts
                          ? new Date(attendance.check_out_ts).toLocaleString('ja-JP')
                          : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          attendance.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : attendance.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {attendance.status === 'approved' ? '承認済み' :
                           attendance.status === 'rejected' ? '拒否' : '保留'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">勤怠記録がありません</p>
          )}
        </div>
      </div>
    </div>
  );
}
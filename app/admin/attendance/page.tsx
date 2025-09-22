'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, Clock, MapPin, User, CheckCircle, XCircle } from 'lucide-react';

interface Attendance {
  id: string;
  staff_id: string;
  shift_id: string;
  check_in_ts: string | null;
  check_out_ts: string | null;
  check_in_lat: number | null;
  check_in_lon: number | null;
  check_out_lat: number | null;
  check_out_lon: number | null;
  status?: string;
  created_at: string;
  staff: {
    name: string;
    code: string | null;
  };
  shifts: {
    name: string;
    start_ts: string;
    end_ts: string;
    events: {
      name: string;
      venues: {
        name: string;
        address: string;
      };
    };
  };
}

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  // 今日の日付を2025-09-22に固定（テスト用）
  const [selectedDate, setSelectedDate] = useState('2025-09-22');

  const supabase = createClient();

  useEffect(() => {
    fetchAttendances();
  }, [selectedDate]);

  const fetchAttendances = async () => {
    setLoading(true);

    // 選択日の開始と終了
    const startDate = `${selectedDate}T00:00:00`;
    const endDate = `${selectedDate}T23:59:59`;

    console.log('Fetching attendances for date:', selectedDate);
    console.log('Date range:', startDate, 'to', endDate);

    const { data, error } = await supabase
      .from('attendances')
      .select(`
        id,
        staff_id,
        shift_id,
        check_in_ts,
        check_out_ts,
        check_in_lat,
        check_in_lon,
        check_out_lat,
        check_out_lon,
        status,
        created_at,
        staff!inner (
          name,
          code
        ),
        shifts!inner (
          name,
          start_ts,
          end_ts,
          events!inner (
            name,
            venues!inner (
              name,
              address
            )
          )
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attendances:', error);
    } else {
      console.log('Fetched attendances:', data);
      // データの型を修正
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        staff: item.staff || { name: '', code: null },
        shifts: item.shifts || { name: '', start_ts: '', end_ts: '', events: null }
      })) as Attendance[];
      setAttendances(formattedData);
    }
    setLoading(false);
  };

  const calculateWorkHours = (checkin: string | null, checkout: string | null) => {
    if (!checkin || !checkout) return '-';
    const start = new Date(checkin);
    const end = new Date(checkout);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return `${hours.toFixed(1)}時間`;
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (checkin: string | null, checkout: string | null) => {
    if (!checkin) return 'text-gray-500';
    if (!checkout) return 'text-blue-600';
    return 'text-green-600';
  };

  const getStatusText = (checkin: string | null, checkout: string | null) => {
    if (!checkin) return '未出勤';
    if (!checkout) return '勤務中';
    return '退勤済';
  };

  if (loading) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* パンくずリスト */}
      <nav className="flex mb-4 text-sm">
        <a href="/admin" className="text-blue-600 hover:text-blue-800">
          ダッシュボード
        </a>
        <span className="mx-2 text-gray-500">/</span>
        <span className="text-gray-700">勤怠管理</span>
      </nav>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">⏱️ 勤怠管理</h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border rounded-md"
            />
          </div>
        </div>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">総スタッフ数</div>
          <div className="text-2xl font-bold">
            {new Set(attendances.map(a => a.staff_id)).size}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">出勤済み</div>
          <div className="text-2xl font-bold text-green-600">
            {attendances.filter(a => a.check_in_ts).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">勤務中</div>
          <div className="text-2xl font-bold text-blue-600">
            {attendances.filter(a => a.check_in_ts && !a.check_out_ts).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">退勤済み</div>
          <div className="text-2xl font-bold text-gray-600">
            {attendances.filter(a => a.check_out_ts).length}
          </div>
        </div>
      </div>

      {/* 勤怠一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <User className="w-4 h-4 inline mr-1" />
                  スタッフ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  イベント・会場
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  予定時間
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <Clock className="w-4 h-4 inline mr-1" />
                  出勤
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <Clock className="w-4 h-4 inline mr-1" />
                  退勤
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  勤務時間
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状態
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  GPS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    勤怠データがありません
                  </td>
                </tr>
              ) : (
                attendances.map((attendance) => (
                  <tr key={attendance.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium">{attendance.staff.name}</div>
                        {attendance.staff.code && (
                          <div className="text-xs text-gray-500">
                            {attendance.staff.code}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium">{attendance.shifts.events.name}</div>
                        <div className="text-xs text-gray-600">
                          {attendance.shifts.events.venues.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        {formatTime(attendance.shifts.start_ts)}
                        〜
                        {formatTime(attendance.shifts.end_ts)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {attendance.check_in_ts ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            {formatTime(attendance.check_in_ts)}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-gray-400" />
                            未打刻
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {attendance.check_out_ts ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            {formatTime(attendance.check_out_ts)}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-gray-400" />
                            未打刻
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {calculateWorkHours(attendance.check_in_ts, attendance.check_out_ts)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${getStatusColor(attendance.check_in_ts, attendance.check_out_ts)}`}>
                        {getStatusText(attendance.check_in_ts, attendance.check_out_ts)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        {attendance.check_in_lat && (
                          <div className="text-gray-600">
                            出: {attendance.check_in_lat.toFixed(4)},
                            {attendance.check_in_lon?.toFixed(4)}
                          </div>
                        )}
                        {attendance.check_out_lat && (
                          <div className="text-gray-600">
                            退: {attendance.check_out_lat.toFixed(4)},
                            {attendance.check_out_lon?.toFixed(4)}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
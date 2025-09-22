#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAttendance() {
  try {
    // 最近の勤怠記録を取得
    const { data: attendances, error } = await supabase
      .from('attendances')
      .select(`
        id,
        shift_id,
        staff_id,
        checkin_ts,
        checkout_ts,
        checkin_gps_lat,
        checkin_gps_lon,
        checkout_gps_lat,
        checkout_gps_lon,
        created_at,
        staff (name),
        shifts (
          name,
          start_ts,
          end_ts,
          events (
            name,
            venues (name)
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching attendances:', error);
      return;
    }

    if (!attendances || attendances.length === 0) {
      console.log('No attendance records found.');
      return;
    }

    console.log('\n=== 最新の勤怠記録 ===\n');

    attendances.forEach((att) => {
      console.log(`ID: ${att.id}`);
      console.log(`スタッフ: ${att.staff?.name || 'Unknown'}`);

      if (att.shifts) {
        console.log(`ワークスケジュール: ${att.shifts.name}`);
        console.log(`イベント: ${att.shifts.events?.name || 'Unknown'}`);
        console.log(`会場: ${att.shifts.events?.venues?.name || 'Unknown'}`);
        console.log(`予定時間: ${new Date(att.shifts.start_ts).toLocaleString('ja-JP')} 〜 ${new Date(att.shifts.end_ts).toLocaleString('ja-JP')}`);
      }

      if (att.checkin_ts) {
        console.log(`出勤: ${new Date(att.checkin_ts).toLocaleString('ja-JP')}`);
        console.log(`  GPS: ${att.checkin_gps_lat?.toFixed(6)}, ${att.checkin_gps_lon?.toFixed(6)}`);
      }

      if (att.checkout_ts) {
        console.log(`退勤: ${new Date(att.checkout_ts).toLocaleString('ja-JP')}`);
        console.log(`  GPS: ${att.checkout_gps_lat?.toFixed(6)}, ${att.checkout_gps_lon?.toFixed(6)}`);

        // 勤務時間計算
        const checkin = new Date(att.checkin_ts);
        const checkout = new Date(att.checkout_ts);
        const hours = (checkout - checkin) / (1000 * 60 * 60);
        console.log(`  勤務時間: ${hours.toFixed(2)} 時間`);
      } else {
        console.log(`退勤: 未打刻`);
      }

      console.log(`作成日: ${new Date(att.created_at).toLocaleString('ja-JP')}`);
      console.log('---');
    });

    // 本日の統計
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: todayStats, error: statsError } = await supabase
      .from('attendances')
      .select('id, checkin_ts, checkout_ts')
      .gte('created_at', todayISO);

    if (!statsError && todayStats) {
      console.log('\n=== 本日の統計 ===');
      console.log(`総打刻数: ${todayStats.length}`);
      console.log(`出勤済み: ${todayStats.filter(a => a.checkin_ts).length}`);
      console.log(`退勤済み: ${todayStats.filter(a => a.checkout_ts).length}`);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// 引数処理
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node scripts/check-attendance.js [options]

Options:
  -h, --help    Show this help message

Description:
  Check attendance records from the database
  `);
  process.exit(0);
}

checkAttendance().then(() => process.exit(0));
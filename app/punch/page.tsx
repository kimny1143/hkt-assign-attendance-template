'use client'

import { useState } from 'react'

export default function PunchPage() {
  const [qrToken, setQrToken] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string>('')
  const [coords, setCoords] = useState<{ lat:number; lon:number }|null>(null)
  const [shiftId, setShiftId] = useState('')

  const grabGPS = async () =>
    new Promise<void>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('geolocation not supported'))
      navigator.geolocation.getCurrentPosition(
        (pos) => { setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }); resolve(); },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })

  const uploadPhoto = async (file: File) => {
    // 実運用では Supabase Storage にアップロード & 署名URL取得に置換
    const blobUrl = URL.createObjectURL(file)
    setPhotoUrl(blobUrl)
  }

  const submit = async (purpose: 'checkin' | 'checkout') => {
    if (!shiftId || !qrToken || !photoUrl || !coords) { alert('不足項目があります'); return; }
    const res = await fetch('/api/attendance/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shift_id: shiftId,
        lat: coords.lat,
        lon: coords.lon,
        qr_token: qrToken,
        photo_url: photoUrl,
        purpose
      })
    })
    const json = await res.json()
    if (!res.ok) alert(json.error || 'エラー')
    else alert('打刻OK')
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">出退勤打刻デモ</h1>

      <input className="border p-2 w-full" placeholder="シフトID" value={shiftId} onChange={e=>setShiftId(e.target.value)} />
      <textarea className="border p-2 w-full" placeholder="QRトークン" value={qrToken} onChange={e=>setQrToken(e.target.value)} />

      <div className="flex gap-2 items-center">
        <button className="border px-3 py-2 rounded" onClick={grabGPS}>GPS取得</button>
        <span className="text-sm">{coords ? `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` : "未取得"}</span>
      </div>

      <input type="file" accept="image/*" capture="user" onChange={e => e.target.files && uploadPhoto(e.target.files[0])} />
      {photoUrl && <img src={photoUrl} alt="preview" className="w-32 h-32 object-cover rounded" />}

      <div className="flex gap-2">
        <button className="bg-black text-white px-4 py-2 rounded" onClick={()=>submit('checkin')}>出勤</button>
        <button className="bg-black text-white px-4 py-2 rounded" onClick={()=>submit('checkout')}>退勤</button>
      </div>
    </main>
  )
}
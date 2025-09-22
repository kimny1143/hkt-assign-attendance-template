'use client'

import { useState } from 'react'

export default function DebugPage() {
  const [result, setResult] = useState<any>(null)

  const checkUser = async (email: string, password: string) => {
    const res = await fetch('/api/debug/check-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    setResult(data)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug: User Check</h1>
      
      <div className="space-y-2 mb-4">
        <button
          onClick={() => checkUser('staff1@haas.test', 'password123')}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Check staff1@haas.test
        </button>
        <button
          onClick={() => checkUser('admin@haas.test', 'password123')}
          className="bg-blue-500 text-white px-4 py-2 rounded ml-2"
        >
          Check admin@haas.test
        </button>
      </div>

      {result && (
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function TrainingApp() {
  const [activeTab, setActiveTab] = useState('calendar')
  const [races, setRaces] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [racesData, workoutsData] = await Promise.all([
        supabase.from('races').select('*'),
        supabase.from('workouts').select('*'),
      ])
      if (racesData.data) setRaces(racesData.data)
      if (workoutsData.data) setWorkouts(workoutsData.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #e0e0e0', paddingBottom: '20px' }}>
        <h1 style={{ margin: '0 0 8px 0' }}>⚡ Forge</h1>
        <p style={{ color: '#666', margin: 0 }}>Triathlon Training Tracker</p>
      </header>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['calendar', 'dashboard', 'workouts'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab ? '#2563eb' : '#f0f0f0',
              color: activeTab === tab ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {tab === 'calendar' && '📅 Calendar'}
            {tab === 'dashboard' && '📊 Dashboard'}
            {tab === 'workouts' && '🏃 Workouts'}
          </button>
        ))}
      </div>

      {activeTab === 'calendar' && (
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <h2>📅 Calendar</h2>
          <p>Your {races.length} races are synced to Supabase ✓</p>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <h2>📊 Dashboard</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Workouts</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>{workouts.length}</div>
            </div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Races</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>{races.length}</div>
            </div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Status</div>
              <div style={{ fontSize: '24px', color: '#10b981' }}>✓ Live</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'workouts' && (
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <h2>🏃 Workouts</h2>
          {workouts.length === 0 ? (
            <p style={{ color: '#999' }}>No workouts logged yet</p>
          ) : (
            <div>
              {workouts.map(w => (
                <div key={w.id} style={{ background: '#fff', padding: '12px', marginBottom: '8px', borderRadius: '4px' }}>
                  <strong>{w.sport?.toUpperCase()}</strong> - {w.distance}km in {w.time}min
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

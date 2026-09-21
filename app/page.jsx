'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function TrainingApp() {
  const [activeTab, setActiveTab] = useState('calendar')
  const [races, setRaces] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [recovery, setRecovery] = useState({})
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [showRaceModal, setShowRaceModal] = useState(false)
  const [showWorkoutModal, setShowWorkoutModal] = useState(false)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiPlan, setAiPlan] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [racesData, workoutsData, recoveryData] = await Promise.all([
        supabase.from('races').select('*'),
        supabase.from('workouts').select('*'),
        supabase.from('recovery').select('*'),
      ])
      if (racesData.data) setRaces(racesData.data)
      if (workoutsData.data) setWorkouts(workoutsData.data)
      if (recoveryData.data) {
        const recoveryMap = {}
        recoveryData.data.forEach(r => {
          recoveryMap[r.date] = r
        })
        setRecovery(recoveryMap)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function addRace(e) {
    e.preventDefault()
    const name = document.getElementById('raceName').value
    const date = document.getElementById('raceDate').value
    const type = document.getElementById('raceType').value
    
    if (!name || !date) { alert('Please fill in race name and date'); return }

    try {
      const { error } = await supabase
        .from('races')
        .insert([{ name, date, type }])
      if (error) throw error
      document.getElementById('raceName').value = ''
      document.getElementById('raceDate').value = ''
      setShowRaceModal(false)
      loadData()
    } catch (error) {
      console.error('Error adding race:', error)
      alert('Error adding race')
    }
  }

  async function addWorkout(e) {
    e.preventDefault()
    const date = document.getElementById('workoutDate').value
    const sport = document.getElementById('workoutSport').value
    const distance = parseFloat(document.getElementById('workoutDistance').value)
    const time = parseInt(document.getElementById('workoutTime').value)
    const effort = parseInt(document.getElementById('workoutEffort').value)
    const hr = document.getElementById('workoutHR').value ? parseInt(document.getElementById('workoutHR').value) : null
    const type = document.getElementById('workoutType').value
    const notes = document.getElementById('workoutNotes').value

    if (!date || !sport || !distance || !time) { alert('Please fill in required fields'); return }

    try {
      const { error } = await supabase
        .from('workouts')
        .insert([{ date, sport, distance, time, effort, hr, type, notes, source: 'manual' }])
      if (error) throw error
      document.getElementById('workoutDate').value = ''
      document.getElementById('workoutDistance').value = ''
      document.getElementById('workoutTime').value = ''
      document.getElementById('workoutEffort').value = '5'
      document.getElementById('workoutHR').value = ''
      document.getElementById('workoutNotes').value = ''
      setShowWorkoutModal(false)
      loadData()
    } catch (error) {
      console.error('Error adding workout:', error)
      alert('Error adding workout')
    }
  }

  async function addRecovery(e) {
    e.preventDefault()
    const today = new Date().toISOString().split('T')[0]
    const sleep_hours = parseFloat(document.getElementById('sleepHours').value)
    const sleep_quality = parseInt(document.getElementById('sleepQuality').value)
    const readiness = parseInt(document.getElementById('readiness').value)
    const soreness = parseInt(document.getElementById('soreness').value)
    const stress = parseInt(document.getElementById('stress').value)
    const notes = document.getElementById('recoveryNotes').value

    try {
      await supabase
        .from('recovery')
        .upsert([{ date: today, sleep_hours, sleep_quality, readiness, soreness, stress, notes }], { onConflict: 'date' })
      
      document.getElementById('sleepHours').value = '8'
      document.getElementById('sleepQuality').value = '7'
      document.getElementById('readiness').value = '7'
      document.getElementById('soreness').value = '3'
      document.getElementById('stress').value = '5'
      document.getElementById('recoveryNotes').value = ''
      setShowRecoveryModal(false)
      loadData()
      alert('Recovery data saved!')
    } catch (error) {
      console.error('Error saving recovery:', error)
      alert('Error saving recovery data')
    }
  }

  async function generateAIPlan(e) {
    e.preventDefault()
    const raceId = document.getElementById('aiRace').value
    const phase = document.getElementById('aiPhase').value
    const hours = document.getElementById('aiHours').value
    const weekStart = document.getElementById('aiWeekStart').value

    if (!raceId || !weekStart) { alert('Select race and week start date'); return }

    const race = races.find(r => r.id == raceId)
    if (!race) { alert('Race not found'); return }

    setAiGenerating(true)

    const prompt = `You are a professional Ironman triathlon coach. Generate a specific, realistic training week for an athlete.

RACE DETAILS:
- Race: ${race.name} on ${race.date}
- Training phase: ${phase}
- Available hours per week: ${hours}
- Week starting: ${weekStart}

Generate EXACTLY 7 days of workouts. For EACH day, provide:
- Day name (Monday-Sunday)
- Sport (swim, bike, run, or strength)
- Type (easy, threshold, interval, long, or recovery)
- Distance in km
- Time in minutes
- Brief description

Format your response as ONLY valid JSON, no markdown, no extra text:
[
  {
    "day": "Monday",
    "sport": "swim",
    "type": "easy",
    "distance": 2.5,
    "time": 45,
    "description": "Easy swim, focus on technique"
  },
  ...7 total workouts
]`

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }]
        })
      })

      const result = await response.json()
      let jsonText = result.content[0].text

      const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }

      const workoutList = JSON.parse(jsonText)
      
      const startDate = new Date(weekStart)
      workoutList.forEach((w, idx) => {
        const d = new Date(startDate)
        d.setDate(d.getDate() + idx)
        w.date = d.toISOString().split('T')[0]
      })

      setAiPlan(workoutList)
    } catch (error) {
      console.error('Error generating plan:', error)
      alert('Error generating plan: ' + error.message)
    } finally {
      setAiGenerating(false)
    }
  }

  async function saveAIPlan() {
    if (!aiPlan || aiPlan.length === 0) return

    try {
      const workoutsToInsert = aiPlan.map(w => ({
        date: w.date,
        sport: w.sport,
        distance: w.distance,
        time: w.time,
        type: w.type,
        notes: w.description,
        effort: 5,
        source: 'ai_generated'
      }))

      const { error } = await supabase
        .from('workouts')
        .insert(workoutsToInsert)

      if (error) throw error
      alert('Week saved to calendar!')
      setAiPlan(null)
      setShowAIModal(false)
      loadData()
    } catch (error) {
      console.error('Error saving plan:', error)
      alert('Error saving plan')
    }
  }

  function renderCalendar() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const days = []

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const isCurrentMonth = date.getMonth() === month
      const dayWorkouts = workouts.filter(w => w.date === dateStr)

      days.push({ dateStr, date, isCurrentMonth, workouts: dayWorkouts })
    }

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {dayHeaders.map(h => (
            <div key={h} style={{ textAlign: 'center', fontWeight: 500, fontSize: '12px', color: '#666' }}>
              {h}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {days.map(day => (
            <div
              key={day.dateStr}
              onClick={() => setSelectedDate(day.dateStr)}
              style={{
                background: day.isCurrentMonth ? '#fff' : '#f5f5f5',
                border: selectedDate === day.dateStr ? '2px solid #2563eb' : '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '8px',
                minHeight: '80px',
                cursor: 'pointer',
                opacity: day.isCurrentMonth ? 1 : 0.4
              }}
            >
              <div style={{ fontWeight: 500, fontSize: '12px', marginBottom: '4px' }}>
                {day.date.getDate()}
              </div>
              <div>
                {day.workouts.slice(0, 2).map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      fontSize: '9px',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      marginBottom: '2px'
                    }}
                  >
                    {w.sport.charAt(0).toUpperCase()} {w.distance}km
                  </div>
                ))}
                {day.workouts.length > 2 && (
                  <div style={{ fontSize: '10px', color: '#999' }}>+{day.workouts.length - 2}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['calendar', 'dashboard', 'workouts', 'recovery', 'ai'].map(tab => (
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
              fontSize: '14px'
            }}
          >
            {tab === 'calendar' && '📅 Calendar'}
            {tab === 'dashboard' && '📊 Dashboard'}
            {tab === 'workouts' && '🏃 Workouts'}
            {tab === 'recovery' && '💤 Recovery'}
            {tab === 'ai' && '🤖 AI Plan'}
          </button>
        ))}
      </div>

      {/* CALENDAR */}
      {activeTab === 'calendar' && (
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: 'pointer' }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: 'pointer' }}
              >
                Next →
              </button>
            </div>
          </div>

          {renderCalendar()}

          {selectedDate && (
            <div style={{ marginTop: '20px', background: '#fff', padding: '16px', borderRadius: '8px' }}>
              <h3>
                {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              {workouts.filter(w => w.date === selectedDate).length === 0 ? (
                <p style={{ color: '#999' }}>No workouts on this day</p>
              ) : (
                workouts.filter(w => w.date === selectedDate).map(w => (
                  <div key={w.id} style={{ background: '#f5f5f5', padding: '12px', marginBottom: '8px', borderRadius: '4px' }}>
                    <strong>{w.sport.toUpperCase()}</strong> - {w.distance}km in {w.time}min • Effort {w.effort}/10
                    {w.notes && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>📝 {w.notes}</p>}
                  </div>
                ))
              )}
              <button
                onClick={() => setShowWorkoutModal(true)}
                style={{ marginTop: '12px', padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Log workout on this day
              </button>
            </div>
          )}
        </div>
      )}

      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Total Workouts</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>{workouts.length}</div>
            </div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>This Week</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                {workouts.filter(w => new Date(w.date) > new Date(Date.now() - 7*24*60*60*1000)).length}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Upcoming Races</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                {races.filter(r => new Date(r.date) > new Date()).length}
              </div>
            </div>
          </div>

          <h3>Upcoming Races</h3>
          {races.filter(r => new Date(r.date) > new Date()).length === 0 ? (
            <p style={{ color: '#999' }}>No upcoming races</p>
          ) : (
            races.filter(r => new Date(r.date) > new Date()).map(race => (
              <div key={race.id} style={{ background: '#fff', padding: '16px', marginBottom: '8px', borderRadius: '4px', borderLeft: '4px solid #2563eb' }}>
                <strong>{race.name}</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666' }}>
                  {Math.ceil((new Date(race.date) - new Date()) / (1000*60*60*24))} days away • {race.date}
                </p>
              </div>
            ))
          )}

          <button
            onClick={() => setShowRaceModal(true)}
            style={{ marginTop: '12px', padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
          >
            + Add Race
          </button>
        </div>
      )}

      {/* WORKOUTS */}
      {activeTab === 'workouts' && (
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0 }}>Your Workouts</h2>
          {workouts.length === 0 ? (
            <p style={{ color: '#999' }}>No workouts logged yet</p>
          ) : (
            <div>
              {[...workouts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20).map(w => (
                <div key={w.id} style={{ background: '#fff', padding: '12px', marginBottom: '8px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong>{w.sport.toUpperCase()}</strong> - {w.distance}km in {w.time}min
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
                        {w.date} • Effort {w.effort}/10 {w.hr ? `• ${w.hr} bpm` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowWorkoutModal(true)}
            style={{ marginTop: '12px', padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
          >
            + Log Workout
          </button>
        </div>
      )}

      {/* RECOVERY */}
      {activeTab === 'recovery' && (
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0 }}>Recovery Tracking</h2>
          <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            {recovery[new Date().toISOString().split('T')[0]] ? (
              <div>
                <h4 style={{ margin: '0 0 12px 0' }}>Today's Recovery</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                  <div><strong>Sleep:</strong> {recovery[new Date().toISOString().split('T')[0]].sleep_hours}h</div>
                  <div><strong>Quality:</strong> {recovery[new Date().toISOString().split('T')[0]].sleep_quality}/10</div>
                  <div><strong>Readiness:</strong> {recovery[new Date().toISOString().split('T')[0]].readiness}/10</div>
                  <div><strong>Soreness:</strong> {recovery[new Date().toISOString().split('T')[0]].soreness}/10</div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#999' }}>No recovery data for today</p>
            )}
          </div>
          <button
            onClick={() => setShowRecoveryModal(true)}
            style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
          >
            Log Today's Recovery
          </button>
        </div>
      )}

      {/* AI PLAN */}
      {activeTab === 'ai' && (
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0 }}>🤖 AI Training Plan Generator</h2>
          {aiPlan ? (
            <div>
              <h3>Generated Week Preview</h3>
              {aiPlan.map((w, idx) => (
                <div key={idx} style={{ background: '#fff', padding: '12px', marginBottom: '8px', borderRadius: '4px' }}>
                  <strong>{w.day}</strong> - {w.sport.toUpperCase()} {w.distance}km in {w.time}min ({w.type})
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>{w.description}</p>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={saveAIPlan}
                  style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                >
                  Save Week to Calendar
                </button>
                <button
                  onClick={() => setAiPlan(null)}
                  style={{ padding: '10px 20px', background: '#999', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Regenerate
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
              <p style={{ color: '#666', marginBottom: '16px' }}>Generate a custom training week powered by Claude AI.</p>
              <form onSubmit={generateAIPlan}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Race</label>
                  <select id="aiRace" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                    <option value="">Select a race</option>
                    {races.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.date})</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Training Phase</label>
                  <select id="aiPhase" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                    <option value="base">Base (aerobic fitness)</option>
                    <option value="build">Build (volume + intensity)</option>
                    <option value="peak">Peak (race-specific)</option>
                    <option value="taper">Taper (recovery)</option>
                  </select>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Hours Available Per Week</label>
                  <select id="aiHours" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                    <option value="6-8">6-8 hours</option>
                    <option value="8-10">8-10 hours</option>
                    <option value="10-12">10-12 hours</option>
                    <option value="12-15">12-15+ hours</option>
                  </select>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Week Start Date</label>
                  <input type="date" id="aiWeekStart" defaultValue={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
                </div>
                <button
                  type="submit"
                  disabled={aiGenerating}
                  style={{ padding: '10px 20px', background: aiGenerating ? '#ccc' : '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: aiGenerating ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                >
                  {aiGenerating ? 'Generating...' : 'Generate Training Week'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* RACE MODAL */}
      {showRaceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ margin: '0 0 16px 0' }}>Add a Race</h2>
            <form onSubmit={addRace}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Race Name</label>
                <input type="text" id="raceName" placeholder="e.g., Ironman Hawaii" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Date</label>
                <input type="date" id="raceDate" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Type</label>
                <select id="raceType" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                  <option value="full">Full Ironman (140.6)</option>
                  <option value="half">Half Ironman (70.3)</option>
                  <option value="sprint">Sprint</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Save</button>
                <button type="button" onClick={() => setShowRaceModal(false)} style={{ flex: 1, padding: '10px', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WORKOUT MODAL */}
      {showWorkoutModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflow: 'auto' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '90%', margin: '20px auto' }}>
            <h2 style={{ margin: '0 0 16px 0' }}>Log Workout</h2>
            <form onSubmit={addWorkout}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Date</label>
                <input type="date" id="workoutDate" defaultValue={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Sport</label>
                <select id="workoutSport" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                  <option value="swim">🏊 Swim</option>
                  <option value="bike">🚴 Bike</option>
                  <option value="run">🏃 Run</option>
                  <option value="strength">💪 Strength</option>
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Distance (km)</label>
                <input type="number" id="workoutDistance" step="0.1" placeholder="e.g., 10" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Time (minutes)</label>
                <input type="number" id="workoutTime" placeholder="e.g., 60" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Effort (1-10)</label>
                <input type="number" id="workoutEffort" min="1" max="10" defaultValue="5" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>HR (optional)</label>
                <input type="number" id="workoutHR" placeholder="e.g., 150" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Type</label>
                <select id="workoutType" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                  <option value="easy">Easy</option>
                  <option value="threshold">Threshold</option>
                  <option value="interval">Interval</option>
                  <option value="long">Long</option>
                  <option value="recovery">Recovery</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Notes</label>
                <textarea id="workoutNotes" placeholder="How did it go?" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px', minHeight: '60px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Save</button>
                <button type="button" onClick={() => setShowWorkoutModal(false)} style={{ flex: 1, padding: '10px', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECOVERY MODAL */}
      {showRecoveryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ margin: '0 0 16px 0' }}>Log Today's Recovery</h2>
            <form onSubmit={addRecovery}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Sleep (hours)</label>
                <input type="number" id="sleepHours" min="0" max="12" step="0.5" defaultValue="8" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Sleep Quality (1-10)</label>
                <input type="number" id="sleepQuality" min="1" max="10" defaultValue="7" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Readiness (1-10)</label>
                <input type="number" id="readiness" min="1" max="10" defaultValue="7" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Soreness (1-10)</label>
                <input type="number" id="soreness" min="1" max="10" defaultValue="3" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Stress Level (1-10)</label>
                <input type="number" id="stress" min="1" max="10" defaultValue="5" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500 }}>Notes</label>
                <textarea id="recoveryNotes" placeholder="How are you feeling?" style={{ width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px', minHeight: '60px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Save</button>
                <button type="button" onClick={() => setShowRecoveryModal(false)} style={{ flex: 1, padding: '10px', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

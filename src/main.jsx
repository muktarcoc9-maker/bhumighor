
import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, STORAGE_BUCKET } from './supabase'
import {
  Plus, Search, LogOut, FileText, Trash2, Download, X,
  ShieldCheck, Pencil, Upload, FolderOpen, Eye, EyeOff
} from 'lucide-react'
import './style.css'

const emptyForm = {
  deed_number: '',
  donor_name: '',
  recipient_name: '',
  mouza: '',
  sheet_number: '',
  dag_type: 'CS',
  dag_number: '',
  khatian_type: 'CS',
  khatian_number: '',
  mutation_case_number: '',
  holding_number: '',
  total_land: '',
  owned_land: '',
  total_land_unit: 'শতক',
  owned_land_unit: 'শতক'
}

const labels = {
  deed_number: 'দলিল নম্বর',
  donor_name: 'দাতার নাম',
  recipient_name: 'গ্রহীতার নাম',
  mouza: 'মৌজা',
  sheet_number: 'সীট নম্বর',
  mutation_case_number: 'নামজারী কেস নম্বর',
  holding_number: 'হোল্ডিং নম্বর'
}

const landUnits = ['শতক', 'কাঠা', 'বিঘা', 'একর']

const fileCategories = [
  'জমির দলিল',
  'খতিয়ান',
  'নামজারি',
  'খাজনার রশিদ',
  'অন্যান্য কাগজপত্র'
]

function toEnglishDigits(value) {
  return String(value)
    .replace(/[০-৯]/g, digit => '০১২৩৪৫৬৭৮৯'.indexOf(digit))
    .replace(/٫/g, '.')
}

function parseLandAmount(value) {
  if (value === '' || value === null || value === undefined) return null

  const converted = toEnglishDigits(value).trim()
  if (converted === '') return null

  const number = Number(converted)

  if (!Number.isFinite(number) || number < 0) return NaN

  return number
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [records, setRecords] = useState([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)

  const [pendingFiles, setPendingFiles] = useState([])
  const [fileCategory, setFileCategory] = useState('জমির দলিল')

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return

      if (error) setMessage(error.message)
      setSession(data?.session || null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next)
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function loadRecords() {
    if (!session?.user) return

    const { data, error } = await supabase
      .from('land_records')
      .select('*, land_record_files(*)')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('তথ্য লোড করা যায়নি: ' + error.message)
    } else {
      setRecords(data || [])
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      loadRecords()
    } else {
      setRecords([])
    }
  }, [session?.user?.id])

  async function handleAuth(e) {
    e.preventDefault()
    setAuthBusy(true)
    setMessage('')

    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    setAuthBusy(false)

    if (result.error) {
      setMessage(result.error.message)
    } else if (authMode === 'signup') {
      setMessage(
        'রেজিস্ট্রেশন হয়েছে। ইমেইল ভেরিফিকেশন চাইলে ইনবক্স দেখুন, তারপর লগইন করুন।'
      )
    }
  }

  function resetForm() {
    setForm({ ...emptyForm })
    setPendingFiles([])
    setFileCategory('জমির দলিল')
    setEditingRecord(null)
    setShowForm(false)
  }

  function startEdit(record) {
    setEditingRecord(record)

    setForm({
      deed_number: record.deed_number || '',
      donor_name: record.donor_name || '',
      recipient_name: record.recipient_name || '',
      mouza: record.mouza || '',
      sheet_number: record.sheet_number || '',
      dag_type: record.dag_type || 'CS',
      dag_number: record.dag_number || '',
      khatian_type: record.khatian_type || 'CS',
      khatian_number: record.khatian_number || '',
      mutation_case_number: record.mutation_case_number || '',
      holding_number: record.holding_number || '',
      total_land: record.total_land ?? '',
      owned_land: record.owned_land ?? '',
      total_land_unit: record.total_land_unit || 'শতক',
      owned_land_unit: record.owned_land_unit || 'শতক'
    })

    setPendingFiles([])
    setShowForm(true)
    setMessage('জমির তথ্য সংশোধন করুন।')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function addSelectedFiles(e) {
    const selected = Array.from(e.target.files || [])

    const validFiles = selected.filter(file => {
      const validType = [
        'application/pdf',
        'image/jpeg',
        'image/png'
      ].includes(file.type)

      if (!validType) {
        setMessage('শুধু PDF, JPG ও PNG ফাইল যোগ করা যাবে।')
        return false
      }

      if (file.size > 50 * 1024 * 1024) {
        setMessage(`${file.name} ফাইলটি ৫০ MB-এর বেশি।`)
        return false
      }

      return true
    })

    setPendingFiles(old => [
      ...old,
      ...validFiles.map(file => ({
        file,
        category: fileCategory,
        id: crypto.randomUUID()
      }))
    ])

    e.target.value = ''
  }

  function removePendingFile(id) {
    setPendingFiles(old => old.filter(item => item.id !== id))
  }

  async function saveRecord(e) {
    e.preventDefault()

    if (!session?.user || saving) return

    const totalLand = parseLandAmount(form.total_land)
    const ownedLand = parseLandAmount(form.owned_land)

    if (Number.isNaN(totalLand) || Number.isNaN(ownedLand)) {
      setMessage('জমির পরিমাণ সঠিকভাবে লিখুন। ঋণাত্মক বা ভুল সংখ্যা দেওয়া যাবে না।')
      return
    }

    setSaving(true)
    setMessage('')

    const payload = {
      ...form,
      total_land: totalLand,
      owned_land: ownedLand,
      user_id: session.user.id,
      file_path: editingRecord?.file_path || null
    }

    let savedRecord
    let saveError

    if (editingRecord) {
      const result = await supabase
        .from('land_records')
        .update(payload)
        .eq('id', editingRecord.id)
        .eq('user_id', session.user.id)
        .select()
        .single()

      savedRecord = result.data
      saveError = result.error
    } else {
      const result = await supabase
        .from('land_records')
        .insert(payload)
        .select()
        .single()

      savedRecord = result.data
      saveError = result.error
    }

    if (saveError) {
      setSaving(false)
      setMessage(
        (editingRecord ? 'তথ্য সংশোধন হয়নি: ' : 'তথ্য সংরক্ষণ হয়নি: ') +
        saveError.message
      )
      return
    }

    // প্রথমবার রেকর্ড তৈরি হলে সেটিকে সম্পাদনার রেকর্ড হিসেবে ধরে রাখি।
    // এতে আংশিক ফাইল আপলোড ব্যর্থ হলেও পুনরায় চেষ্টা করলে নতুন রেকর্ড তৈরি হবে না।
    setEditingRecord(savedRecord)

    let uploadedCount = 0
    let uploadErrorMessage = ''

    for (const item of pendingFiles) {
      const file = item.file
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

      const path =
        `${session.user.id}/${savedRecord.id}/${crypto.randomUUID()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false })

      if (uploadError) {
        uploadErrorMessage = `${file.name} আপলোড হয়নি: ${uploadError.message}`
        break
      }

      const { error: insertError } = await supabase
        .from('land_record_files')
        .insert({
          record_id: savedRecord.id,
          user_id: session.user.id,
          category: item.category,
          file_name: file.name,
          file_path: path
        })

      if (insertError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([path])
        uploadErrorMessage = `${file.name} সংরক্ষণ হয়নি: ${insertError.message}`
        break
      }

      uploadedCount++
    }

    if (uploadedCount > 0) {
      setPendingFiles(old => old.slice(uploadedCount))
    }

    await loadRecords()

    if (uploadErrorMessage) {
      setMessage(
        `জমির তথ্য সংরক্ষিত হয়েছে। ${uploadedCount}টি ফাইল যোগ হয়েছে। ` +
        uploadErrorMessage +
        ' বাকি ফাইলগুলো আবার সংরক্ষণ করুন।'
      )
      setSaving(false)
      return
    }

    const wasEditing = Boolean(editingRecord)

    resetForm()

    setMessage(
      wasEditing
        ? 'জমির তথ্য ও ফাইল সফলভাবে সংশোধন/সংরক্ষণ হয়েছে।'
        : 'জমির তথ্য ও ফাইল সফলভাবে সংরক্ষণ হয়েছে।'
    )

    setSaving(false)
  }

  async function downloadFile(path) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60)

    if (error) {
      setMessage('ফাইল খোলা যায়নি: ' + error.message)
    } else {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }
  }

  async function deleteAttachedFile(fileRecord) {
    if (!confirm(`"${fileRecord.file_name}" ফাইলটি মুছে ফেলবেন?`)) return

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([fileRecord.file_path])

    if (storageError) {
      setMessage('Storage থেকে ফাইল মুছতে সমস্যা: ' + storageError.message)
      return
    }

    const { error } = await supabase
      .from('land_record_files')
      .delete()
      .eq('id', fileRecord.id)
      .eq('user_id', session.user.id)

    if (error) {
      setMessage('ফাইলের তথ্য মুছতে সমস্যা: ' + error.message)
    } else {
      setMessage('ফাইল মুছে ফেলা হয়েছে।')
      await loadRecords()
    }
  }

  async function deleteRecord(record) {
    if (!confirm('এই জমির রেকর্ড ও এর সব ফাইল মুছে ফেলবেন?')) return

    const attachedFiles = record.land_record_files || []
    const paths = attachedFiles.map(file => file.file_path)

    if (record.file_path && !paths.includes(record.file_path)) {
      paths.push(record.file_path)
    }

    if (paths.length) {
      const { error: fileError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(paths)

      if (fileError) {
        setMessage('ফাইল মুছতে সমস্যা: ' + fileError.message)
        return
      }
    }

    const { error } = await supabase
      .from('land_records')
      .delete()
      .eq('id', record.id)
      .eq('user_id', session.user.id)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('জমির রেকর্ড ও সংযুক্ত ফাইল মুছে ফেলা হয়েছে।')
      await loadRecords()
    }
  }

  const filtered = useMemo(() => {
    return records.filter(r => {
      const text = [
        r.deed_number,
        r.donor_name,
        r.recipient_name,
        r.mouza,
        r.sheet_number,
        r.dag_number,
        r.khatian_number,
        r.mutation_case_number,
        r.holding_number,
        ...(r.land_record_files || []).map(
          f => `${f.file_name} ${f.category}`
        )
      ].join(' ').toLowerCase()

      return text.includes(query.toLowerCase())
    })
  }, [records, query])

  if (loading) {
    return <div className="center">লোড হচ্ছে...</div>
  }

  if (!session) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <img
            src="/logo.png"
            alt="ভূমিঘর লোগো"
            className="auth-logo"
          />

          <h1>ভূমিঘর</h1>
          <p className="muted">
            আপনার জমির নথি, আপনার নিরাপদ সংরক্ষণে
          </p>

          <form onSubmit={handleAuth}>
            <label>
              ইমেইল
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="আপনার ইমেইল"
              />
            </label>

            <label>
              পাসওয়ার্ড

              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength="6"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                  style={{
                    paddingRight: '46px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  title={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b'
                  }}
                >
                  {showPassword
                    ? <EyeOff size={20} />
                    : <Eye size={20} />}
                </button>
              </div>
            </label>

            <button className="primary full" disabled={authBusy}>
              {authBusy
                ? 'অপেক্ষা করুন...'
                : authMode === 'login'
                  ? 'লগইন করুন'
                  : 'অ্যাকাউন্ট তৈরি করুন'}
            </button>
          </form>

          <button
            className="link-btn"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login')
              setMessage('')
            }}
          >
            {authMode === 'login'
              ? 'নতুন অ্যাকাউন্ট তৈরি করুন'
              : 'আগে অ্যাকাউন্ট আছে? লগইন করুন'}
          </button>

          {message && <p className="notice">{message}</p>}

          <small>Developed by Muktar Graphics</small>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img
            src="/logo.png"
            alt="ভূমিঘর"
            className="topbar-logo"
          />

          <div>
            <b>ভূমিঘর</b>
            <small>BHUMIGHOR</small>
          </div>
        </div>

        <div className="user-actions">
          <span>{session.user.email}</span>

          <button
            className="ghost"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut size={16} /> লগআউট
          </button>
        </div>
      </header>

      <main className="content">
        <section className="welcome">
          <div>
            <p className="eyebrow">আপনার জমির ডিজিটাল নথিঘর</p>
            <h1>জমির তথ্য সংরক্ষণ করুন</h1>
            <p className="muted">
              দলিল, খতিয়ান, নামজারি ও খাজনার কাগজ এক জায়গায় রাখুন।
            </p>
          </div>

          <img
            src="/logo.png"
            alt="ভূমিঘর"
            className="welcome-logo"
          />
        </section>

        {message && (
          <div className="notice">
            {message}
            <button onClick={() => setMessage('')}>
              <X size={15} />
            </button>
          </div>
        )}

        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="দলিল, মৌজা, নাম বা ফাইল দিয়ে খুঁজুন"
            />
          </div>

          <button
            className="primary"
            onClick={() => {
              if (showForm) {
                resetForm()
              } else {
                setForm({ ...emptyForm })
                setEditingRecord(null)
                setPendingFiles([])
                setShowForm(true)
              }
            }}
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'ফর্ম বন্ধ করুন' : 'নতুন জমির তথ্য'}
          </button>
        </div>

        {showForm && (
          <form className="form-card" onSubmit={saveRecord}>
            <div className="form-head">
              <h2>
                {editingRecord ? 'জমির তথ্য সংশোধন' : 'নতুন জমির তথ্য'}
              </h2>

              <button
                type="button"
                className="icon-btn"
                onClick={resetForm}
                disabled={saving}
              >
                <X />
              </button>
            </div>

            <div className="form-grid">
              {Object.entries(labels).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}

              <label>
                দাগের ধরন
                <select
                  value={form.dag_type}
                  onChange={e =>
                    setForm({ ...form, dag_type: e.target.value })
                  }
                >
                  {['CS', 'SA', 'RS', 'RBS'].map(x => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label>
                দাগ নম্বর
                <input
                  value={form.dag_number}
                  onChange={e =>
                    setForm({ ...form, dag_number: e.target.value })
                  }
                  placeholder="দাগ নম্বর লিখুন"
                />
              </label>

              <label>
                খতিয়ানের ধরন
                <select
                  value={form.khatian_type}
                  onChange={e =>
                    setForm({ ...form, khatian_type: e.target.value })
                  }
                >
                  {['CS', 'SA', 'RS', 'RBS'].map(x => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label>
                খতিয়ান নম্বর
                <input
                  value={form.khatian_number}
                  onChange={e =>
                    setForm({ ...form, khatian_number: e.target.value })
                  }
                  placeholder="খতিয়ান নম্বর লিখুন"
                />
              </label>

              <label>
                মোট জমির পরিমাণ
                <input
                  inputMode="decimal"
                  value={form.total_land}
                  onChange={e =>
                    setForm({ ...form, total_land: e.target.value })
                  }
                  placeholder="পরিমাণ লিখুন"
                />
              </label>

              <label>
                মোট জমির একক
                <select
                  value={form.total_land_unit}
                  onChange={e =>
                    setForm({ ...form, total_land_unit: e.target.value })
                  }
                >
                  {landUnits.map(unit => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
              </label>

              <label>
                ক্রয়/নিজস্ব জমির পরিমাণ
                <input
                  inputMode="decimal"
                  value={form.owned_land}
                  onChange={e =>
                    setForm({ ...form, owned_land: e.target.value })
                  }
                  placeholder="পরিমাণ লিখুন"
                />
              </label>

              <label>
                ক্রয়/নিজস্ব জমির একক
                <select
                  value={form.owned_land_unit}
                  onChange={e =>
                    setForm({ ...form, owned_land_unit: e.target.value })
                  }
                >
                  {landUnits.map(unit => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="upload-section">
              <h3>
                <FolderOpen size={19} /> জমির কাগজপত্র সংযুক্ত করুন
              </h3>

              <p className="muted">
                ফাইলের ধরন নির্বাচন করে এক বা একাধিক PDF/JPG/PNG ফাইল যোগ করুন।
              </p>

              <div className="upload-controls">
                <label>
                  ফাইলের ধরন
                  <select
                    value={fileCategory}
                    onChange={e => setFileCategory(e.target.value)}
                    disabled={saving}
                  >
                    {fileCategories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="choose-files">
                  <span>
                    <Upload size={17} /> ফাইল নির্বাচন করুন
                  </span>

                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png"
                    multiple
                    disabled={saving}
                    onChange={addSelectedFiles}
                  />
                </label>
              </div>

              <small className="file-help">
                প্রতিটি ফাইল সর্বোচ্চ ৫০ MB। আপনার Supabase Storage-এর সীমাও প্রযোজ্য।
              </small>

              {pendingFiles.length > 0 && (
                <div className="pending-list">
                  <b>
                    আপলোডের জন্য নির্বাচিত ফাইল ({pendingFiles.length})
                  </b>

                  {pendingFiles.map(item => (
                    <div className="pending-file" key={item.id}>
                      <FileText size={18} />

                      <div>
                        <strong>{item.file.name}</strong>
                        <small>
                          {item.category} · {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                        </small>
                      </div>

                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => removePendingFile(item.id)}
                        title="তালিকা থেকে বাদ দিন"
                        disabled={saving}
                      >
                        <X size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {editingRecord && (
                <small className="file-help">
                  আগের সংরক্ষিত ফাইলগুলো অক্ষত থাকবে। নতুন ফাইল যোগ করতে উপরের অংশ ব্যবহার করুন।
                </small>
              )}
            </div>

            <div className="card-actions">
              <button className="primary" disabled={saving}>
                {saving
                  ? 'তথ্য ও ফাইল সংরক্ষণ হচ্ছে...'
                  : editingRecord
                    ? 'পরিবর্তন সংরক্ষণ করুন'
                    : 'তথ্য সংরক্ষণ করুন'}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={resetForm}
                disabled={saving}
              >
                বাতিল
              </button>
            </div>
          </form>
        )}

        <section className="records">
          <div className="section-title">
            <h2>সংরক্ষিত জমির তথ্য</h2>
            <span>{filtered.length} টি</span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <FileText size={38} />
              <b>এখনো কোনো জমির তথ্য নেই</b>
              <span>নতুন জমির তথ্য বাটনে ক্লিক করে শুরু করুন।</span>
            </div>
          ) : (
            <div className="record-grid">
              {filtered.map(r => {
                const attachedFiles = r.land_record_files || []

                return (
                  <article className="record-card" key={r.id}>
                    <div className="record-icon">
                      <FileText />
                    </div>

                    <h3>
                      {r.deed_number || 'দলিল নম্বর দেওয়া হয়নি'}
                    </h3>

                    <p>
                      {r.mouza || 'মৌজা উল্লেখ নেই'} · {r.donor_name || 'দাতার নাম নেই'}
                    </p>

                    <dl>
                      <div>
                        <dt>গ্রহীতা</dt>
                        <dd>{r.recipient_name || '—'}</dd>
                      </div>

                      <div>
                        <dt>দাগ</dt>
                        <dd>{r.dag_type}-{r.dag_number || '—'}</dd>
                      </div>

                      <div>
                        <dt>খতিয়ান</dt>
                        <dd>{r.khatian_type}-{r.khatian_number || '—'}</dd>
                      </div>

                      <div>
                        <dt>মোট জমি</dt>
                        <dd>
                          {r.total_land ?? '—'} {r.total_land_unit || 'শতক'}
                        </dd>
                      </div>

                      <div>
                        <dt>ক্রয়/নিজস্ব জমি</dt>
                        <dd>
                          {r.owned_land ?? '—'} {r.owned_land_unit || 'শতক'}
                        </dd>
                      </div>
                    </dl>

                    <div className="attached-files">
                      <h4>
                        <FolderOpen size={17} />
                        সংযুক্ত কাগজপত্র ({attachedFiles.length})
                      </h4>

                      {attachedFiles.length === 0 ? (
                        <p className="no-files">
                          এখনো কোনো ফাইল যুক্ত করা হয়নি।
                        </p>
                      ) : (
                        attachedFiles.map(file => (
                          <div className="saved-file" key={file.id}>
                            <FileText size={18} />

                            <div className="saved-file-info">
                              <strong>{file.file_name}</strong>
                              <small>{file.category}</small>
                            </div>

                            <button
                              className="file-action"
                              title="ফাইল দেখুন / ডাউনলোড"
                              onClick={() => downloadFile(file.file_path)}
                            >
                              <Download size={17} />
                            </button>

                            <button
                              className="file-action delete-file"
                              title="ফাইল মুছুন"
                              onClick={() => deleteAttachedFile(file)}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="card-actions">
                      <button
                        className="primary"
                        onClick={() => startEdit(r)}
                      >
                        <Pencil size={16} /> সংশোধন
                      </button>

                      <button
                        className="danger"
                        onClick={() => deleteRecord(r)}
                      >
                        <Trash2 size={16} /> মুছুন
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <footer>Developed by Muktar Graphics</footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)

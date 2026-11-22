
import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, STORAGE_BUCKET } from './supabase'
import {
  Plus, Search, LogOut, FileText, Trash2, Download, X,
  ShieldCheck, Pencil, Upload, FolderOpen, Eye, EyeOff,
  BarChart3, MapPin, Files, LandPlot, Printer
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
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [records, setRecords] = useState([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [previewRecord, setPreviewRecord] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [filePreviewLoading, setFilePreviewLoading] = useState(false)
  const [printRecord, setPrintRecord] = useState(null)
  const [selectedRecordIds, setSelectedRecordIds] = useState([])
  const [importBusy, setImportBusy] = useState(false)

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
      (event, next) => {
        setSession(next)
        if (event === 'PASSWORD_RECOVERY') {
          setAuthMode('reset')
          setMessage('নতুন পাসওয়ার্ড নির্ধারণ করুন।')
        }
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!printRecord) return

    const timer = window.setTimeout(() => window.print(), 350)
    const handleAfterPrint = () => setPrintRecord(null)
    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printRecord])

  const csvColumns = [
    'deed_number', 'donor_name', 'recipient_name', 'mouza', 'sheet_number',
    'dag_type', 'dag_number', 'khatian_type', 'khatian_number',
    'mutation_case_number', 'holding_number', 'total_land', 'owned_land',
    'total_land_unit', 'owned_land_unit'
  ]

  function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }

  function exportRecordsCsv() {
    if (!records.length) {
      setMessage('এক্সপোর্ট করার মতো কোনো জমির তথ্য নেই।')
      return
    }

    const rows = [csvColumns, ...records.map(record => csvColumns.map(key => record[key] ?? ''))]
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bhumighor-land-records-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage(`${records.length}টি জমির তথ্য CSV ফাইলে এক্সপোর্ট হয়েছে। Excel-এ ফাইলটি খোলা যাবে।`)
  }

  function parseCsv(text) {
    const rows = []
    let row = []
    let cell = ''
    let quoted = false

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i]
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else if (char === '"') {
          quoted = false
        } else {
          cell += char
        }
      } else if (char === '"') {
        quoted = true
      } else if (char === ',') {
        row.push(cell)
        cell = ''
      } else if (char === '\n') {
        row.push(cell.replace(/\r$/, ''))
        if (row.some(value => value.trim() !== '')) rows.push(row)
        row = []
        cell = ''
      } else {
        cell += char
      }
    }

    row.push(cell.replace(/\r$/, ''))
    if (row.some(value => value.trim() !== '')) rows.push(row)
    return rows
  }

  async function importRecordsCsv(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage('অনুগ্রহ করে ভূমিঘর থেকে Export করা CSV ফাইল নির্বাচন করুন।')
      return
    }

    setImportBusy(true)
    setMessage('')

    try {
      const content = (await file.text()).replace(/^\uFEFF/, '')
      const rows = parseCsv(content)
      if (rows.length < 2) throw new Error('ফাইলে আমদানি করার মতো কোনো তথ্য নেই।')

      const headers = rows[0].map(value => value.trim())
      const missing = csvColumns.filter(column => !headers.includes(column))
      if (missing.length) {
        throw new Error('এই CSV ফাইলটি ভূমিঘরের Export করা ফাইল নয় অথবা প্রয়োজনীয় কলাম নেই।')
      }

      const imported = rows.slice(1).map((values, index) => {
        const item = {}
        csvColumns.forEach(column => {
          const value = values[headers.indexOf(column)] ?? ''
          item[column] = value.trim()
        })
        item.total_land = item.total_land === '' ? null : parseLandAmount(item.total_land)
        item.owned_land = item.owned_land === '' ? null : parseLandAmount(item.owned_land)
        if ((item.total_land !== null && !Number.isFinite(item.total_land)) ||
            (item.owned_land !== null && !Number.isFinite(item.owned_land))) {
          throw new Error(`CSV ফাইলের ${index + 2} নম্বর সারিতে জমির পরিমাণ ভুল আছে।`)
        }
        if (!landUnits.includes(item.total_land_unit)) item.total_land_unit = 'শতক'
        if (!landUnits.includes(item.owned_land_unit)) item.owned_land_unit = 'শতক'
        item.user_id = session.user.id
        item.file_path = null
        return item
      }).filter(item => csvColumns.some(column => String(item[column] ?? '').trim() !== ''))

      if (!imported.length) throw new Error('ফাইলে কোনো বৈধ জমির তথ্য পাওয়া যায়নি।')

      for (let i = 0; i < imported.length; i += 50) {
        const { error } = await supabase.from('land_records').insert(imported.slice(i, i + 50))
        if (error) throw error
      }

      await loadRecords()
      setMessage(`সফলভাবে ${imported.length}টি জমির তথ্য Import হয়েছে। সংযুক্ত PDF/ছবি ফাইলগুলো আলাদাভাবে আপলোড করতে হবে।`)
    } catch (error) {
      setMessage('Import করা যায়নি: ' + (error.message || 'অজানা সমস্যা'))
    } finally {
      setImportBusy(false)
    }
  }

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

  async function handleForgotPassword(e) {
    e.preventDefault()
    setAuthBusy(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/` }
    )

    setAuthBusy(false)

    if (error) {
      setMessage('রিসেট লিংক পাঠানো যায়নি: ' + error.message)
    } else {
      setMessage('পাসওয়ার্ড পরিবর্তনের লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইনবক্স ও Spam ফোল্ডার দেখুন।')
    }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault()

    if (newPassword.length < 6) {
      setMessage('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।')
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage('দুটি পাসওয়ার্ড মিলছে না। আবার লিখুন।')
      return
    }

    setAuthBusy(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    setAuthBusy(false)

    if (error) {
      setMessage('পাসওয়ার্ড পরিবর্তন করা যায়নি: ' + error.message)
      return
    }

    await supabase.auth.signOut()
    setAuthMode('login')
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setMessage('আপনার পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।')
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

  async function openFilePreview(file) {
    setFilePreviewLoading(true)
    setFilePreview(null)

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(file.file_path, 300)

    setFilePreviewLoading(false)

    if (error) {
      setMessage('ফাইল প্রিভিউ খোলা যায়নি: ' + error.message)
      return
    }

    const name = (file.file_name || '').toLowerCase()
    const kind = name.endsWith('.pdf') ? 'pdf' :
      (/\.(jpg|jpeg|png|webp|gif)$/i.test(name) ? 'image' : 'unsupported')

    setFilePreview({ ...file, url: data.signedUrl, kind })
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

  const dashboardStats = useMemo(() => {
    const sumByUnit = (amountField, unitField) => {
      const totals = {}

      records.forEach(record => {
        const amount = parseLandAmount(record[amountField])
        if (amount === null || Number.isNaN(amount)) return

        const unit = record[unitField] || 'শতক'
        totals[unit] = (totals[unit] || 0) + amount
      })

      const entries = Object.entries(totals)
      if (!entries.length) return 'তথ্য দেওয়া হয়নি'

      return entries
        .map(([unit, total]) => `${total.toLocaleString('bn-BD', { maximumFractionDigits: 2 })} ${unit}`)
        .join(' · ')
    }

    const mouzas = new Set(
      records
        .map(record => (record.mouza || '').trim().toLocaleLowerCase())
        .filter(Boolean)
    )

    return {
      recordCount: records.length,
      totalLand: sumByUnit('total_land', 'total_land_unit'),
      ownedLand: sumByUnit('owned_land', 'owned_land_unit'),
      fileCount: records.reduce(
        (count, record) => count + (record.land_record_files || []).length,
        0
      ),
      mouzaCount: mouzas.size
    }
  }, [records])

  const chartStats = useMemo(() => {
    const totalByUnit = {}
    const ownedByUnit = {}
    const mouzaCounts = {}
    const categoryCounts = {}

    records.forEach(record => {
      const total = parseLandAmount(record.total_land)
      const owned = parseLandAmount(record.owned_land)
      const totalUnit = record.total_land_unit || 'শতক'
      const ownedUnit = record.owned_land_unit || 'শতক'

      if (total !== null && !Number.isNaN(total)) {
        totalByUnit[totalUnit] = (totalByUnit[totalUnit] || 0) + total
      }
      if (owned !== null && !Number.isNaN(owned)) {
        ownedByUnit[ownedUnit] = (ownedByUnit[ownedUnit] || 0) + owned
      }

      const mouza = (record.mouza || '').trim()
      if (mouza) mouzaCounts[mouza] = (mouzaCounts[mouza] || 0) + 1

      ;(record.land_record_files || []).forEach(file => {
        const category = file.category || 'অন্যান্য কাগজপত্র'
        categoryCounts[category] = (categoryCounts[category] || 0) + 1
      })
    })

    const units = ['শতক', 'কাঠা', 'বিঘা', 'একর']
    const landRows = units
      .filter(unit => totalByUnit[unit] || ownedByUnit[unit])
      .map(unit => ({
        unit,
        total: totalByUnit[unit] || 0,
        owned: ownedByUnit[unit] || 0
      }))
    const maxLand = Math.max(0, ...landRows.flatMap(row => [row.total, row.owned]))
    const topMouzas = Object.entries(mouzaCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'bn'))
      .slice(0, 5)
    const maxMouza = Math.max(0, ...topMouzas.map(item => item.count))
    const categories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    const maxCategory = Math.max(0, ...categories.map(item => item.count))

    return { landRows, maxLand, topMouzas, maxMouza, categories, maxCategory }
  }, [records])

  if (loading) {
    return <div className="center">লোড হচ্ছে...</div>
  }

  if (!session || authMode === 'reset') {
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

          <form
            onSubmit={
              authMode === 'forgot'
                ? handleForgotPassword
                : authMode === 'reset'
                  ? handlePasswordUpdate
                  : handleAuth
            }
          >
            {authMode !== 'reset' && <label>
              ইমেইল
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="আপনার ইমেইল"
              />
            </label>}

            {authMode === 'login' || authMode === 'signup' ? (
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
            ) : null}

            {authMode === 'reset' && (
              <>
                <label>
                  নতুন পাসওয়ার্ড
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength="6"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                      style={{
                        paddingRight: '46px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(value => !value)}
                      aria-label={showNewPassword ? 'নতুন পাসওয়ার্ড লুকান' : 'নতুন পাসওয়ার্ড দেখুন'}
                      title={showNewPassword ? 'নতুন পাসওয়ার্ড লুকান' : 'নতুন পাসওয়ার্ড দেখুন'}
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
                      {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </label>

                <label>
                  নতুন পাসওয়ার্ড আবার লিখুন
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength="6"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ড নিশ্চিত করুন"
                      style={{
                        paddingRight: '46px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(value => !value)}
                      aria-label={showConfirmPassword ? 'নিশ্চিতকরণ পাসওয়ার্ড লুকান' : 'নিশ্চিতকরণ পাসওয়ার্ড দেখুন'}
                      title={showConfirmPassword ? 'নিশ্চিতকরণ পাসওয়ার্ড লুকান' : 'নিশ্চিতকরণ পাসওয়ার্ড দেখুন'}
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
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </label>
              </>
            )}

            <button className="primary full" disabled={authBusy}>
              {authBusy
                ? 'অপেক্ষা করুন...'
                : authMode === 'login'
                  ? 'লগইন করুন'
                  : authMode === 'signup'
                    ? 'অ্যাকাউন্ট তৈরি করুন'
                    : authMode === 'forgot'
                      ? 'রিসেট লিংক পাঠান'
                      : 'নতুন পাসওয়ার্ড সংরক্ষণ করুন'}
            </button>
          </form>

          {authMode === 'login' && (
            <>
              <button
                className="link-btn"
                onClick={() => {
                  setAuthMode('forgot')
                  setMessage('')
                }}
              >
                পাসওয়ার্ড ভুলে গেছেন?
              </button>

              <button
                className="link-btn"
                onClick={() => {
                  setAuthMode('signup')
                  setMessage('')
                }}
              >
                নতুন অ্যাকাউন্ট তৈরি করুন
              </button>
            </>
          )}

          {authMode === 'signup' && (
            <button
              className="link-btn"
              onClick={() => {
                setAuthMode('login')
                setMessage('')
              }}
            >
              আগে অ্যাকাউন্ট আছে? লগইন করুন
            </button>
          )}

          {authMode === 'forgot' && (
            <button
              className="link-btn"
              onClick={() => {
                setAuthMode('login')
                setMessage('')
              }}
            >
              লগইন পেজে ফিরে যান
            </button>
          )}

          {authMode === 'reset' && (
            <button
              className="link-btn"
              onClick={() => {
                setAuthMode('login')
                setNewPassword('')
                setConfirmPassword('')
                setMessage('')
                supabase.auth.signOut()
              }}
            >
              লগইন পেজে ফিরে যান
            </button>
          )}

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

        <section style={{ margin: '22px 0 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
            <BarChart3 size={21} color="#17613d" />
            <h2 style={{ margin: 0, color: '#174b34', fontSize: '21px' }}>জমির সারসংক্ষেপ</h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '13px'
          }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8df', borderRadius: '15px', padding: '17px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '9px' }}>
                <LandPlot size={19} color="#17613d" />
                <span>মোট জমির রেকর্ড</span>
              </div>
              <strong style={{ display: 'block', fontSize: '27px', color: '#174b34' }}>{dashboardStats.recordCount.toLocaleString('bn-BD')}</strong>
              <small style={{ color: '#64748b' }}>টি জমির তথ্য</small>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8df', borderRadius: '15px', padding: '17px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '9px' }}>
                <LandPlot size={19} color="#17613d" />
                <span>মোট জমির পরিমাণ</span>
              </div>
              <strong style={{ display: 'block', fontSize: '18px', lineHeight: 1.7, color: '#174b34', overflowWrap: 'anywhere' }}>{dashboardStats.totalLand}</strong>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8df', borderRadius: '15px', padding: '17px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '9px' }}>
                <LandPlot size={19} color="#17613d" />
                <span>ক্রয়/নিজস্ব জমি</span>
              </div>
              <strong style={{ display: 'block', fontSize: '18px', lineHeight: 1.7, color: '#174b34', overflowWrap: 'anywhere' }}>{dashboardStats.ownedLand}</strong>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8df', borderRadius: '15px', padding: '17px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '9px' }}>
                <Files size={19} color="#17613d" />
                <span>সংযুক্ত কাগজপত্র</span>
              </div>
              <strong style={{ display: 'block', fontSize: '27px', color: '#174b34' }}>{dashboardStats.fileCount.toLocaleString('bn-BD')}</strong>
              <small style={{ color: '#64748b' }}>টি ফাইল</small>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8df', borderRadius: '15px', padding: '17px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '9px' }}>
                <MapPin size={19} color="#17613d" />
                <span>মোট মৌজা</span>
              </div>
              <strong style={{ display: 'block', fontSize: '27px', color: '#174b34' }}>{dashboardStats.mouzaCount.toLocaleString('bn-BD')}</strong>
              <small style={{ color: '#64748b' }}>টি আলাদা মৌজা</small>
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '15px', margin: '0 0 26px' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8df', borderRadius: '16px', padding: '18px', minWidth: 0 }}>
            <h3 style={{ margin: '0 0 6px', color: '#174b34', fontSize: '17px' }}>একক অনুযায়ী জমির পরিমাণ</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '12px' }}>প্রতিটি এককের হিসাব আলাদাভাবে দেখানো হয়েছে</p>
            {chartStats.landRows.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>জমির পরিমাণের তথ্য পাওয়া যায়নি।</p>
            ) : (
              <div style={{ display: 'grid', gap: '15px' }}>
                {chartStats.landRows.map(row => (
                  <div key={row.unit}>
                    <strong style={{ display: 'block', color: '#334155', fontSize: '13px', marginBottom: '7px' }}>{row.unit}</strong>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: '#64748b', fontSize: '11px', marginBottom: '3px' }}><span>মোট জমি</span><span>{row.total.toLocaleString('bn-BD', { maximumFractionDigits: 2 })} {row.unit}</span></div>
                        <div style={{ height: '9px', background: '#edf2ed', borderRadius: '20px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(row.total, row.owned) ? Math.max(row.total > 0 ? 2 : 0, row.total / Math.max(row.total, row.owned) * 100) : 0}%`, background: '#17613d', borderRadius: '20px' }} /></div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: '#64748b', fontSize: '11px', marginBottom: '3px' }}><span>ক্রয়/নিজস্ব</span><span>{row.owned.toLocaleString('bn-BD', { maximumFractionDigits: 2 })} {row.unit}</span></div>
                        <div style={{ height: '9px', background: '#edf2ed', borderRadius: '20px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(row.total, row.owned) ? Math.max(row.owned > 0 ? 2 : 0, row.owned / Math.max(row.total, row.owned) * 100) : 0}%`, background: '#c49a3a', borderRadius: '20px' }} /></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '17px', fontSize: '11px', color: '#64748b' }}>
              <span><i style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '3px', background: '#17613d', marginRight: '5px' }} />মোট জমি</span>
              <span><i style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '3px', background: '#c49a3a', marginRight: '5px' }} />ক্রয়/নিজস্ব</span>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8df', borderRadius: '16px', padding: '18px', minWidth: 0 }}>
            <h3 style={{ margin: '0 0 6px', color: '#174b34', fontSize: '17px' }}>মৌজা অনুযায়ী জমির রেকর্ড</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '12px' }}>সর্বাধিক রেকর্ড থাকা ৫টি মৌজা</p>
            {chartStats.topMouzas.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>মৌজার তথ্য পাওয়া যায়নি।</p>
            ) : (
              <div style={{ display: 'grid', gap: '14px' }}>
                {chartStats.topMouzas.map(item => (
                  <div key={item.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '5px', fontSize: '13px' }}><strong style={{ color: '#334155', overflowWrap: 'anywhere' }}>{item.name}</strong><span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{item.count.toLocaleString('bn-BD')} টি</span></div>
                    <div style={{ height: '11px', background: '#edf2ed', borderRadius: '20px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${chartStats.maxMouza ? Math.max(2, item.count / chartStats.maxMouza * 100) : 0}%`, background: '#17613d', borderRadius: '20px' }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8df', borderRadius: '16px', padding: '18px', minWidth: 0 }}>
            <h3 style={{ margin: '0 0 6px', color: '#174b34', fontSize: '17px' }}>কাগজপত্রের ধরন অনুযায়ী</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '12px' }}>আপনার সংরক্ষিত ফাইলের শ্রেণিবিভাগ</p>
            {chartStats.categories.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>কোনো সংযুক্ত কাগজপত্র পাওয়া যায়নি।</p>
            ) : (
              <div style={{ display: 'grid', gap: '13px' }}>
                {chartStats.categories.map(item => (
                  <div key={item.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '5px', fontSize: '13px' }}><strong style={{ color: '#334155', overflowWrap: 'anywhere' }}>{item.name}</strong><span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{item.count.toLocaleString('bn-BD')} টি</span></div>
                    <div style={{ height: '10px', background: '#edf2ed', borderRadius: '20px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${chartStats.maxCategory ? Math.max(2, item.count / chartStats.maxCategory * 100) : 0}%`, background: '#c49a3a', borderRadius: '20px' }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <div className="section-title" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <h2>সংরক্ষিত জমির তথ্য</h2>
            <span>{filtered.length} টি</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '0 0 14px', padding: '12px', border: '1px solid #d5e4da', borderRadius: '10px', background: '#f5faf6' }}>
            <button type="button" className="primary" onClick={exportRecordsCsv} disabled={!records.length}>
              <Download size={16} /> Excel/CSV Export
            </button>
            <button type="button" className="ghost" onClick={() => document.getElementById('bhumighor-csv-import')?.click()} disabled={importBusy}>
              <Upload size={16} /> {importBusy ? 'Import হচ্ছে...' : 'CSV Import'}
            </button>
            <input id="bhumighor-csv-import" type="file" accept=".csv,text/csv" onChange={importRecordsCsv} style={{ display: 'none' }} />
            <small style={{ alignSelf: 'center', color: '#52645a' }}>Excel-এ খোলা যায় এমন CSV ফরম্যাট। Import করলে নতুন রেকর্ড যুক্ত হবে; আগের তথ্য মুছবে না।</small>
          </div>
          {filtered.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '12px', marginBottom: '14px', border: '1px solid #d5e4da', borderRadius: '10px', background: '#f5faf6' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selectedRecordIds.includes(r.id))}
                  onChange={e => setSelectedRecordIds(e.target.checked ? filtered.map(r => r.id) : [])} />
                সবগুলো নির্বাচন করুন
              </label>
              <span style={{ color: '#52645a' }}>নির্বাচিত: {selectedRecordIds.filter(id => filtered.some(r => r.id === id)).length} টি</span>
              <button type="button" className="primary" disabled={!selectedRecordIds.some(id => filtered.some(r => r.id === id))}
                onClick={() => setPrintRecord(filtered.filter(r => selectedRecordIds.includes(r.id)))}>
                <Printer size={16} /> নির্বাচিত জমির সম্মিলিত PDF / প্রিন্ট
              </button>
            </div>
          )}

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
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: 600 }}>
                      <input type="checkbox" checked={selectedRecordIds.includes(r.id)}
                        onChange={e => setSelectedRecordIds(current => e.target.checked ? [...current, r.id] : current.filter(id => id !== r.id))} />
                      PDF রিপোর্টের জন্য নির্বাচন করুন
                    </label>
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
                              title="প্রিভিউ দেখুন"
                              onClick={() => openFilePreview(file)}
                            >
                              <Eye size={17} />
                            </button>

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
                        type="button"
                        className="ghost"
                        onClick={() => setPreviewRecord(r)}
                      >
                        <Eye size={16} /> সম্পূর্ণ তথ্য দেখুন
                      </button>

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

                    <div style={{ marginTop: '10px', width: '100%' }}>
                      <button
                        type="button"
                        onClick={() => setPrintRecord([r])}
                        aria-label="জমির তথ্য PDF তৈরি বা প্রিন্ট করুন"
                        style={{
                          width: '100%',
                          minHeight: '42px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '10px 14px',
                          border: '1px solid #17613d',
                          borderRadius: '9px',
                          background: '#17613d',
                          color: '#ffffff',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxSizing: 'border-box'
                        }}
                      >
                        <Printer size={17} /> PDF তৈরি / প্রিন্ট
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {previewRecord && (
          <div
            role="presentation"
            onClick={e => {
              if (e.target === e.currentTarget) setPreviewRecord(null)
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.58)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              overflowY: 'auto'
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label="সম্পূর্ণ জমির তথ্য"
              style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#fff',
                borderRadius: '16px',
                padding: '22px',
                boxShadow: '0 20px 60px rgba(0,0,0,.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>সম্পূর্ণ জমির তথ্য</h2>
                <button type="button" className="ghost" onClick={() => setPreviewRecord(null)} aria-label="বন্ধ করুন">
                  <X size={20} />
                </button>
              </div>

              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', margin: 0 }}>
                {[
                  ['দলিল নম্বর', previewRecord.deed_number],
                  ['দাতার নাম', previewRecord.donor_name],
                  ['গ্রহীতার নাম', previewRecord.recipient_name],
                  ['মৌজা', previewRecord.mouza],
                  ['সীট নম্বর', previewRecord.sheet_number],
                  ['দাগের ধরন', previewRecord.dag_type],
                  ['দাগ নম্বর', previewRecord.dag_number],
                  ['খতিয়ানের ধরন', previewRecord.khatian_type],
                  ['খতিয়ান নম্বর', previewRecord.khatian_number],
                  ['নামজারি কেস নম্বর', previewRecord.mutation_case_number],
                  ['হোল্ডিং নম্বর', previewRecord.holding_number],
                  ['মোট জমি', `${previewRecord.total_land ?? '—'} ${previewRecord.total_land_unit || 'শতক'}`],
                  ['ক্রয়/নিজস্ব জমি', `${previewRecord.owned_land ?? '—'} ${previewRecord.owned_land_unit || 'শতক'}`]
                ].map(([label, value]) => (
                  <div key={label} style={{ background: '#f5f8f4', borderRadius: '10px', padding: '12px' }}>
                    <dt style={{ color: '#64748b', fontSize: '13px', marginBottom: '5px' }}>{label}</dt>
                    <dd style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{value === null || value === undefined || value === '' ? '—' : value}</dd>
                  </div>
                ))}
              </dl>

              <div style={{ marginTop: '18px' }}>
                <h3 style={{ marginBottom: '10px' }}>সংযুক্ত কাগজপত্র ({(previewRecord.land_record_files || []).length})</h3>
                {(previewRecord.land_record_files || []).length === 0 ? (
                  <p>কোনো কাগজপত্র সংযুক্ত নেই।</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(previewRecord.land_record_files || []).map(file => (
                      <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                        <FileText size={18} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{file.file_name}</strong>
                          <small>{file.category}</small>
                        </div>
                        <button type="button" className="file-action" title="প্রিভিউ দেখুন" onClick={() => openFilePreview(file)}>
                          <Eye size={17} />
                        </button>
                        <button type="button" className="file-action" title="ফাইল ডাউনলোড" onClick={() => downloadFile(file.file_path)}>
                          <Download size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '18px' }}>
                <button type="button" className="primary" onClick={() => setPrintRecord([previewRecord])}>
                  <Printer size={16} /> PDF তৈরি / প্রিন্ট
                </button>
                <button type="button" className="ghost" onClick={() => setPreviewRecord(null)}>বন্ধ করুন</button>
              </div>
            </section>
          </div>
        )}

        <style>{`
          #bhumighor-print-report, .report-summary { display: none; }
          @media print {
            @page { size: A4; margin: 16mm; }
            html, body, #root { background: #fff !important; min-height: 0 !important; }
            body * { visibility: hidden !important; }
            #bhumighor-print-report, #bhumighor-print-report * { visibility: visible !important; }
            .print-record-page { break-before: page; page-break-before: always; }
            .report-summary { break-after: page; page-break-after: always; }
            #bhumighor-print-report {
              display: block !important; position: absolute !important; left: 0 !important; top: 0 !important;
              width: 100% !important; color: #172b22 !important; background: #fff !important;
              font-family: "Noto Sans Bengali", "SolaimanLipi", Arial, sans-serif !important;
              font-size: 12px !important; line-height: 1.65 !important;
            }
            #bhumighor-print-report .report-header { text-align: center; border-bottom: 2px solid #17613d; padding-bottom: 12px; margin-bottom: 16px; }
            #bhumighor-print-report .report-logo { width: 76px; height: 76px; object-fit: contain; margin: 0 auto 6px; }
            #bhumighor-print-report h1 { color: #17613d !important; font-size: 24px !important; margin: 0; }
            #bhumighor-print-report h2 { color: #17613d !important; font-size: 16px !important; margin: 18px 0 8px; }
            #bhumighor-print-report .report-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 16px; }
            #bhumighor-print-report .report-field { border-bottom: 1px solid #d9e3dc; padding: 5px 0; break-inside: avoid; }
            #bhumighor-print-report .report-label { display: block; color: #52645a !important; font-size: 10px !important; }
            #bhumighor-print-report .report-value { display: block; font-weight: 600; overflow-wrap: anywhere; }
            #bhumighor-print-report .report-files { width: 100%; border-collapse: collapse; }
            #bhumighor-print-report .report-files th, #bhumighor-print-report .report-files td { border: 1px solid #cbd5ce; padding: 6px; text-align: left; }
            #bhumighor-print-report .report-files th { background: #eef4ef !important; }
            #bhumighor-print-report .report-footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #d9e3dc; font-size: 10px !important; text-align: center; }
            #bhumighor-print-report .signature-row { display: flex; justify-content: space-between; gap: 35px; margin-top: 48px; }
            #bhumighor-print-report .signature { width: 42%; border-top: 1px solid #64748b; text-align: center; padding-top: 5px; }
          }
        `}</style>

        {printRecord && (
          <>
            {printRecord.length > 1 && (
              <div id="bhumighor-print-report" className="report-summary">
                <header className="report-header">
                  <img src="/logo.png" alt="ভূমিঘর লোগো" className="report-logo" />
                  <h1>ভূমিঘর</h1>
                  <div>একাধিক জমির সম্মিলিত প্রতিবেদন</div>
                </header>
                <p>প্রতিবেদন তৈরির তারিখ: {new Date().toLocaleDateString('bn-BD')}</p>
                <h2>সারসংক্ষেপ</h2>
                <p>মোট নির্বাচিত জমির রেকর্ড: {printRecord.length.toLocaleString('bn-BD')} টি</p>
                <p>মোট সংযুক্ত কাগজপত্র: {printRecord.reduce((sum, r) => sum + (r.land_record_files || []).length, 0).toLocaleString('bn-BD')} টি</p>
                <table className="report-files"><thead><tr><th>ক্রমিক</th><th>দলিল নম্বর</th><th>মৌজা</th><th>মোট জমি</th><th>ক্রয়/নিজস্ব জমি</th></tr></thead>
                  <tbody>{printRecord.map((r, i) => <tr key={r.id}><td>{(i + 1).toLocaleString('bn-BD')}</td><td>{r.deed_number || '—'}</td><td>{r.mouza || '—'}</td><td>{r.total_land ?? '—'} {r.total_land_unit || 'শতক'}</td><td>{r.owned_land ?? '—'} {r.owned_land_unit || 'শতক'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {printRecord.map((record, recordIndex) => (
              <article id="bhumighor-print-report" className="print-record-page" key={record.id}>
                <header className="report-header">
                  <img src="/logo.png" alt="ভূমিঘর লোগো" className="report-logo" />
                  <h1>ভূমিঘর</h1>
                  <div>জমির তথ্যের প্রতিবেদন {printRecord.length > 1 ? `(${(recordIndex + 1).toLocaleString('bn-BD')} / ${printRecord.length.toLocaleString('bn-BD')})` : ''}</div>
                </header>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <span>প্রতিবেদন তৈরির তারিখ: {new Date().toLocaleDateString('bn-BD')}</span>
                  <span>রেকর্ড: {record.deed_number || 'দলিল নম্বর নেই'}</span>
                </div>
                <h2>জমির সম্পূর্ণ বিবরণ</h2>
                <div className="report-grid">
                  {[
                    ['দলিল নম্বর', record.deed_number], ['দাতার নাম', record.donor_name], ['গ্রহীতার নাম', record.recipient_name],
                    ['মৌজা', record.mouza], ['সীট নম্বর', record.sheet_number], ['দাগের ধরন', record.dag_type], ['দাগ নম্বর', record.dag_number],
                    ['খতিয়ানের ধরন', record.khatian_type], ['খতিয়ান নম্বর', record.khatian_number], ['নামজারি কেস নম্বর', record.mutation_case_number],
                    ['হোল্ডিং নম্বর', record.holding_number], ['মোট জমি', `${record.total_land ?? '—'} ${record.total_land_unit || 'শতক'}`],
                    ['ক্রয়/নিজস্ব জমি', `${record.owned_land ?? '—'} ${record.owned_land_unit || 'শতক'}`]
                  ].map(([label, value]) => <div className="report-field" key={label}><span className="report-label">{label}</span><span className="report-value">{value === null || value === undefined || value === '' ? '—' : value}</span></div>)}
                </div>
                <h2>সংযুক্ত কাগজপত্র ({(record.land_record_files || []).length}টি)</h2>
                {(record.land_record_files || []).length === 0 ? <p>কোনো কাগজপত্র সংযুক্ত নেই।</p> : (
                  <table className="report-files"><thead><tr><th>ক্রমিক</th><th>কাগজপত্রের ধরন</th><th>ফাইলের নাম</th></tr></thead>
                    <tbody>{(record.land_record_files || []).map((file, index) => <tr key={file.id}><td>{(index + 1).toLocaleString('bn-BD')}</td><td>{file.category || 'অন্যান্য কাগজপত্র'}</td><td>{file.file_name}</td></tr>)}</tbody>
                  </table>
                )}
                <div className="signature-row"><div className="signature">তথ্য প্রদানকারীর স্বাক্ষর</div><div className="signature">যাচাইকারীর স্বাক্ষর</div></div>
                <footer className="report-footer">এই প্রতিবেদনটি ভূমিঘর অ্যাপে সংরক্ষিত ব্যবহারকারীর দেওয়া তথ্যের ভিত্তিতে তৈরি। এটি কোনো সরকারি খতিয়ান, দলিল বা প্রত্যয়িত নথির বিকল্প নয়।<br />Developed by Muktar Graphics</footer>
              </article>
            ))}
          </>
        )}

        {filePreviewLoading && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', padding: '22px 28px', borderRadius: '12px' }}>ফাইল প্রস্তুত হচ্ছে...</div>
          </div>
        )}

        {filePreview && (
          <div
            role="presentation"
            onClick={e => { if (e.target === e.currentTarget) setFilePreview(null) }}
            style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,.72)', display: 'flex', flexDirection: 'column', padding: '12px', gap: '10px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', color: '#fff' }}>
              <strong style={{ overflowWrap: 'anywhere' }}>{filePreview.file_name}</strong>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button type="button" className="primary" onClick={() => downloadFile(filePreview.file_path)}><Download size={16} /> ডাউনলোড</button>
                <button type="button" className="ghost" style={{ color: '#fff', borderColor: '#fff' }} onClick={() => setFilePreview(null)}><X size={20} /> বন্ধ</button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: '10px', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {filePreview.kind === 'pdf' ? (
                <iframe title={filePreview.file_name} src={filePreview.url} style={{ width: '100%', height: '100%', minHeight: '70vh', border: 0 }} />
              ) : filePreview.kind === 'image' ? (
                <img src={filePreview.url} alt={filePreview.file_name} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ padding: '30px', textAlign: 'center' }}>
                  <FileText size={42} />
                  <p>এই ফাইলের ধরন সরাসরি প্রিভিউ করা যাচ্ছে না। ডাউনলোড করে খুলুন।</p>
                </div>
              )}
            </div>
          </div>
        )}

        <footer>Developed by Muktar Graphics</footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)

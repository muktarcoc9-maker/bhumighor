
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, STORAGE_BUCKET } from './supabase'
import {
  Plus, Search, LogOut, FileText, Trash2, Download, X,
  ShieldCheck, Pencil, Upload, FolderOpen, Eye, EyeOff,
  BarChart3, Files, LandPlot, Printer
} from 'lucide-react'
import './style.css'

const emptyForm = {
  deed_number: '',
  deed_date: '',
  donor_name: '',
  recipient_name: '',
  mouza: '',
  sheet_number: '',
  dag_type: 'CS',
  dag_number: '',
  khatian_type: 'CS',
  khatian_number: '',
  mutation_case_number: '',
  mutation_case_date: '',
  holding_number: '',
  holding_date: '',
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
  const [activePage, setActivePage] = useState('dashboard')
  const [profileName, setProfileName] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [profileAvatarPath, setProfileAvatarPath] = useState('')
  const [profilePhotoFile, setProfilePhotoFile] = useState(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [changeNewPassword, setChangeNewPassword] = useState('')
  const [changeConfirmPassword, setChangeConfirmPassword] = useState('')
  const [passwordChangeBusy, setPasswordChangeBusy] = useState(false)
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('')
  const [mapPoints, setMapPoints] = useState([])
  const [mapStatus, setMapStatus] = useState('ম্যাপ প্রস্তুত হচ্ছে...')
  const [mouzaMapFile, setMouzaMapFile] = useState(null)
  const [selectedMapRecordId, setSelectedMapRecordId] = useState('')
  const [savedMapFilePath, setSavedMapFilePath] = useState(null)
  const [mapSaving, setMapSaving] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const [removeSavedMapFile, setRemoveSavedMapFile] = useState(false)

  const [pendingFiles, setPendingFiles] = useState([])
  const [fileCategory, setFileCategory] = useState('জমির দলিল')
  const [mapAttachmentFile, setMapAttachmentFile] = useState(null)

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
    if (!session?.user) return
    const metadata = session.user.user_metadata || {}
    setProfileName(metadata.full_name || metadata.name || '')
    const avatarPath = metadata.avatar_path || ''
    setProfileAvatarPath(avatarPath)
    setProfileAvatarUrl('')
    if (avatarPath) {
      supabase.storage.from(STORAGE_BUCKET).createSignedUrl(avatarPath, 60 * 60)
        .then(({ data, error }) => {
          if (!error && data?.signedUrl) setProfileAvatarUrl(data.signedUrl)
        })
    }
  }, [session?.user?.id])

  async function changeAccountPassword(e) {
    e.preventDefault()
    if (!session?.user?.email) return
    if (!currentPassword || !changeNewPassword || !changeConfirmPassword) {
      setPasswordChangeMessage('সবগুলো ঘর পূরণ করুন।')
      return
    }
    if (changeNewPassword.length < 6) {
      setPasswordChangeMessage('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।')
      return
    }
    if (changeNewPassword !== changeConfirmPassword) {
      setPasswordChangeMessage('নতুন পাসওয়ার্ড ও নিশ্চিতকরণ পাসওয়ার্ড মিলছে না।')
      return
    }
    if (currentPassword === changeNewPassword) {
      setPasswordChangeMessage('নতুন পাসওয়ার্ডটি পুরোনো পাসওয়ার্ড থেকে আলাদা দিন।')
      return
    }

    setPasswordChangeBusy(true)
    setPasswordChangeMessage('')
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword
      })
      if (verifyError) throw new Error('পুরোনো পাসওয়ার্ড সঠিক নয়।')

      const { error: updateError } = await supabase.auth.updateUser({ password: changeNewPassword })
      if (updateError) throw updateError

      setCurrentPassword('')
      setChangeNewPassword('')
      setChangeConfirmPassword('')
      setPasswordChangeMessage('আপনার পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।')
    } catch (error) {
      setPasswordChangeMessage('পাসওয়ার্ড পরিবর্তন করা যায়নি: ' + (error.message || 'অজানা সমস্যা'))
    } finally {
      setPasswordChangeBusy(false)
    }
  }

  async function saveProfile(e) {
    e.preventDefault()
    if (!session?.user) return
    if (!profileName.trim()) {
      setProfileMessage('অনুগ্রহ করে আপনার নাম লিখুন।')
      return
    }

    setProfileSaving(true)
    setProfileMessage('')
    try {
      let nextAvatarPath = profileAvatarPath
      if (profilePhotoFile) {
        if (!profilePhotoFile.type.startsWith('image/')) {
          throw new Error('শুধুমাত্র ছবি ফাইল নির্বাচন করুন।')
        }
        if (profilePhotoFile.size > 5 * 1024 * 1024) {
          throw new Error('ছবির আকার ৫ MB-এর কম হতে হবে।')
        }
        const extension = (profilePhotoFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
        nextAvatarPath = `${session.user.id}/profile/avatar.${extension}`
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(nextAvatarPath, profilePhotoFile, {
            upsert: true,
            contentType: profilePhotoFile.type,
            cacheControl: '3600'
          })
        if (uploadError) throw uploadError
      }

      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...session.user.user_metadata,
          full_name: profileName.trim(),
          avatar_path: nextAvatarPath
        }
      })
      if (error) throw error

      const updatedUser = data?.user
      if (updatedUser) setSession(current => current ? { ...current, user: updatedUser } : current)
      setProfileAvatarPath(nextAvatarPath)
      if (nextAvatarPath) {
        const { data: signed, error: signedError } = await supabase.storage
          .from(STORAGE_BUCKET).createSignedUrl(nextAvatarPath, 60 * 60)
        if (signedError) throw signedError
        setProfileAvatarUrl(signed?.signedUrl || '')
      }
      setProfilePhotoFile(null)
      setProfileMessage('আপনার প্রোফাইল সফলভাবে সংরক্ষণ হয়েছে।')
    } catch (error) {
      setProfileMessage('প্রোফাইল সংরক্ষণ করা যায়নি: ' + (error.message || 'অজানা সমস্যা'))
    } finally {
      setProfileSaving(false)
    }
  }

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

  useEffect(() => () => {
    if (mouzaMapFile?.url && mouzaMapFile.localPreview) URL.revokeObjectURL(mouzaMapFile.url)
  }, [])

  const csvColumns = [
    'deed_number', 'deed_date', 'donor_name', 'recipient_name', 'mouza', 'sheet_number',
    'dag_type', 'dag_number', 'khatian_type', 'khatian_number',
    'mutation_case_number', 'mutation_case_date', 'holding_number', 'holding_date', 'total_land', 'owned_land',
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

  useEffect(() => {
    if (!records.length) {
      setSelectedMapRecordId('')
      return
    }
    if (!records.some(record => String(record.id) === String(selectedMapRecordId))) {
      setSelectedMapRecordId(String(records[0].id))
    }
  }, [records, selectedMapRecordId])

  useEffect(() => {
    if (!session?.user?.id || !selectedMapRecordId) {
      setMapPoints([])
      setMouzaMapFile(current => {
        if (current?.url && current.localPreview) URL.revokeObjectURL(current.url)
        return null
      })
      setSavedMapFilePath(null)
      setRemoveSavedMapFile(false)
      return
    }

    let cancelled = false
    async function loadSavedMap() {
      setMapLoading(true)
      setMapStatus('নির্বাচিত জমির সংরক্ষিত ম্যাপ খোঁজা হচ্ছে...')
      setMapPoints([])
      setMouzaMapFile(current => {
        if (current?.url && current.localPreview) URL.revokeObjectURL(current.url)
        return null
      })
      setSavedMapFilePath(null)
      setRemoveSavedMapFile(false)

      const { data, error } = await supabase
        .from('land_record_maps')
        .select('*')
        .eq('land_record_id', selectedMapRecordId)
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        setMapStatus('সংরক্ষিত ম্যাপ লোড করা যায়নি: ' + error.message)
        setMapLoading(false)
        return
      }

      if (data) {
        setMapPoints(Array.isArray(data.map_points) ? data.map_points : [])
        setSavedMapFilePath(data.map_file_path || null)
        if (data.map_file_path) {
          const { data: signed, error: signedError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(data.map_file_path, 3600)
          if (cancelled) return
          if (signedError) {
            setMapStatus('ম্যাপের নকশা লোড হয়নি: ' + signedError.message)
          } else {
            setMouzaMapFile({
              url: signed.signedUrl,
              type: data.map_file_type || '',
              name: data.map_file_name || 'মৌজা নকশা',
              remote: true
            })
          }
        } else {
          setMapStatus('আগের সীমানা লোড হয়েছে।')
        }
      } else {
        setMapStatus('এই জমির জন্য এখনো কোনো ম্যাপ সংরক্ষণ করা হয়নি।')
      }
      setMapLoading(false)
    }

    loadSavedMap()
    return () => { cancelled = true }
  }, [session?.user?.id, selectedMapRecordId])

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
    setMapAttachmentFile(null)
    setFileCategory('জমির দলিল')
    setEditingRecord(null)
    setShowForm(false)
  }

  function startEdit(record) {
    setEditingRecord(record)

    setForm({
      deed_number: record.deed_number || '',
      deed_date: record.deed_date || '',
      donor_name: record.donor_name || '',
      recipient_name: record.recipient_name || '',
      mouza: record.mouza || '',
      sheet_number: record.sheet_number || '',
      dag_type: record.dag_type || 'CS',
      dag_number: record.dag_number || '',
      khatian_type: record.khatian_type || 'CS',
      khatian_number: record.khatian_number || '',
      mutation_case_number: record.mutation_case_number || '',
      mutation_case_date: record.mutation_case_date || '',
      holding_number: record.holding_number || '',
      holding_date: record.holding_date || '',
      total_land: record.total_land ?? '',
      owned_land: record.owned_land ?? '',
      total_land_unit: record.total_land_unit || 'শতক',
      owned_land_unit: record.owned_land_unit || 'শতক'
    })

    setPendingFiles([])
    setMapAttachmentFile(null)
    setShowForm(true)
    setActivePage('records')
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

    if (mapAttachmentFile?.file && !uploadErrorMessage) {
      const mapFile = mapAttachmentFile.file
      const safeMapName = mapFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const mapPath = `${session.user.id}/${savedRecord.id}/maps/${crypto.randomUUID()}-${safeMapName}`
      const { error: mapUploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(mapPath, mapFile, { upsert: false })

      if (mapUploadError) {
        uploadErrorMessage = `নকশা আপলোড হয়নি: ${mapUploadError.message}`
      } else {
        const { error: mapSaveError } = await supabase
          .from('land_record_maps')
          .upsert({
            user_id: session.user.id,
            land_record_id: savedRecord.id,
            map_points: [],
            map_file_path: mapPath,
            map_file_name: mapFile.name,
            map_file_type: mapFile.type,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,land_record_id' })

        if (mapSaveError) {
          await supabase.storage.from(STORAGE_BUCKET).remove([mapPath])
          uploadErrorMessage = `নকশার তথ্য সংরক্ষণ হয়নি: ${mapSaveError.message}`
        }
      }
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
    setActivePage('records')

    setMessage(
      wasEditing
        ? 'জমির তথ্য ও ফাইল সফলভাবে সংশোধন/সংরক্ষণ হয়েছে।'
        : 'জমির তথ্য ও ফাইল সফলভাবে সংরক্ষণ হয়েছে।'
    )

    setSaving(false)
  }

  async function saveLandMap() {
    if (!session?.user?.id || !selectedMapRecordId || mapSaving) return
    setMapSaving(true)
    setMapStatus('জমির ম্যাপ Supabase-এ সংরক্ষণ হচ্ছে...')

    let nextFilePath = savedMapFilePath
    let uploadedNewPath = null
    const oldFilePath = savedMapFilePath

    try {
      if (mouzaMapFile?.file) {
        const file = mouzaMapFile.file
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        uploadedNewPath = `${session.user.id}/${selectedMapRecordId}/maps/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(uploadedNewPath, file, { upsert: false })
        if (uploadError) throw uploadError
        nextFilePath = uploadedNewPath
      } else if (removeSavedMapFile) {
        nextFilePath = null
      }

      const { error } = await supabase
        .from('land_record_maps')
        .upsert({
          user_id: session.user.id,
          land_record_id: selectedMapRecordId,
          map_points: [],
          map_file_path: nextFilePath,
          map_file_name: nextFilePath
            ? (mouzaMapFile?.file?.name || mouzaMapFile?.name || null)
            : null,
          map_file_type: nextFilePath
            ? (mouzaMapFile?.file?.type || mouzaMapFile?.type || null)
            : null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,land_record_id' })

      if (error) throw error

      if (uploadedNewPath && oldFilePath && oldFilePath !== uploadedNewPath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([oldFilePath])
      }
      if (!nextFilePath && oldFilePath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([oldFilePath])
      }

      setSavedMapFilePath(nextFilePath)
      setRemoveSavedMapFile(false)

      if (mouzaMapFile?.file && nextFilePath) {
        const { data: signed } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(nextFilePath, 3600)
        if (signed?.signedUrl) {
          const localUrl = mouzaMapFile.url
          if (localUrl && mouzaMapFile.localPreview) URL.revokeObjectURL(localUrl)
          setMouzaMapFile({
            url: signed.signedUrl,
            type: mouzaMapFile.file.type,
            name: mouzaMapFile.file.name,
            remote: true
          })
        }
      }

      setMapStatus('মৌজা/দাগের নকশা সফলভাবে Supabase-এ সংরক্ষিত হয়েছে।')
    } catch (error) {
      if (uploadedNewPath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([uploadedNewPath])
      }
      setMapStatus('ম্যাপ সংরক্ষণ করা যায়নি: ' + (error.message || 'অজানা সমস্যা'))
    } finally {
      setMapSaving(false)
    }
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
    <div className="app-shell bh-app-shell">
      <aside className="bh-sidebar">
        <div className="bh-brand">
          <img src="/logo.png" alt="ভূমিঘর" />
          <strong>ভূমিঘর</strong>
          <span>BHUMIGHOR</span>
          <small>আপনার জমির তথ্য, এখন হাতের মুঠোয়</small>
        </div>
        <nav className="bh-nav" aria-label="প্রধান মেনু">
          <a className={activePage === 'dashboard' ? 'active' : ''} href="#dashboard" onClick={() => setActivePage('dashboard')}><span>⌂</span> ড্যাশবোর্ড</a>
          <button type="button" className={activePage === 'profile' ? 'active' : ''} onClick={() => { setActivePage('profile'); setProfileMessage('') }}><span>◉</span> আমার প্রোফাইল</button>
          <a className={activePage === 'records' ? 'active' : ''} href="#records-section" onClick={() => setActivePage('records')}><span>▦</span> জমির তথ্য</a>
          <button type="button" className={activePage === 'settings' ? 'active' : ''} onClick={() => { setActivePage('settings'); setPasswordChangeMessage('') }}><span>⚙</span> সেটিংস</button>
          <button type="button" onClick={() => supabase.auth.signOut()}><span>⇥</span> লগআউট</button>
        </nav>
        <div className="bh-sidebar-bottom">
          <div className="bh-landscape">🌳　🏡　🌳</div>
          <strong>ভূমিঘর</strong>
          <small>স্মার্ট ভূমি ব্যবস্থাপনার আধুনিক সমাধান</small>
          <p>♥ Developed by<br />Muktar Graphics</p>
        </div>
      </aside>

      <main className="content bh-content">
        <header className="bh-topbar">
          <div className="bh-user-welcome">
            <span className="bh-wave">👋</span>
            <div><h1>{profileName || 'স্বাগতম!'}</h1><p>আপনার ভূমিঘর ড্যাশবোর্ডে আপনাকে স্বাগতম।</p></div>
          </div>
          <button type="button" className="bh-user-pill" onClick={() => { setActivePage('profile'); setProfileMessage('') }} aria-label="আমার প্রোফাইল খুলুন">
            <span className="bh-avatar">{profileAvatarUrl ? <img src={profileAvatarUrl} alt="প্রোফাইল" /> : '👤'}</span>
            <span className="bh-user-identity"><strong>{profileName || 'আপনার নাম'}</strong></span>
            <span className="bh-profile-edit-label">প্রোফাইল ↗</span>
          </button>
        </header>

        {activePage === 'profile' && (
          <section className="bh-profile-page">
            <div className="bh-profile-heading">
              <div><span>ব্যক্তিগত তথ্য</span><h2>আমার প্রোফাইল</h2><p>আপনার নাম ও প্রোফাইল ছবি হালনাগাদ করুন।</p></div>
              <button type="button" onClick={() => setActivePage('dashboard')}>ড্যাশবোর্ডে ফিরে যান</button>
            </div>
            <form className="bh-profile-card" onSubmit={saveProfile}>
              <div className="bh-profile-photo-area">
                <div className="bh-profile-photo">
                  {profilePhotoFile
                    ? <img src={URL.createObjectURL(profilePhotoFile)} alt="নতুন প্রোফাইল ছবি" />
                    : profileAvatarUrl ? <img src={profileAvatarUrl} alt="প্রোফাইল ছবি" /> : <span>👤</span>}
                </div>
                <label className="bh-photo-upload">ছবি নির্বাচন করুন
                  <input type="file" accept="image/*" onChange={e => setProfilePhotoFile(e.target.files?.[0] || null)} />
                </label>
                <small>JPG, PNG বা WebP · সর্বোচ্চ ৫ MB</small>
              </div>
              <div className="bh-profile-fields">
                <label>আপনার নাম<input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="যেমন: মোঃ মুক্তারুজ্জামান" maxLength={80} required /></label>
                <label>ইমেইল ঠিকানা<input type="email" value={session.user.email || ''} readOnly /></label>
                <p>ইমেইল ঠিকানা লগইন অ্যাকাউন্টের সঙ্গে যুক্ত; এই পেজ থেকে এটি পরিবর্তন করা যাবে না।</p>
                {profileMessage && <div className="bh-profile-message" role="status">{profileMessage}</div>}
                <button className="bh-profile-save" type="submit" disabled={profileSaving}>{profileSaving ? 'সংরক্ষণ হচ্ছে...' : 'পরিবর্তন সংরক্ষণ করুন'}</button>
              </div>
            </form>
          </section>
        )}

        {activePage === 'settings' && (
          <section className="bh-profile-page bh-settings-page">
            <div className="bh-profile-heading">
              <div><span>অ্যাকাউন্ট নিরাপত্তা</span><h2>সেটিংস</h2><p>আপনার অ্যাকাউন্টের পাসওয়ার্ড পরিবর্তন করুন।</p></div>
              <button type="button" onClick={() => setActivePage('dashboard')}>ড্যাশবোর্ডে ফিরে যান</button>
            </div>
            <form className="bh-settings-card" onSubmit={changeAccountPassword}>
              <h3>পাসওয়ার্ড পরিবর্তন</h3>
              <p>নিরাপত্তার জন্য প্রথমে আপনার বর্তমান পাসওয়ার্ড দিন।</p>
              <label>পুরোনো পাসওয়ার্ড<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="বর্তমান পাসওয়ার্ড লিখুন" required /></label>
              <label>নতুন পাসওয়ার্ড<input type="password" autoComplete="new-password" value={changeNewPassword} onChange={e => setChangeNewPassword(e.target.value)} placeholder="কমপক্ষে ৬ অক্ষর" minLength={6} required /></label>
              <label>নতুন পাসওয়ার্ড নিশ্চিত করুন<input type="password" autoComplete="new-password" value={changeConfirmPassword} onChange={e => setChangeConfirmPassword(e.target.value)} placeholder="নতুন পাসওয়ার্ড আবার লিখুন" minLength={6} required /></label>
              {passwordChangeMessage && <div className="bh-profile-message" role="status">{passwordChangeMessage}</div>}
              <button className="bh-profile-save" type="submit" disabled={passwordChangeBusy}>{passwordChangeBusy ? 'পরিবর্তন হচ্ছে...' : 'নতুন পাসওয়ার্ড সংরক্ষণ করুন'}</button>
            </form>
          </section>
        )}

        <div style={{ display: activePage === 'dashboard' ? 'block' : 'none' }}>
        <>
        <section className="bh-hero" id="dashboard">
          <div><span>আপনার জমির ডিজিটাল নথিঘর</span><h2>আপনার সকল জমির তথ্য এক জায়গায়</h2><p>নিরাপদে সংরক্ষণ করুন, সহজে খুঁজে নিন এবং প্রয়োজনমতো রিপোর্ট তৈরি করুন।</p></div>
          <img src="/logo.png" alt="ভূমিঘর লোগো" />
        </section>



        <section className="bh-stat-grid" aria-label="জমির সারসংক্ষেপ">
          <article className="bh-stat bh-stat-blue"><span className="bh-stat-icon">▤</span><div><small>মোট রেকর্ড</small><strong>{dashboardStats.recordCount.toLocaleString('bn-BD')}</strong><small>টি জমির তথ্য</small></div></article>
          <article className="bh-stat bh-stat-green"><span className="bh-stat-icon">🌾</span><div><small>মোট জমি</small><strong>{dashboardStats.totalLand}</strong><small>একক অনুযায়ী হিসাব</small></div></article>
          <article className="bh-stat bh-stat-orange"><span className="bh-stat-icon">⌂</span><div><small>ক্রয়/নিজস্ব জমি</small><strong>{dashboardStats.ownedLand}</strong><small>একক অনুযায়ী হিসাব</small></div></article>
          <article className="bh-stat bh-stat-purple"><span className="bh-stat-icon">▰</span><div><small>সংযুক্ত কাগজপত্র</small><strong>{dashboardStats.fileCount.toLocaleString('bn-BD')}</strong><small>টি ফাইল সংরক্ষিত</small></div></article>
        </section>

        <section className="bh-chart-grid">
          <article className="bh-panel">
            <h3><span>▥</span> জমির একক অনুযায়ী পরিসংখ্যান</h3>
            <div className="bh-bar-chart">
              {chartStats.landRows.length ? chartStats.landRows.map((row, index) => <div className="bh-bar-item" key={row.unit}><strong>{row.total.toLocaleString('bn-BD',{maximumFractionDigits:2})}</strong><div className="bh-bar-track"><i style={{height:`${Math.max(5, chartStats.maxLand ? row.total/chartStats.maxLand*100 : 0)}%`}} /></div><small>{row.unit}</small></div>) : <p className="bh-empty-chart">জমির পরিমাণের তথ্য পাওয়া যায়নি।</p>}
            </div>
            <p className="bh-chart-note">প্রতিটি এককের হিসাব আলাদাভাবে দেখানো হয়েছে</p>
          </article>
          <article className="bh-panel">
            <h3><span>◉</span> মৌজা অনুযায়ী জমির রেকর্ড</h3>
            {chartStats.topMouzas.length ? <div className="bh-mouza-list">{chartStats.topMouzas.slice(0,4).map((item,index)=><div className="bh-mouza-row" key={item.name}><span className={`bh-dot dot-${index%4}`} /><div><strong>{item.name}</strong><small>{item.count.toLocaleString('bn-BD')} টি রেকর্ড</small></div><b>{chartStats.maxMouza ? Math.round(item.count/chartStats.maxMouza*100) : 0}%</b></div>)}</div> : <p className="bh-empty-chart">মৌজার তথ্য পাওয়া যায়নি।</p>}
          </article>
        </section>

        <section className="bh-lower-grid">
          <article className="bh-panel bh-recent-panel">
            <div className="bh-panel-heading"><h3><span>◷</span> সাম্প্রতিক জমির রেকর্ড</h3><a href="#records-section" onClick={() => setActivePage('records')}>সব দেখুন →</a></div>
            {records.length ? <div className="bh-recent-table-wrap"><table className="bh-recent-table"><thead><tr><th>#</th><th>মালিকের নাম</th><th>মৌজা</th><th>দাগ নং</th><th>খতিয়ান নং</th><th>মোট জমি</th><th>দেখুন</th></tr></thead><tbody>{records.slice(0,5).map((r,index)=><tr key={r.id}><td>{(index+1).toLocaleString('bn-BD')}</td><td>{r.recipient_name || '—'}</td><td>{r.mouza || '—'}</td><td>{r.dag_number || '—'}</td><td>{r.khatian_number || '—'}</td><td>{r.total_land ?? '—'} {r.total_land_unit || 'শতক'}</td><td><button type="button" className="bh-view-btn" onClick={()=>setPreviewRecord(r)}>দেখুন</button></td></tr>)}</tbody></table></div> : <p className="bh-empty-chart">এখনো কোনো জমির তথ্য সংরক্ষণ করা হয়নি।</p>}
          </article>
          <article className="bh-panel bh-quick-panel">
            <h3><span>⚡</span> দ্রুত কাজের সুবিধা</h3>
            <div className="bh-quick-grid">
              <button type="button" onClick={()=>{setForm({...emptyForm});setEditingRecord(null);setPendingFiles([]);setMapAttachmentFile(null);setShowForm(true);setActivePage('records');window.scrollTo({top:0,behavior:'smooth'})}}><b>＋</b>নতুন জমি যোগ করুন</button>
            </div>
          </article>
        </section>

        {message && activePage === 'dashboard' && (
          <div className="notice">
            {message}
            <button onClick={() => setMessage('')}><X size={15} /></button>
          </div>
        )}
        </>
        </div>

        <div style={{ display: activePage === 'records' || Boolean(previewRecord) ? 'block' : 'none' }}>
        <>
        {message && activePage === 'records' && (
          <div className="notice">
            {message}
            <button onClick={() => setMessage('')}><X size={15} /></button>
          </div>
        )}

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

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
              <label>
                দলিল নং
                <input value={form.deed_number} onChange={e => setForm({ ...form, deed_number: e.target.value })} placeholder="দলিল নম্বর লিখুন" />
              </label>
              <label>
                তারিখ
                <input type="date" value={form.deed_date} onChange={e => setForm({ ...form, deed_date: e.target.value })} />
              </label>

              <label>
                গ্রহীতার নাম
                <input value={form.recipient_name} onChange={e => setForm({ ...form, recipient_name: e.target.value })} placeholder="গ্রহীতার নাম লিখুন" />
              </label>
              <label>
                দাতার নাম
                <input value={form.donor_name} onChange={e => setForm({ ...form, donor_name: e.target.value })} placeholder="দাতার নাম লিখুন" />
              </label>

              <label>
                দাগের ধরন
                <select value={form.dag_type} onChange={e => setForm({ ...form, dag_type: e.target.value })}>
                  {['CS', 'SA', 'RS', 'RBS'].map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <label>
                দাগ নম্বর
                <input value={form.dag_number} onChange={e => setForm({ ...form, dag_number: e.target.value })} placeholder="দাগ নম্বর লিখুন" />
              </label>

              <label>
                খতিয়ানের ধরন
                <select value={form.khatian_type} onChange={e => setForm({ ...form, khatian_type: e.target.value })}>
                  {['CS', 'SA', 'RS', 'RBS'].map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <label>
                খতিয়ান নম্বর
                <input value={form.khatian_number} onChange={e => setForm({ ...form, khatian_number: e.target.value })} placeholder="খতিয়ান নম্বর লিখুন" />
              </label>

              <label>
                মোট জমি
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input style={{ minWidth: 0, flex: 1 }} inputMode="decimal" value={form.total_land} onChange={e => setForm({ ...form, total_land: e.target.value })} placeholder="জমির পরিমাণ" />
                  <select style={{ width: '105px' }} value={form.total_land_unit} onChange={e => setForm({ ...form, total_land_unit: e.target.value })}>
                    {landUnits.map(unit => <option key={unit}>{unit}</option>)}
                  </select>
                </div>
              </label>
              <label>
                মৌজা
                <input value={form.mouza} onChange={e => setForm({ ...form, mouza: e.target.value })} placeholder="মৌজার নাম লিখুন" />
              </label>

              <label>
                নামজারী কেস নম্বর
                <input value={form.mutation_case_number} onChange={e => setForm({ ...form, mutation_case_number: e.target.value })} placeholder="নামজারী কেস নম্বর লিখুন" />
              </label>
              <label>
                নামজারী কেসের তারিখ
                <input type="date" value={form.mutation_case_date} onChange={e => setForm({ ...form, mutation_case_date: e.target.value })} />
              </label>
              <label>
                হোল্ডিং নম্বর
                <input value={form.holding_number} onChange={e => setForm({ ...form, holding_number: e.target.value })} placeholder="হোল্ডিং নম্বর লিখুন" />
              </label>
              <label>
                হোল্ডিংয়ের তারিখ
                <input type="date" value={form.holding_date} onChange={e => setForm({ ...form, holding_date: e.target.value })} />
              </label>

              <label>
                সীট নম্বর
                <input value={form.sheet_number} onChange={e => setForm({ ...form, sheet_number: e.target.value })} placeholder="সীট নম্বর লিখুন" />
              </label>

              <div className="upload-section" style={{ margin: 0 }}>
                <h3><FolderOpen size={19} /> জমির কাগজপত্র সংযুক্ত করুন</h3>
                <p className="muted">ফাইলের ধরন নির্বাচন করে এক বা একাধিক PDF/JPG/PNG ফাইল যোগ করুন।</p>
                <div className="upload-controls">
                  <label>
                    ফাইলের ধরন
                    <select value={fileCategory} onChange={e => setFileCategory(e.target.value)} disabled={saving}>
                      {fileCategories.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="choose-files">
                    <span><Upload size={17} /> ফাইল নির্বাচন করুন</span>
                    <input type="file" accept=".pdf,image/jpeg,image/png" multiple disabled={saving} onChange={addSelectedFiles} />
                  </label>
                </div>
                <small className="file-help">প্রতিটি ফাইল সর্বোচ্চ ৫০ MB। আপনার Supabase Storage-এর সীমাও প্রযোজ্য।</small>
                {pendingFiles.length > 0 && (
                  <div className="pending-list">
                    <b>আপলোডের জন্য নির্বাচিত ফাইল ({pendingFiles.length})</b>
                    {pendingFiles.map(item => (
                      <div className="pending-file" key={item.id}>
                        <FileText size={18} />
                        <div><strong>{item.file.name}</strong><small>{item.category} · {(item.file.size / (1024 * 1024)).toFixed(2)} MB</small></div>
                        <button type="button" className="icon-btn" onClick={() => removePendingFile(item.id)} title="তালিকা থেকে বাদ দিন" disabled={saving}><X size={17} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {editingRecord && <small className="file-help">আগের সংরক্ষিত ফাইলগুলো অক্ষত থাকবে। নতুন ফাইল যোগ করতে উপরের অংশ ব্যবহার করুন।</small>}
              </div>
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', marginTop: '14px' }}>
              <label>
                ক্রয়/নিজস্ব জমির পরিমাণ
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input style={{ minWidth: 0, flex: 1 }} inputMode="decimal" value={form.owned_land} onChange={e => setForm({ ...form, owned_land: e.target.value })} placeholder="পরিমাণ লিখুন" />
                  <select style={{ width: '105px' }} value={form.owned_land_unit} onChange={e => setForm({ ...form, owned_land_unit: e.target.value })}>
                    {landUnits.map(unit => <option key={unit}>{unit}</option>)}
                  </select>
                </div>
              </label>
            </div>

            <div className="upload-section" style={{ marginTop: '16px' }}>
              <h3><LandPlot size={19} /> মৌজা ও দাগের নকশা সংযুক্ত করুন</h3>
              <p className="muted">জমির মৌজা/দাগের নকশা PDF, JPG অথবা PNG ফাইলে আপলোড করুন।</p>
              <label className="choose-files">
                <span><Upload size={17} /> নকশা নির্বাচন করুন</span>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png"
                  disabled={saving}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const valid = file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/png'
                    if (!valid) {
                      setMessage('নকশার জন্য শুধু PDF, JPG ও PNG ফাইল দেওয়া যাবে।')
                    } else if (file.size > 50 * 1024 * 1024) {
                      setMessage('নকশার ফাইলটি ৫০ MB-এর বেশি।')
                    } else {
                      setMapAttachmentFile({ file })
                      setMessage('')
                    }
                    e.target.value = ''
                  }}
                />
              </label>
              {mapAttachmentFile?.file && (
                <div className="pending-file" style={{ marginTop: '10px' }}>
                  <FileText size={18} />
                  <div><strong>{mapAttachmentFile.file.name}</strong><small>নকশা · {(mapAttachmentFile.file.size / (1024 * 1024)).toFixed(2)} MB</small></div>
                  <button type="button" className="icon-btn" onClick={() => setMapAttachmentFile(null)} disabled={saving} title="নকশা বাদ দিন"><X size={17} /></button>
                </div>
              )}
              {editingRecord && <small className="file-help">আগে সংরক্ষিত নকশা নতুন নকশা আপলোড না করলে অপরিবর্তিত থাকবে।</small>}
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

        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              id="land-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="দলিল, মৌজা, নাম বা ফাইল দিয়ে খুঁজুন"
            />
          </div>

        </div>


        <section className="records" id="records-section">
          <div className="section-title" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <h2>সংরক্ষিত জমির তথ্য</h2>
            <span>{filtered.length} টি</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '0 0 14px', padding: '12px', border: '1px solid #d5e4da', borderRadius: '10px', background: '#f5faf6' }}>
            <input id="bhumighor-csv-import" type="file" accept=".csv,text/csv" onChange={importRecordsCsv} style={{ display: 'none' }} />
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
              <span>ড্যাশবোর্ডের “নতুন জমি যোগ করুন” বাটনে ক্লিক করে শুরু করুন।</span>
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
                  ['তারিখ', previewRecord.deed_date],
                  ['দাতার নাম', previewRecord.donor_name],
                  ['গ্রহীতার নাম', previewRecord.recipient_name],
                  ['মৌজা', previewRecord.mouza],
                  ['সীট নম্বর', previewRecord.sheet_number],
                  ['দাগের ধরন', previewRecord.dag_type],
                  ['দাগ নম্বর', previewRecord.dag_number],
                  ['খতিয়ানের ধরন', previewRecord.khatian_type],
                  ['খতিয়ান নম্বর', previewRecord.khatian_number],
                  ['নামজারি কেস নম্বর', previewRecord.mutation_case_number],
                  ['নামজারী কেসের তারিখ', previewRecord.mutation_case_date],
                  ['হোল্ডিং নম্বর', previewRecord.holding_number],
                  ['হোল্ডিংয়ের তারিখ', previewRecord.holding_date],
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

        </>
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
                    ['দলিল নম্বর', record.deed_number], ['তারিখ', record.deed_date], ['দাতার নাম', record.donor_name], ['গ্রহীতার নাম', record.recipient_name],
                    ['মৌজা', record.mouza], ['সীট নম্বর', record.sheet_number], ['দাগের ধরন', record.dag_type], ['দাগ নম্বর', record.dag_number],
                    ['খতিয়ানের ধরন', record.khatian_type], ['খতিয়ান নম্বর', record.khatian_number], ['নামজারি কেস নম্বর', record.mutation_case_number],
                    ['হোল্ডিং নম্বর', record.holding_number], ['নামজারী কেসের তারিখ', record.mutation_case_date], ['হোল্ডিংয়ের তারিখ', record.holding_date], ['মোট জমি', `${record.total_land ?? '—'} ${record.total_land_unit || 'শতক'}`],
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

        </div>

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

        <style>{`
          .bh-app-shell{display:grid!important;grid-template-columns:226px minmax(0,1fr)!important;min-height:100vh!important;background:#f1e5d6!important;align-items:stretch!important}
          .bh-sidebar{background:linear-gradient(180deg,#08713e 0%,#005b38 72%,#064c30 100%);color:#fff;display:flex;flex-direction:column;min-height:100vh;position:sticky;top:0;height:100vh;overflow:auto;z-index:20}
          .bh-brand{background:#fff;color:#12623d;text-align:center;padding:20px 14px 17px;display:flex;align-items:center;flex-direction:column;gap:3px}
          .bh-brand img{width:82px;height:82px;object-fit:contain}.bh-brand strong{font-size:25px;line-height:1.2}.bh-brand span{font-size:12px;font-weight:800;letter-spacing:.5px}.bh-brand small{font-size:11px;color:#52645a;margin-top:8px;line-height:1.5}
          .bh-nav{display:grid;gap:5px;padding:17px 11px}.bh-nav a,.bh-nav button{border:0;background:transparent;color:#effff5;text-decoration:none;text-align:left;display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:10px;font:600 14px inherit;cursor:pointer}.bh-nav a span,.bh-nav button span{font-size:21px;width:23px;text-align:center}.bh-nav a.active,.bh-nav a:hover,.bh-nav button:hover{background:#19a83d;color:#fff;box-shadow:0 5px 14px #003d2b55}
          .bh-sidebar-bottom{margin-top:auto;text-align:center;padding:15px 12px 18px;background:linear-gradient(0deg,#06472d,#08713e)}.bh-landscape{font-size:25px;padding:10px 0}.bh-sidebar-bottom strong{display:block;font-size:19px}.bh-sidebar-bottom small{display:block;font-size:11px;line-height:1.5;margin:5px auto;max-width:170px}.bh-sidebar-bottom p{border-top:1px solid #ffffff30;padding-top:12px;font-size:11px;line-height:1.6;margin:12px 0 0}
          .bh-content{width:100%;max-width:none!important;margin:0!important;padding:0 25px 22px!important;box-sizing:border-box;min-width:0}
          .bh-topbar{min-height:95px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 2px;background:linear-gradient(90deg,rgba(250,241,227,.94) 0%,rgba(250,241,227,.82) 44%,rgba(250,241,227,.22) 100%),url('/bhumighor-banner.png') center 48%/cover no-repeat;border-bottom:1px solid #d8c3a8;margin:0 -25px 18px;padding-left:25px;padding-right:25px}
          .bh-user-welcome{display:flex;align-items:center;gap:13px}.bh-wave{font-size:32px}.bh-user-welcome h1{font-size:24px;margin:0;color:#153d2b}.bh-user-welcome p{margin:4px 0 0;color:#557064;font-size:13px}.bh-user-pill{display:flex;align-items:center;gap:9px;background:#ffffffc9;border:1px solid #e1eae4;border-radius:30px;padding:7px 10px;font-size:12px;max-width:55%}.bh-user-pill>span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bh-avatar{width:32px;height:32px;border-radius:50%;background:#e5edf1;display:grid;place-items:center;font-size:20px}.bh-user-pill button{border:0;background:#e9f4ed;color:#17613d;border-radius:20px;padding:7px 10px;font-weight:700;cursor:pointer;white-space:nowrap}
          .bh-user-pill{cursor:pointer;text-align:left;font-family:inherit}.bh-user-identity{display:flex;flex-direction:column;gap:2px;min-width:0}.bh-user-identity strong{font-size:13px;color:#17452f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bh-user-identity small{font-size:10px;color:#64756c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bh-profile-edit-label{font-size:11px;color:#17613d;background:#e9f4ed;border-radius:18px;padding:7px 9px;white-space:nowrap}.bh-avatar{overflow:hidden}.bh-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}.bh-nav button.active{background:#19a83d;color:#fff;box-shadow:0 5px 14px #003d2b55}.bh-profile-page{max-width:980px;margin:25px auto;padding:0 10px}.bh-profile-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.bh-profile-heading span{font-size:12px;color:#148044}.bh-profile-heading h2{font-size:25px;color:#17452f;margin:4px 0}.bh-profile-heading p{font-size:13px;color:#718178;margin:0}.bh-profile-heading>button{border:1px solid #cfe1d5;background:#fff;color:#17613d;border-radius:9px;padding:10px 13px;cursor:pointer}.bh-profile-card{display:grid;grid-template-columns:260px 1fr;gap:30px;background:#fff;border:1px solid #dce8df;border-radius:16px;padding:28px;box-shadow:0 5px 18px #193e5410}.bh-profile-photo-area{display:flex;flex-direction:column;align-items:center;gap:10px}.bh-profile-photo{width:150px;height:150px;border-radius:50%;overflow:hidden;background:#edf5ef;border:4px solid #d9eee0;display:grid;place-items:center;font-size:55px;color:#6d8a78}.bh-profile-photo img{width:100%;height:100%;object-fit:cover}.bh-photo-upload{background:#e9f5ed;color:#17613d;border-radius:9px;padding:10px 15px;font-size:13px;font-weight:700;cursor:pointer}.bh-photo-upload input{display:none}.bh-profile-photo-area small{font-size:11px;color:#7b8b84}.bh-profile-fields{display:grid;align-content:start;gap:14px}.bh-profile-fields label{display:grid;gap:7px;font-size:13px;font-weight:700;color:#294b38}.bh-profile-fields input{width:100%;box-sizing:border-box;border:1px solid #d5e2da;border-radius:9px;padding:12px;font:inherit;font-weight:400;color:#263d32;background:#fff}.bh-profile-fields input:read-only{background:#f4f7f5;color:#6c7b72}.bh-profile-fields>p{font-size:11px;color:#7b8b84;margin:-5px 0 0}.bh-profile-message{font-size:12px;color:#17613d;background:#edf8f0;border-radius:8px;padding:10px}.bh-profile-save{border:0;background:#08713e;color:#fff;border-radius:9px;padding:12px 18px;font-weight:700;cursor:pointer;justify-self:start}.bh-profile-save:disabled{opacity:.6;cursor:wait}
          .bh-hero{min-height:108px;border-radius:17px;padding:19px 24px;margin:0 0 17px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#fff;background:linear-gradient(100deg,#08713e,#159b4c 55%,#b5dcae);box-shadow:0 7px 18px #0b62301b;overflow:hidden}.bh-hero span{font-size:11px;opacity:.85}.bh-hero h2{font-size:22px;margin:5px 0}.bh-hero p{font-size:12px;margin:0;opacity:.9}.bh-hero img{width:82px;height:82px;object-fit:contain;background:#ffffffed;border-radius:50%;padding:7px}
          .bh-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:17px}.bh-stat{display:flex;align-items:center;gap:12px;min-width:0;padding:15px;border-radius:15px;border:1px solid #dce8ee;box-shadow:0 4px 12px #1d3b5010}.bh-stat>div{min-width:0}.bh-stat-icon{width:48px;height:48px;flex:0 0 48px;border-radius:50%;display:grid;place-items:center;font-size:24px;font-weight:800}.bh-stat small{display:block;color:#52616b;font-size:11px}.bh-stat strong{display:block;font-size:21px;line-height:1.5;color:#122f25;overflow-wrap:anywhere}.bh-stat-blue{background:#e5f2ff;border-color:#b8d9fb}.bh-stat-blue .bh-stat-icon{background:#1479e8;color:white}.bh-stat-green{background:#e5f8e8;border-color:#b6e8bd}.bh-stat-green .bh-stat-icon{background:#0b8b39;color:white}.bh-stat-orange{background:#fff1d8;border-color:#f5d39a}.bh-stat-orange .bh-stat-icon{background:#f28a0b;color:white}.bh-stat-purple{background:#f0e7ff;border-color:#d7c1ff}.bh-stat-purple .bh-stat-icon{background:#7738d7;color:white}
          .bh-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:17px}.bh-panel{background:#fff;border:1px solid #dce6ee;border-radius:15px;overflow:hidden;box-shadow:0 4px 12px #193e5410;min-width:0}.bh-panel>h3,.bh-panel-heading{margin:0;padding:12px 15px;background:#08713e;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;gap:9px}.bh-panel>h3 span,.bh-panel-heading h3 span{font-size:19px}.bh-bar-chart{height:180px;display:flex;align-items:stretch;justify-content:space-around;gap:10px;padding:18px 17px 0;border-bottom:1px solid #e5edf3;background:repeating-linear-gradient(to bottom,transparent 0,transparent 43px,#edf2f7 44px)}.bh-bar-item{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px}.bh-bar-item strong{font-size:11px;color:#253a32}.bh-bar-track{height:115px;width:min(48px,80%);display:flex;align-items:flex-end;background:#edf3f8;border-radius:7px 7px 0 0;overflow:hidden}.bh-bar-track i{width:100%;display:block;border-radius:7px 7px 0 0;background:linear-gradient(180deg,#2498f4,#0870d4)}.bh-bar-item:nth-child(2) .bh-bar-track i{background:linear-gradient(180deg,#62d83e,#1ba52d)}.bh-bar-item:nth-child(3) .bh-bar-track i{background:linear-gradient(180deg,#ffb53b,#f28a0b)}.bh-bar-item:nth-child(4) .bh-bar-track i{background:linear-gradient(180deg,#a76af3,#7738d7)}.bh-bar-item small{font-size:11px;padding:5px 0;color:#405249}.bh-chart-note{font-size:10px;color:#7b8b84;margin:8px 14px 12px}.bh-empty-chart{font-size:12px;color:#718178;padding:16px}.bh-mouza-list{padding:12px 14px;display:grid;gap:13px}.bh-mouza-row{display:flex;align-items:center;gap:9px}.bh-dot{width:12px;height:12px;border-radius:4px;flex:0 0 12px;background:#1686ec}.dot-1{background:#1caa42}.dot-2{background:#f49a17}.dot-3{background:#8850dc}.bh-mouza-row div{min-width:0;flex:1}.bh-mouza-row strong,.bh-mouza-row small{display:block;overflow-wrap:anywhere}.bh-mouza-row strong{font-size:12px;color:#263d32}.bh-mouza-row small{font-size:10px;color:#75837c;margin-top:3px}.bh-mouza-row>b{font-size:11px;color:#52645a}.bh-category-list{padding:13px 14px;display:grid;gap:14px}.bh-category-list>div>div{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#35483f;margin-bottom:5px}.bh-category-list>div>div span{overflow-wrap:anywhere}.bh-category-list>div>div b{white-space:nowrap}.bh-category-list i{display:block;height:8px;border-radius:20px;background:#edf2f5;overflow:hidden}.bh-category-list em{display:block;height:100%;background:linear-gradient(90deg,#13a44b,#66c84a);border-radius:20px}
          .bh-lower-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(245px,.9fr);gap:13px;margin-bottom:20px}.bh-panel-heading{justify-content:space-between}.bh-panel-heading h3{font-size:15px;margin:0;display:flex;align-items:center;gap:8px}.bh-panel-heading a{font-size:11px;color:white;text-decoration:none;border:1px solid #ffffffa8;border-radius:8px;padding:6px 9px;white-space:nowrap}.bh-recent-table-wrap{overflow:auto;padding:10px}.bh-recent-table{border-collapse:collapse;width:100%;font-size:11px;white-space:nowrap}.bh-recent-table th{background:#f0f5fa;color:#34463e;font-weight:800}.bh-recent-table th,.bh-recent-table td{padding:9px 8px;border:1px solid #e0e9f0;text-align:left}.bh-recent-table td{color:#405148}.bh-view-btn{border:0;border-radius:7px;background:#e5f1ff;color:#0871d6;padding:5px 9px;font-size:10px;font-weight:700;cursor:pointer}.bh-quick-grid{padding:11px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.bh-quick-grid button{min-height:82px;border:1px solid #cce7d3;border-radius:12px;background:#e8f9ed;color:#194c30;font-weight:700;font-size:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer}.bh-quick-grid button:nth-child(2){background:#e8f3ff;border-color:#c5dcfb;color:#145a9d}.bh-quick-grid button:nth-child(3){background:#f2eaff;border-color:#dcc8ff;color:#6530a8}.bh-quick-grid button:nth-child(4){background:#e2fbf3;border-color:#b8edda;color:#08754b}.bh-quick-grid button:disabled{opacity:.45;cursor:not-allowed}.bh-quick-grid b{font-size:24px;line-height:1}
          #records-section{scroll-margin-top:16px}.bh-content .toolbar{margin-top:18px}.bh-content .records{margin-top:18px}.bh-content .records>.section-title{border-bottom:1px solid #dce8df;padding-bottom:10px}.bh-content>footer{text-align:center;color:#718178;font-size:11px;padding:18px}
          @media(max-width:1050px){.bh-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bh-chart-grid{grid-template-columns:1fr 1fr}.bh-chart-grid .bh-panel:first-child{grid-column:auto}}
          .bh-user-pill{gap:12px;padding:8px 14px;min-height:64px;max-width:360px}.bh-avatar{width:48px;height:48px;flex:0 0 48px;font-size:23px;display:grid;place-items:center;border-radius:50%;background:#e7f2eb}.bh-user-identity strong{font-size:17px;max-width:220px}.bh-profile-edit-label{font-size:12px;padding:9px 12px}.bh-user-welcome h1{font-size:27px}.bh-settings-card{max-width:650px;display:grid;gap:14px;background:#fff;border:1px solid #dce8df;border-radius:16px;padding:28px;box-shadow:0 5px 18px #193e5410}.bh-settings-card h3{font-size:20px;color:#17452f;margin:0}.bh-settings-card>p{font-size:13px;color:#718178;margin:-7px 0 5px}.bh-settings-card label{display:grid;gap:7px;font-size:13px;font-weight:700;color:#294b38}.bh-settings-card input{width:100%;box-sizing:border-box;border:1px solid #d5e2da;border-radius:9px;padding:12px;font:inherit;font-weight:400;color:#263d32;background:#fff}
          @media(max-width:760px){.bh-profile-card{grid-template-columns:1fr;padding:20px}.bh-profile-heading{align-items:flex-start;flex-direction:column}.bh-profile-photo{width:125px;height:125px}.bh-user-identity small{display:none}.bh-profile-edit-label{display:none}.bh-app-shell{grid-template-columns:1fr!important}.bh-sidebar{position:relative;height:auto;min-height:0}.bh-brand{flex-direction:row;justify-content:flex-start;text-align:left;padding:9px 14px}.bh-brand img{width:45px;height:45px}.bh-brand strong{font-size:18px}.bh-brand span,.bh-brand small{display:none}.bh-nav{display:flex;overflow:auto;padding:7px;gap:6px}.bh-nav a,.bh-nav button{white-space:nowrap;padding:9px 11px;font-size:12px}.bh-nav a span,.bh-nav button span{font-size:16px;width:auto}.bh-sidebar-bottom{display:none}.bh-content{padding:0 12px 18px!important}.bh-topbar{margin:0 -12px 12px;padding:10px 12px;min-height:70px}.bh-user-welcome h1{font-size:18px}.bh-user-welcome p{font-size:10px}.bh-wave{font-size:23px}.bh-user-pill{max-width:55%;font-size:11px;gap:7px;padding:6px 8px;min-height:54px}.bh-avatar{width:40px;height:40px;flex-basis:40px}.bh-user-identity strong{font-size:13px;max-width:125px}.bh-user-pill button{display:none}.bh-hero{padding:14px}.bh-hero h2{font-size:17px}.bh-hero p{font-size:10px}.bh-hero img{width:58px;height:58px}.bh-stat-grid{gap:8px}.bh-stat{padding:10px;gap:8px}.bh-stat-icon{width:36px;height:36px;flex-basis:36px;font-size:18px}.bh-stat strong{font-size:15px}.bh-stat small{font-size:9px}.bh-chart-grid{grid-template-columns:1fr}.bh-chart-grid .bh-panel:first-child{grid-column:auto}.bh-lower-grid{grid-template-columns:1fr}.bh-panel>h3,.bh-panel-heading{font-size:13px}.bh-recent-table th,.bh-recent-table td{padding:7px 6px}}
        `}</style>
        <footer>Developed by Muktar Graphics</footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)

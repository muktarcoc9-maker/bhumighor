
import React, { useEffect, useMemo, useRef, useState } from 'react'
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

// পৃথিবীর বক্রতা বিবেচনায় অক্ষাংশ/দ্রাঘিমাংশ থেকে বহুভুজের আনুমানিক আয়তন (m²)
function calculatePolygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0
  const earthRadius = 6378137
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    const lat1 = Number(current?.[0]) * Math.PI / 180
    const lat2 = Number(next?.[0]) * Math.PI / 180
    const lon1 = Number(current?.[1]) * Math.PI / 180
    const lon2 = Number(next?.[1]) * Math.PI / 180
    if (![lat1, lat2, lon1, lon2].every(Number.isFinite)) return 0
    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  return Math.abs(total * earthRadius * earthRadius / 2)
}

function formatArea(value) {
  return Number(value).toLocaleString('bn-BD', { maximumFractionDigits: 3 })
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
  const [mapLayer, setMapLayer] = useState('satellite')
  const [mapPoints, setMapPoints] = useState([])
  const [mapStatus, setMapStatus] = useState('ম্যাপ প্রস্তুত হচ্ছে...')
  const [mouzaMapFile, setMouzaMapFile] = useState(null)
  const [selectedMapRecordId, setSelectedMapRecordId] = useState('')
  const [savedMapFilePath, setSavedMapFilePath] = useState(null)
  const [mapSaving, setMapSaving] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const [removeSavedMapFile, setRemoveSavedMapFile] = useState(false)
  const mapContainerRef = useRef(null)
  const leafletMapRef = useRef(null)
  const mapLayerRef = useRef(null)
  const mapLabelsLayerRef = useRef(null)
  const parcelPolygonRef = useRef(null)
  const parcelMarkersRef = useRef([])

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

  useEffect(() => {
    if (activePage !== 'map') return
    let cancelled = false
    const loadLeaflet = () => {
      if (window.L) return Promise.resolve(window.L)
      if (!document.querySelector('link[data-bhumighor-leaflet]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.dataset.bhumighorLeaflet = 'true'
        document.head.appendChild(link)
      }
      return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-bhumighor-leaflet]')
        if (existing) {
          existing.addEventListener('load', () => resolve(window.L), { once: true })
          existing.addEventListener('error', reject, { once: true })
          if (window.L) resolve(window.L)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.dataset.bhumighorLeaflet = 'true'
        script.onload = () => resolve(window.L)
        script.onerror = reject
        document.body.appendChild(script)
      })
    }
    loadLeaflet().then(L => {
      if (cancelled || !mapContainerRef.current || leafletMapRef.current) return
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        preferCanvas: true,
        zoomSnap: 1,
        wheelDebounceTime: 80
      }).setView([24.0, 90.2], 7)
      leafletMapRef.current = map
      mapLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri', maxNativeZoom: 19, maxZoom: 21,
        updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 3
      }).addTo(map)
      mapLabelsLayerRef.current = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Labels © Esri', maxNativeZoom: 19, maxZoom: 21,
        pane: 'overlayPane', opacity: 1, updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 3
      }).addTo(map)
      window.setTimeout(() => { if (!cancelled && leafletMapRef.current === map) map.invalidateSize(true) }, 250)
      map.on('click', event => setMapPoints(current => [...current, [event.latlng.lat, event.latlng.lng]]))
      setMapStatus('ম্যাপ চালু হয়েছে। জমির সীমানার পয়েন্ট দিতে ম্যাপে ক্লিক করুন।')
    }).catch(() => {
      if (!cancelled) setMapStatus('ম্যাপ লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।')
    })
    return () => {
      cancelled = true
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        mapLayerRef.current = null
        mapLabelsLayerRef.current = null
        parcelPolygonRef.current = null
        parcelMarkersRef.current = []
      }
    }
  }, [activePage])

  useEffect(() => {
    const map = leafletMapRef.current
    const L = window.L
    if (!map || !L || activePage !== 'map') return
    if (mapLayerRef.current) map.removeLayer(mapLayerRef.current)
    if (mapLabelsLayerRef.current) {
      map.removeLayer(mapLabelsLayerRef.current)
      mapLabelsLayerRef.current = null
    }
    mapLayerRef.current = mapLayer === 'satellite'
      ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles © Esri', maxNativeZoom: 19, maxZoom: 21,
          updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 3
        })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors', subdomains: 'abc',
          maxNativeZoom: 19, maxZoom: 21,
          updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 3
        })
    mapLayerRef.current.addTo(map)
    if (mapLayer === 'satellite') {
      mapLabelsLayerRef.current = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Labels © Esri', maxNativeZoom: 19, maxZoom: 21,
        pane: 'overlayPane', opacity: 1, updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 3
      }).addTo(map)
    }
  }, [mapLayer, activePage])

  useEffect(() => {
    const map = leafletMapRef.current
    const L = window.L
    if (!map || !L || activePage !== 'map') return
    parcelMarkersRef.current.forEach(marker => map.removeLayer(marker))
    parcelMarkersRef.current = []
    if (parcelPolygonRef.current) {
      map.removeLayer(parcelPolygonRef.current)
      parcelPolygonRef.current = null
    }
    mapPoints.forEach(point => parcelMarkersRef.current.push(
      L.circleMarker(point, { radius: 6, color: '#fff', weight: 2, fillColor: '#08a045', fillOpacity: 1 }).addTo(map)
    ))
    if (mapPoints.length >= 3) {
      parcelPolygonRef.current = L.polygon(mapPoints, { color: '#f5d90a', weight: 3, fillColor: '#20c45a', fillOpacity: 0.35 }).addTo(map)
    }
  }, [mapPoints, activePage])

  useEffect(() => () => {
    if (leafletMapRef.current) {
      leafletMapRef.current.remove()
      leafletMapRef.current = null
    }
    if (mouzaMapFile?.url && mouzaMapFile.localPreview) URL.revokeObjectURL(mouzaMapFile.url)
  }, [])

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
          map_points: mapPoints,
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

      setMapStatus('জমির সীমানা ও মৌজা/দাগের নকশা সফলভাবে Supabase-এ সংরক্ষিত হয়েছে।')
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


  const measuredAreaSqm = useMemo(
    () => calculatePolygonArea(mapPoints),
    [mapPoints]
  )
  const measuredArea = useMemo(() => ({
    sqm: measuredAreaSqm,
    sqft: measuredAreaSqm * 10.7639104167,
    shotok: measuredAreaSqm / 40.468564224,
    katha: measuredAreaSqm / 66.89027712,
    bigha: measuredAreaSqm / 1337.8055424,
    acre: measuredAreaSqm / 4046.8564224
  }), [measuredAreaSqm])

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
          <a className={activePage === 'map' ? 'active' : ''} href="#land-map" onClick={event => { event.preventDefault(); setActivePage('map'); setMapStatus('ম্যাপ প্রস্তুত হচ্ছে...') }}><span>⌖</span> জমির ম্যাপ</a>
          <a href="#records-section"><span>▦</span> জমির তথ্য</a>
          <a href="#records-section"><span>▤</span> সংযুক্ত কাগজপত্র</a>
          <a href="#records-section"><span>▣</span> সম্মিলিত PDF</a>
          <a href="#records-section"><span>⇅</span> CSV Export/Import</a>
          <a href="#records-section"><span>⌕</span> সার্চ ও ফিল্টার</a>
          <a href="#records-section"><span>⚙</span> সেটিংস</a>
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
            <div><h1>স্বাগতম!</h1><p>আপনার ভূমিঘর ড্যাশবোর্ডে আপনাকে স্বাগতম।</p></div>
          </div>
          <div className="bh-user-pill"><span className="bh-avatar">👤</span><span>{session.user.email}</span><button type="button" onClick={() => supabase.auth.signOut()}>লগআউট ↗</button></div>
        </header>

        {activePage === 'map' ? (
          <section className="bh-map-page" id="land-map">
            <div className="bh-map-hero">
              <div><span>ভূমিঘর · উন্নত ফিচার</span><h2>জমির ম্যাপ</h2><p>স্যাটেলাইট ম্যাপে জমির অবস্থান দেখুন এবং মৌজা/দাগের নকশা সংযুক্ত করুন।</p></div>
              <MapPin size={42} />
            </div>
            <div className="bh-map-toolbar">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontWeight: 700 }}>
                জমির রেকর্ড নির্বাচন
                <select
                  value={selectedMapRecordId}
                  onChange={event => setSelectedMapRecordId(event.target.value)}
                  disabled={!records.length || mapLoading || mapSaving}
                  style={{ minWidth: '220px', maxWidth: '100%', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                >
                  {!records.length && <option value="">আগে জমির রেকর্ড যোগ করুন</option>}
                  {records.map(record => (
                    <option key={record.id} value={String(record.id)}>
                      {[record.mouza, record.dag_number ? `দাগ ${record.dag_number}` : '', record.deed_number ? `দলিল ${record.deed_number}` : ''].filter(Boolean).join(' · ') || 'নামবিহীন জমির রেকর্ড'}
                    </option>
                  ))}
                </select>
              </label>
              <button className={mapLayer === 'satellite' ? 'selected' : ''} onClick={() => setMapLayer('satellite')} type="button">স্যাটেলাইট ম্যাপ</button>
              <button className={mapLayer === 'street' ? 'selected' : ''} onClick={() => setMapLayer('street')} type="button">সাধারণ ম্যাপ</button>
              <button type="button" className="bh-map-gps" onClick={() => {
                if (!navigator.geolocation) { setMapStatus('এই ব্রাউজারে GPS সুবিধা নেই।'); return }
                setMapStatus('আপনার অবস্থান খোঁজা হচ্ছে...')
                navigator.geolocation.getCurrentPosition(position => {
                  const map = leafletMapRef.current
                  if (map && window.L) {
                    const point = [position.coords.latitude, position.coords.longitude]
                    map.setView(point, 17)
                    window.L.marker(point).addTo(map).bindPopup('আপনার বর্তমান অবস্থান').openPopup()
                    setMapStatus('GPS অবস্থান পাওয়া গেছে।')
                  }
                }, error => setMapStatus('GPS পাওয়া যায়নি: ' + error.message), { enableHighAccuracy: true, timeout: 12000 })
              }}>◎ GPS লোকেশন</button>
            </div>
            <div className="bh-map-layout">
              <div className="bh-map-card">
                <div ref={mapContainerRef} className="bh-leaflet-map" />
                <div className="bh-map-help">ম্যাপে ক্লিক করে সীমানার পয়েন্ট দিন। ৩টি বা তার বেশি পয়েন্ট দিলে জমির সীমানা দেখা যাবে।</div>
                <div className="bh-map-actions">
                  <button type="button" onClick={() => setMapPoints([])}>সীমানা মুছুন</button>
                  <button type="button" onClick={() => {
                    const map = leafletMapRef.current
                    if (map && mapPoints.length) map.fitBounds(mapPoints, { padding: [30, 30] })
                  }}>সীমানা দেখুন</button>
                </div>
              </div>
              <aside className="bh-map-side">
                <h3>মৌজা ও দাগের নকশা</h3>
                <p>আপনার কাছে থাকা মৌজা/দাগের নকশার ছবি বা PDF এখানে নির্বাচন করে দেখতে পারবেন।</p>
                <label className="bh-map-upload">
                  <Upload size={18}/> নকশা আপলোড করুন
                  <input type="file" accept="image/*,.pdf,application/pdf" onChange={event => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    const valid = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)
                    if (!valid) {
                      setMapStatus('শুধু PDF, JPG ও PNG নকশা আপলোড করা যাবে।')
                      event.target.value = ''
                      return
                    }
                    if (file.size > 50 * 1024 * 1024) {
                      setMapStatus('নকশার ফাইল ৫০ MB-এর বেশি হতে পারবে না।')
                      event.target.value = ''
                      return
                    }
                    if (mouzaMapFile?.url && mouzaMapFile.localPreview) URL.revokeObjectURL(mouzaMapFile.url)
                    setMouzaMapFile({ file, name: file.name, url: URL.createObjectURL(file), type: file.type, localPreview: true })
                    setRemoveSavedMapFile(false)
                    event.target.value = ''
                  }}/>
                </label>
                {mouzaMapFile ? (
                  <div className="bh-mouza-preview">
                    <strong>{mouzaMapFile.name || mouzaMapFile.file?.name || 'মৌজা নকশা'}</strong>
                    {mouzaMapFile.type === 'application/pdf'
                      ? <a href={mouzaMapFile.url} target="_blank" rel="noreferrer">PDF নকশা খুলুন</a>
                      : <a href={mouzaMapFile.url} target="_blank" rel="noreferrer"><img src={mouzaMapFile.url} alt="মৌজা নকশার প্রিভিউ"/></a>}
                    <button type="button" onClick={() => {
                      if (mouzaMapFile.url && mouzaMapFile.localPreview) URL.revokeObjectURL(mouzaMapFile.url)
                      setMouzaMapFile(null)
                      setRemoveSavedMapFile(true)
                    }}>নকশা সরান</button>
                  </div>
                ) : <div className="bh-map-empty">এখনো কোনো নকশা নির্বাচন করা হয়নি।</div>}
                <div className="bh-map-info"><strong>সীমানার পয়েন্ট</strong><b>{mapPoints.length.toLocaleString('bn-BD')} টি</b><small>নির্বাচিত জমির ম্যাপ</small></div>
                <div style={{ marginTop: '14px', padding: '15px', border: '1px solid #bbf7d0', borderRadius: '12px', background: '#f0fdf4' }}>
                  <h3 style={{ margin: '0 0 8px', color: '#166534', fontSize: '16px' }}>জমির পরিমাণ (আনুমানিক)</h3>
                  {mapPoints.length >= 3 ? (
                    <>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#14532d', marginBottom: '8px' }}>{formatArea(measuredArea.shotok)} শতক</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                        <div><strong>{formatArea(measuredArea.sqm)}</strong><br/>বর্গমিটার</div>
                        <div><strong>{formatArea(measuredArea.sqft)}</strong><br/>বর্গফুট</div>
                        <div><strong>{formatArea(measuredArea.katha)}</strong><br/>কাঠা</div>
                        <div><strong>{formatArea(measuredArea.bigha)}</strong><br/>বিঘা</div>
                        <div><strong>{formatArea(measuredArea.acre)}</strong><br/>একর</div>
                      </div>
                    </>
                  ) : (
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>আয়তন হিসাব করতে ম্যাপে কমপক্ষে ৩টি সীমানার পয়েন্ট দিন।</p>
                  )}
                  <small style={{ display: 'block', marginTop: '10px', color: '#64748b', lineHeight: 1.5 }}>
                    হিসাবটি আঁকা সীমানার ভিত্তিতে আনুমানিক। কাঠা ও বিঘার রূপান্তরে প্রচলিত বাংলাদেশি মান (১ কাঠা = ৭২০ বর্গফুট, ১ বিঘা = ২০ কাঠা) ব্যবহার করা হয়েছে।
                  </small>
                </div>
                <button type="button" className="primary" onClick={saveLandMap} disabled={!selectedMapRecordId || mapSaving || mapLoading}>
                  {mapSaving ? 'সংরক্ষণ হচ্ছে...' : 'ম্যাপ সংরক্ষণ করুন'}
                </button>
              </aside>
            </div>
            <div className="bh-map-status"><span>●</span>{mapStatus}</div>
            <p className="bh-map-disclaimer">দ্রষ্টব্য: ম্যাপ সংরক্ষণ করতে একটি জমির রেকর্ড নির্বাচন করে “ম্যাপ সংরক্ষণ করুন” চাপুন। সরকারি দাগের সঠিক সীমানা নিশ্চিত করতে নির্ভরযোগ্য/সরকারি মৌজা নকশা প্রয়োজন।</p>
          </section>
        ) : <>
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
          <article className="bh-panel">
            <h3><span>⌁</span> কাগজপত্রের ধরন অনুযায়ী</h3>
            {chartStats.categories.length ? <div className="bh-category-list">{chartStats.categories.slice(0,5).map((item,index)=><div key={item.name}><div><span>{item.name}</span><b>{item.count.toLocaleString('bn-BD')} টি</b></div><i><em style={{width:`${chartStats.maxCategory ? item.count/chartStats.maxCategory*100 : 0}%`}} /></i></div>)}</div> : <p className="bh-empty-chart">কোনো কাগজপত্র সংযুক্ত নেই।</p>}
          </article>
        </section>

        <section className="bh-lower-grid">
          <article className="bh-panel bh-recent-panel">
            <div className="bh-panel-heading"><h3><span>◷</span> সাম্প্রতিক জমির রেকর্ড</h3><a href="#records-section">সব দেখুন →</a></div>
            {records.length ? <div className="bh-recent-table-wrap"><table className="bh-recent-table"><thead><tr><th>#</th><th>মৌজা</th><th>দাগ নং</th><th>খতিয়ান নং</th><th>মোট জমি</th><th>কাগজপত্র</th><th>দেখুন</th></tr></thead><tbody>{records.slice(0,5).map((r,index)=><tr key={r.id}><td>{(index+1).toLocaleString('bn-BD')}</td><td>{r.mouza || '—'}</td><td>{r.dag_number || '—'}</td><td>{r.khatian_number || '—'}</td><td>{r.total_land ?? '—'} {r.total_land_unit || 'শতক'}</td><td>{(r.land_record_files||[]).length.toLocaleString('bn-BD')} টি</td><td><button type="button" className="bh-view-btn" onClick={()=>setPreviewRecord(r)}>দেখুন</button></td></tr>)}</tbody></table></div> : <p className="bh-empty-chart">এখনো কোনো জমির তথ্য সংরক্ষণ করা হয়নি।</p>}
          </article>
          <article className="bh-panel bh-quick-panel">
            <h3><span>⚡</span> দ্রুত কাজের সুবিধা</h3>
            <div className="bh-quick-grid">
              <button type="button" onClick={()=>{setForm({...emptyForm});setEditingRecord(null);setPendingFiles([]);setShowForm(true);document.getElementById('records-section')?.scrollIntoView({behavior:'smooth'})}}><b>＋</b>নতুন জমি যোগ করুন</button>
              <button type="button" onClick={()=>{document.getElementById('land-search')?.focus();document.getElementById('records-section')?.scrollIntoView({behavior:'smooth'})}}><b>⌕</b>সার্চ করুন</button>
              <button type="button" disabled={!records.length} onClick={()=>setPrintRecord(records)}><b>▣</b>সম্মিলিত PDF</button>
              <button type="button" onClick={exportRecordsCsv} disabled={!records.length}><b>⇩</b>CSV Export</button>
            </div>
          </article>
        </section>

        {message && (
          <div className="notice">
            {message}
            <button onClick={() => setMessage('')}><X size={15} /></button>
          </div>
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

        <section className="records" id="records-section">
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

        </>}
        <style>{`
          .bh-map-page{margin:0 0 22px}.bh-map-hero{display:flex;justify-content:space-between;align-items:center;padding:22px 25px;border-radius:16px;background:linear-gradient(110deg,#08743b,#16a34a);color:#fff;margin-bottom:14px}.bh-map-hero span{font-size:12px;opacity:.85}.bh-map-hero h2{margin:5px 0;font-size:26px}.bh-map-hero p{margin:0;font-size:13px}.bh-map-toolbar{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:13px}.bh-map-toolbar button,.bh-map-actions button{border:1px solid #cbded1;border-radius:9px;background:#fff;padding:10px 15px;color:#20543a;font-weight:700;cursor:pointer}.bh-map-toolbar button.selected,.bh-map-toolbar .bh-map-gps{background:#087b40;color:#fff;border-color:#087b40}.bh-map-layout{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(250px,.8fr);gap:14px}.bh-map-card,.bh-map-side{background:#fff;border:1px solid #dce9df;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px #163d1d0a}.bh-leaflet-map{height:510px;width:100%;background:#e8f0e9;z-index:1}.bh-map-help{padding:10px 13px;background:#f3faf5;color:#52645a;font-size:12px}.bh-map-actions{display:flex;gap:8px;padding:10px}.bh-map-side h3{margin:0;padding:15px;background:#08743b;color:white;font-size:16px}.bh-map-side>p{font-size:12px;color:#66756c;padding:0 14px;line-height:1.7}.bh-map-upload{margin:10px 14px;padding:13px;border:1px dashed #14934c;border-radius:10px;background:#f0faf3;color:#08743b;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;cursor:pointer}.bh-map-upload input{display:none}.bh-map-empty,.bh-map-info{margin:12px 14px;padding:14px;border-radius:10px;background:#f5f8f6;color:#68766e;font-size:12px}.bh-map-info{display:grid;gap:5px;color:#345343}.bh-map-info b{font-size:22px;color:#08743b}.bh-map-info small{color:#77847c}.bh-mouza-preview{margin:12px 14px;display:grid;gap:9px;font-size:12px;overflow-wrap:anywhere}.bh-mouza-preview img{width:100%;max-height:300px;object-fit:contain;background:#f3f5f4;border:1px solid #e0e7e2;border-radius:8px}.bh-mouza-preview button{justify-self:start;border:0;background:#fff0f0;color:#b42318;border-radius:7px;padding:7px 10px;cursor:pointer}.bh-map-status{margin-top:13px;padding:12px 15px;border-radius:10px;background:#eaf8ee;color:#245b37;font-size:12px}.bh-map-status span{color:#0b9b4b;margin-right:8px}.bh-map-disclaimer{font-size:11px;color:#758178;line-height:1.7;margin:10px 2px}@media(max-width:850px){.bh-map-layout{grid-template-columns:1fr}.bh-leaflet-map{height:390px}}@media(max-width:560px){.bh-map-hero{padding:16px}.bh-map-hero h2{font-size:21px}.bh-leaflet-map{height:340px}}

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

        <style>{`
          .bh-app-shell{display:grid!important;grid-template-columns:226px minmax(0,1fr)!important;min-height:100vh!important;background:#f3f7fb!important;align-items:stretch!important}
          .bh-sidebar{background:linear-gradient(180deg,#08713e 0%,#005b38 72%,#064c30 100%);color:#fff;display:flex;flex-direction:column;min-height:100vh;position:sticky;top:0;height:100vh;overflow:auto;z-index:20}
          .bh-brand{background:#fff;color:#12623d;text-align:center;padding:20px 14px 17px;display:flex;align-items:center;flex-direction:column;gap:3px}
          .bh-brand img{width:82px;height:82px;object-fit:contain}.bh-brand strong{font-size:25px;line-height:1.2}.bh-brand span{font-size:12px;font-weight:800;letter-spacing:.5px}.bh-brand small{font-size:11px;color:#52645a;margin-top:8px;line-height:1.5}
          .bh-nav{display:grid;gap:5px;padding:17px 11px}.bh-nav a,.bh-nav button{border:0;background:transparent;color:#effff5;text-decoration:none;text-align:left;display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:10px;font:600 14px inherit;cursor:pointer}.bh-nav a span,.bh-nav button span{font-size:21px;width:23px;text-align:center}.bh-nav a.active,.bh-nav a:hover,.bh-nav button:hover{background:#19a83d;color:#fff;box-shadow:0 5px 14px #003d2b55}
          .bh-sidebar-bottom{margin-top:auto;text-align:center;padding:15px 12px 18px;background:linear-gradient(0deg,#06472d,#08713e)}.bh-landscape{font-size:25px;padding:10px 0}.bh-sidebar-bottom strong{display:block;font-size:19px}.bh-sidebar-bottom small{display:block;font-size:11px;line-height:1.5;margin:5px auto;max-width:170px}.bh-sidebar-bottom p{border-top:1px solid #ffffff30;padding-top:12px;font-size:11px;line-height:1.6;margin:12px 0 0}
          .bh-content{width:100%;max-width:none!important;margin:0!important;padding:0 25px 22px!important;box-sizing:border-box;min-width:0}
          .bh-topbar{min-height:95px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 2px;background:linear-gradient(105deg,#e7f7eb,#f5fbff 58%,#e6f2e9);border-bottom:1px solid #d9e8df;margin:0 -25px 18px;padding-left:25px;padding-right:25px}
          .bh-user-welcome{display:flex;align-items:center;gap:13px}.bh-wave{font-size:32px}.bh-user-welcome h1{font-size:24px;margin:0;color:#153d2b}.bh-user-welcome p{margin:4px 0 0;color:#557064;font-size:13px}.bh-user-pill{display:flex;align-items:center;gap:9px;background:#ffffffc9;border:1px solid #e1eae4;border-radius:30px;padding:7px 10px;font-size:12px;max-width:55%}.bh-user-pill>span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bh-avatar{width:32px;height:32px;border-radius:50%;background:#e5edf1;display:grid;place-items:center;font-size:20px}.bh-user-pill button{border:0;background:#e9f4ed;color:#17613d;border-radius:20px;padding:7px 10px;font-weight:700;cursor:pointer;white-space:nowrap}
          .bh-hero{min-height:108px;border-radius:17px;padding:19px 24px;margin:0 0 17px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#fff;background:linear-gradient(100deg,#08713e,#159b4c 55%,#b5dcae);box-shadow:0 7px 18px #0b62301b;overflow:hidden}.bh-hero span{font-size:11px;opacity:.85}.bh-hero h2{font-size:22px;margin:5px 0}.bh-hero p{font-size:12px;margin:0;opacity:.9}.bh-hero img{width:82px;height:82px;object-fit:contain;background:#ffffffed;border-radius:50%;padding:7px}
          .bh-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:17px}.bh-stat{display:flex;align-items:center;gap:12px;min-width:0;padding:15px;border-radius:15px;border:1px solid #dce8ee;box-shadow:0 4px 12px #1d3b5010}.bh-stat>div{min-width:0}.bh-stat-icon{width:48px;height:48px;flex:0 0 48px;border-radius:50%;display:grid;place-items:center;font-size:24px;font-weight:800}.bh-stat small{display:block;color:#52616b;font-size:11px}.bh-stat strong{display:block;font-size:21px;line-height:1.5;color:#122f25;overflow-wrap:anywhere}.bh-stat-blue{background:#e5f2ff;border-color:#b8d9fb}.bh-stat-blue .bh-stat-icon{background:#1479e8;color:white}.bh-stat-green{background:#e5f8e8;border-color:#b6e8bd}.bh-stat-green .bh-stat-icon{background:#0b8b39;color:white}.bh-stat-orange{background:#fff1d8;border-color:#f5d39a}.bh-stat-orange .bh-stat-icon{background:#f28a0b;color:white}.bh-stat-purple{background:#f0e7ff;border-color:#d7c1ff}.bh-stat-purple .bh-stat-icon{background:#7738d7;color:white}
          .bh-chart-grid{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:13px;margin-bottom:17px}.bh-panel{background:#fff;border:1px solid #dce6ee;border-radius:15px;overflow:hidden;box-shadow:0 4px 12px #193e5410;min-width:0}.bh-panel>h3,.bh-panel-heading{margin:0;padding:12px 15px;background:#08713e;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;gap:9px}.bh-panel>h3 span,.bh-panel-heading h3 span{font-size:19px}.bh-bar-chart{height:180px;display:flex;align-items:stretch;justify-content:space-around;gap:10px;padding:18px 17px 0;border-bottom:1px solid #e5edf3;background:repeating-linear-gradient(to bottom,transparent 0,transparent 43px,#edf2f7 44px)}.bh-bar-item{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px}.bh-bar-item strong{font-size:11px;color:#253a32}.bh-bar-track{height:115px;width:min(48px,80%);display:flex;align-items:flex-end;background:#edf3f8;border-radius:7px 7px 0 0;overflow:hidden}.bh-bar-track i{width:100%;display:block;border-radius:7px 7px 0 0;background:linear-gradient(180deg,#2498f4,#0870d4)}.bh-bar-item:nth-child(2) .bh-bar-track i{background:linear-gradient(180deg,#62d83e,#1ba52d)}.bh-bar-item:nth-child(3) .bh-bar-track i{background:linear-gradient(180deg,#ffb53b,#f28a0b)}.bh-bar-item:nth-child(4) .bh-bar-track i{background:linear-gradient(180deg,#a76af3,#7738d7)}.bh-bar-item small{font-size:11px;padding:5px 0;color:#405249}.bh-chart-note{font-size:10px;color:#7b8b84;margin:8px 14px 12px}.bh-empty-chart{font-size:12px;color:#718178;padding:16px}.bh-mouza-list{padding:12px 14px;display:grid;gap:13px}.bh-mouza-row{display:flex;align-items:center;gap:9px}.bh-dot{width:12px;height:12px;border-radius:4px;flex:0 0 12px;background:#1686ec}.dot-1{background:#1caa42}.dot-2{background:#f49a17}.dot-3{background:#8850dc}.bh-mouza-row div{min-width:0;flex:1}.bh-mouza-row strong,.bh-mouza-row small{display:block;overflow-wrap:anywhere}.bh-mouza-row strong{font-size:12px;color:#263d32}.bh-mouza-row small{font-size:10px;color:#75837c;margin-top:3px}.bh-mouza-row>b{font-size:11px;color:#52645a}.bh-category-list{padding:13px 14px;display:grid;gap:14px}.bh-category-list>div>div{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#35483f;margin-bottom:5px}.bh-category-list>div>div span{overflow-wrap:anywhere}.bh-category-list>div>div b{white-space:nowrap}.bh-category-list i{display:block;height:8px;border-radius:20px;background:#edf2f5;overflow:hidden}.bh-category-list em{display:block;height:100%;background:linear-gradient(90deg,#13a44b,#66c84a);border-radius:20px}
          .bh-lower-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(245px,.9fr);gap:13px;margin-bottom:20px}.bh-panel-heading{justify-content:space-between}.bh-panel-heading h3{font-size:15px;margin:0;display:flex;align-items:center;gap:8px}.bh-panel-heading a{font-size:11px;color:white;text-decoration:none;border:1px solid #ffffffa8;border-radius:8px;padding:6px 9px;white-space:nowrap}.bh-recent-table-wrap{overflow:auto;padding:10px}.bh-recent-table{border-collapse:collapse;width:100%;font-size:11px;white-space:nowrap}.bh-recent-table th{background:#f0f5fa;color:#34463e;font-weight:800}.bh-recent-table th,.bh-recent-table td{padding:9px 8px;border:1px solid #e0e9f0;text-align:left}.bh-recent-table td{color:#405148}.bh-view-btn{border:0;border-radius:7px;background:#e5f1ff;color:#0871d6;padding:5px 9px;font-size:10px;font-weight:700;cursor:pointer}.bh-quick-grid{padding:11px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.bh-quick-grid button{min-height:82px;border:1px solid #cce7d3;border-radius:12px;background:#e8f9ed;color:#194c30;font-weight:700;font-size:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer}.bh-quick-grid button:nth-child(2){background:#e8f3ff;border-color:#c5dcfb;color:#145a9d}.bh-quick-grid button:nth-child(3){background:#f2eaff;border-color:#dcc8ff;color:#6530a8}.bh-quick-grid button:nth-child(4){background:#e2fbf3;border-color:#b8edda;color:#08754b}.bh-quick-grid button:disabled{opacity:.45;cursor:not-allowed}.bh-quick-grid b{font-size:24px;line-height:1}
          #records-section{scroll-margin-top:16px}.bh-content .toolbar{margin-top:18px}.bh-content .records{margin-top:18px}.bh-content .records>.section-title{border-bottom:1px solid #dce8df;padding-bottom:10px}.bh-content>footer{text-align:center;color:#718178;font-size:11px;padding:18px}
          @media(max-width:1050px){.bh-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bh-chart-grid{grid-template-columns:1fr 1fr}.bh-chart-grid .bh-panel:first-child{grid-column:span 2}}
          @media(max-width:760px){.bh-app-shell{grid-template-columns:1fr!important}.bh-sidebar{position:relative;height:auto;min-height:0}.bh-brand{flex-direction:row;justify-content:flex-start;text-align:left;padding:9px 14px}.bh-brand img{width:45px;height:45px}.bh-brand strong{font-size:18px}.bh-brand span,.bh-brand small{display:none}.bh-nav{display:flex;overflow:auto;padding:7px;gap:6px}.bh-nav a,.bh-nav button{white-space:nowrap;padding:9px 11px;font-size:12px}.bh-nav a span,.bh-nav button span{font-size:16px;width:auto}.bh-sidebar-bottom{display:none}.bh-content{padding:0 12px 18px!important}.bh-topbar{margin:0 -12px 12px;padding:10px 12px;min-height:70px}.bh-user-welcome h1{font-size:18px}.bh-user-welcome p{font-size:10px}.bh-wave{font-size:23px}.bh-user-pill{max-width:48%;font-size:10px}.bh-user-pill button{display:none}.bh-hero{padding:14px}.bh-hero h2{font-size:17px}.bh-hero p{font-size:10px}.bh-hero img{width:58px;height:58px}.bh-stat-grid{gap:8px}.bh-stat{padding:10px;gap:8px}.bh-stat-icon{width:36px;height:36px;flex-basis:36px;font-size:18px}.bh-stat strong{font-size:15px}.bh-stat small{font-size:9px}.bh-chart-grid{grid-template-columns:1fr}.bh-chart-grid .bh-panel:first-child{grid-column:auto}.bh-lower-grid{grid-template-columns:1fr}.bh-panel>h3,.bh-panel-heading{font-size:13px}.bh-recent-table th,.bh-recent-table td{padding:7px 6px}}
        `}</style>
        <footer>Developed by Muktar Graphics</footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)

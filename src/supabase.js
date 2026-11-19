import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Supabase config missing. Check your .env file.')
}

export const supabase = createClient(url || '', key || '')
export const STORAGE_BUCKET = import.meta.env.VITE_STORAGE_BUCKET || 'land-documents'

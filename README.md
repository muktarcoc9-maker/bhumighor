# ভূমিঘর (BHUMIGHOR)

React + Vite + Supabase ভিত্তিক PWA starter.

## চালানোর নিয়ম
1. Node.js LTS ইনস্টল করুন।
2. এই ফোল্ডারে Terminal খুলুন।
3. `npm install`
4. `npm run dev`
5. ব্রাউজারে Vite যে Local URL দেখাবে সেটি খুলুন।

## Supabase
`.env` ফাইলে Project URL, Publishable Key এবং Bucket name দেওয়া আছে। Publishable key ব্রাউজারে ব্যবহারের জন্য; `service_role` বা Secret key কখনো এখানে রাখবেন না।

Supabase-এ আগে তৈরি করা থাকতে হবে:
- `land-documents` নামে Private Storage bucket
- `public.land_records` টেবিল
- `storage.objects` এবং `land_records`-এর RLS policies

এই অ্যাপ `land_records`-এ নিম্নলিখিত কলাম ব্যবহার করে:
`user_id, deed_number, donor_name, recipient_name, mouza, sheet_number, dag_type, dag_number, khatian_type, khatian_number, mutation_case_number, holding_number, total_land, owned_land, file_path, created_at`.

## গুরুত্বপূর্ণ নিরাপত্তা নোট
- Bucket অবশ্যই Private থাকবে।
- Storage policy-তে object path-এর প্রথম folder অবশ্যই `auth.uid()` হতে হবে।
- Authentication > URL Configuration-এ স্থানীয় development URL ও production domain প্রয়োজনমতো যোগ করুন।
- Email confirmation চালু থাকলে রেজিস্ট্রেশনের পর ইমেইল নিশ্চিত করতে হবে।
- Supabase Free plan-এর storage/database/egress সীমা আছে; দলিলের আলাদা ব্যাকআপ রাখুন।
- এই starter production security audit বা legal-grade archival system নয়। বাস্তব দলিল রাখার আগে নিজে পরীক্ষা করুন।

Developed by Muktar Graphics

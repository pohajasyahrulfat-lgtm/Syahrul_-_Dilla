# Supabase backend

This folder contains the database schema for replacing the Ulems API.

## Setup

1. Create a project at https://supabase.com.
2. Open **SQL Editor** and run [`schema.sql`](schema.sql).
3. Open **Authentication > Providers > Email** and enable email/password sign-up.
4. Create the first user from **Authentication > Users > Add user**.
5. Insert that user's invitation in **Table Editor > invitations**. Use the user's UUID as `owner_id` and choose a unique `slug`.
6. Copy the project's URL and anon key from **Project Settings > API**. The anon key is safe for browser code; never expose the service-role key.
7. If the schema was run before the asset columns were added, run the complete updated `schema.sql` again. It is idempotent and will add the missing columns and Storage bucket.

Example invitation row:

```sql
insert into public.invitations (owner_id, slug, groom_name, bride_name, event_date, location)
values (
  'PASTE_AUTH_USER_UUID_HERE',
  'syahrul-dilla',
  'Nama Mempelai Pria',
  'Nama Mempelai Wanita',
  '2026-12-12 09:30:00+07',
  'Lokasi acara'
);
```

## Important

The guest page reads the published invitation from Supabase using the `slug` query parameter. Open it with `?slug=syahrul-dilla`. The dashboard login and invitation editor now use Supabase Auth/REST, including photo and music uploads. Legacy comment, like, and statistics controls are not migrated yet.

Never commit a Supabase service-role key. Only the project URL and anon/publishable key belong in frontend configuration.

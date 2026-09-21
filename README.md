# All Stars Football Club Registration Website

This is a real registration portal with:
- Player registration
- Management registration
- Passport photograph upload
- Supabase database
- Private document storage
- Supabase Auth admin login
- Admin approval/rejection dashboard
- Responsive All Stars navy/blue/gold design

## 1. Create the Supabase backend

1. Create a new Supabase project for All Stars Football Club.
2. Open SQL Editor.
3. Run `supabase.sql`.
4. In Authentication > Users, create the first admin account with email/password.
5. Copy that user's UUID.
6. Run:
   `insert into public.admins (user_id) values ('THE-ADMIN-UUID');`

## 2. Configure environment variables

Copy `.env.example` to `.env` and add:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Never put the service-role key into browser JavaScript or GitHub.

## 3. Configure the browser Supabase values

Open `public/app.js` and replace:
- SUPABASE_URL
- SUPABASE_ANON_KEY

Use the publishable/anon key only. Never use the service-role key here.

## 4. Install and run

`npm install`
`npm start`

Then open:
`http://localhost:10000`

## 5. Render deployment

Create a Render Web Service from the GitHub repository.
- Build command: `npm install`
- Start command: `npm start`
- Add the three Supabase environment variables in Render.
- The app listens on Render's `PORT` automatically.

## Security notes

The passport bucket is private. The server performs uploads using the service-role key, while administrators read records through Supabase RLS.

For production, add rate limiting/anti-bot protection and a clear retention/deletion policy because registrations contain personal information and may include minors.


## 6. PDF printing

After an authorized administrator logs in, each registration in the dashboard has a **PDF** button.
The PDF contains the submitted registration information, registration ID, status, and (when the private
passport file can be accessed) the passport photograph. The PDF is generated in the administrator's
browser and downloaded as an A4 PDF, ready to print.

The PDF feature does not expose passport images publicly. It requests a short-lived signed URL from
the private Supabase storage bucket while the administrator is authenticated.

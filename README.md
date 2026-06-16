# AniChan Web

AniChan Web is a **modern, real‑time anime tracker and community platform** built with **vanilla HTML, CSS, and JavaScript**, powered by **Supabase** for backend services and **Vercel** for hosting and serverless functions.

Browse anime, manage profiles, connect with friends, chat in real time, leave comments, and receive weekly reports — all from a clean, responsive interface.

---

## ✨ Features

### 📺 Anime Library
- Browse **Latest Releases** (currently airing, upcoming, finished)
- **Full‑text live search** across English, Japanese, and main titles
- Detailed **anime info pages**: synopsis, metadata, genres, episodes, external links
- **Episode grid** with sorting (asc/desc)
- Episode cards with duration badges
- Genre, type, status, season, and alphabetical directory pages

### 👤 User System
- **Email/password** and **Google OAuth** sign‑up / login
- Custom **onboarding flow** for Google users
- User **profiles** with online status, avatar, and editable details
- **Crop avatar** before upload (client‑side crop via Cropper.js, server‑side resize to 256 px)
- Inactivity auto‑logout

### 💬 Comments
- YouTube‑style **flat threading** (no deep indent)
- Like / dislike with secure Supabase RPC functions
- Reply with @mention auto‑prefill
- Delete own comments (cascade deletion)
- Publicly visible; only logged‑in users can post

### 💬 Real‑Time Chat
- Telegram‑inspired **two‑panel layout** (messages directory + conversation room)
- Real‑time **messaging**, typing indicators, online presence
- Swipe‑to‑reply, long‑press context menu (edit, delete)
- Unread badges, date separators, read receipts
- **Voice / video call placeholders** (UI ready, WebRTC signalling in place)

### 🛠️ Admin Panel
- **Broadcast messages** (shown on homepage)
- **Site logo** upload
- **Auto‑Fetch**: search Jikan, fill form, bulk import, fix missing fields, delete duplicates
- **Collection management** with pagination
- **Member management** (suspend, unsuspend, delete)
- **Purge Cache** (forces all open tabs to reload)
- **Regenerate Sitemap** (uploads to Supabase Storage)

### ⚡ Automation
- **Cron job** (Supabase `pg_cron`) runs every 30 minutes to fetch **currently airing anime** from Jikan, inserts new ones, and **updates** existing ones (episode count, status, etc.)
- **Index page sorting**: Currently Airing → Not yet aired → Finished, newest first
- **Cache version polling**: index page reloads automatically when admin purges cache

### 🧰 Serverless Functions (Vercel)
- **`/api/resize-avatar`** – crops & resizes avatars to 256 px using Sharp, uploads to Supabase Storage
- **`/api/admin/purge-cache`** – increments cache version in settings
- **`/api/admin/regenerate-sitemap`** – generates and uploads sitemap.xml

### 🌍 SEO
- Sitemap can be submitted to Google / Bing
- Auto‑regenerated via admin panel

---

## 🛠️ Tech Stack

| Category          | Technology                           |
|-------------------|--------------------------------------|
| Frontend          | HTML, CSS, JavaScript (vanilla)      |
| Backend           | Supabase (Auth, DB, Storage, Realtime, Edge Functions) |
| Serverless        | Vercel Functions (Node.js)           |
| Image Processing  | Cropper.js (client), Sharp (server)  |
| Email             | Resend                               |
| External API      | Jikan (MyAnimeList unofficial API)   |
| Hosting           | Vercel                               |
| Database          | PostgreSQL (via Supabase)            |

---

## 📁 Project Structure

```

AniChan-web/
├── index.html                  # Home page (Latest Releases, search)
├── anime_info.html             # Anime details, episodes, comments
├── anime.html                  # Alphabetical directory
├── episode_info.html           # Episode page (video placeholder)
├── chat.html                   # Real‑time chat
├── profile.html                # User profile & avatar crop
├── user_login.html             # Login / Signup / Google OAuth
├── admin.html                  # Admin dashboard
├── admin_login.html            # Admin login
├── find_friends.html           # Friends list
├── forgot_password.html        # Password reset
├── reset_password.html         # New password form
├── genre.html, type.html, status.html, season.html   # Filter pages
├── i18n.js                     # English / Japanese translations
├── api/                        # Vercel serverless functions
│   ├── resize-avatar.js
│   └── admin/
│       ├── purge-cache.js
│       └── regenerate-sitemap.js
├── css/                        # (optional modular CSS)
├── js/                         # (optional modular JS)
├── package.json                # Dependencies (sharp, resend, etc.)
└── README.md

```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/brandon-300/AniChan-web.git
cd AniChan-web
```

2. Open locally

Because this is a frontend web app, you can open index.html directly or serve it with a local server:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

3. Configure Supabase

Create a Supabase project and set the following environment variables (in Vercel or a local .env):

Variable Description
SUPABASE_URL Your Supabase project URL
SUPABASE_ANON_KEY Public anon key
SUPABASE_SERVICE_ROLE_KEY Service role key (for serverless functions)
ADMIN_EMAIL Your admin email address

Run the necessary SQL migrations to create tables (anime, profiles, chat_rooms, messages, anime_comments, calls, call_signals, etc.), RLS policies, and the fetch_airing_anime Postgres function.

4. Deploy to Vercel

Connect your GitHub repository to Vercel. It will automatically detect the static site and serverless functions. Add the environment variables above in Vercel's project settings.

---

⚙️ Usage

1. Open the home page.
2. Sign in or create an account (email/password or Google).
3. Browse anime, view details, leave comments.
4. Use the chat to message other users.
5. Admin panel: manage content, purge cache, regenerate sitemap.

---

🔧 Customization

You can customize almost every aspect by editing the HTML/CSS/JS files. Key configuration points:

· Supabase URL & keys in config.js (or inline)
· Cron schedule in Supabase SQL
· UI strings in i18n.js

---

📦 Deployment

AniChan Web is designed to run on Vercel (static hosting + serverless functions). It also works on any static host if you proxy the API routes to a separate backend.

Before deployment, ensure:

· All Supabase tables and RLS policies are applied
· Environment variables are set in Vercel
· CORS is correctly configured (Supabase automatically handles this)

---

🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Open a pull request

---

📄 License

This project is licensed under the MIT License.

Anyone is free to copy, use, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, provided the license notice is kept.

---

🙏 Acknowledgements

· Supabase – backend services, realtime, cron, auth
· Jikan API – anime metadata
· Resend – email delivery
· Cropper.js – client‑side image cropping
· Sharp – server‑side image resizing
· Vercel – hosting & serverless functions

---

📬 Contact

For questions, feature ideas, or contributions, use the repository issues page on GitHub.
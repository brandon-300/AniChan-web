# AniChan Web

AniChan Web is a lightweight anime community web app built with **HTML, CSS, and JavaScript**, backed by **Supabase** for authentication, data storage, and realtime features.

It is designed to let users browse anime content, manage profiles, connect with friends, and chat in real time from a clean browser-based interface.

## ✨ Features

- Anime browsing and catalog pages
- Anime details, episodes, genres, status, type, and season views
- User authentication
- User profiles
- Friends system
- Realtime chat
- Admin/login-related pages
- Static, fast-loading frontend structure
- Supabase-powered backend services

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend services:** Supabase
- **Database:** Supabase/PostgreSQL
- **Realtime:** Supabase Realtime
- **Authentication:** Supabase Auth
- **Hosting:** Works well on static hosting platforms such as Vercel, Netlify, or GitHub Pages

## 📁 Project Structure

This repository is organized as a multi-page frontend application. Common pages include:

- `index.html`
- `anime.html`
- `anime-details.html`
- `episode.html`
- `genres.html`
- `status.html`
- `type.html`
- `season.html`
- `login.html`
- `profile.html`
- `friends.html`
- `chat.html`
- `admin.html`

You may also have supporting:

- JavaScript files
- CSS files
- assets such as images, icons, and logos

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/brandon-300/AniChan-web.git
cd AniChan-web
```

### 2. Open the project

Because this is a frontend web app, you can open `index.html` directly in your browser or serve it with a local web server.

For example, with Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### 3. Configure Supabase

If your build uses Supabase, make sure your project is connected to:

- Supabase project URL
- Supabase anon/public key
- Any required database tables, policies, and realtime settings

Add those values in the place used by your JavaScript configuration.

## ⚙️ Usage

1. Open the home page.
2. Sign in or create an account.
3. Browse anime content.
4. View details, episodes, genres, and seasons.
5. Use profile, friends, and chat features after authentication.

## 🔧 Customization

You can customize AniChan Web by editing:

- Page content
- Styling in CSS
- Navigation structure
- Supabase queries
- Authentication flow
- Realtime chat behavior
- Profile and friends features

## 📦 Deployment

AniChan Web can be deployed as a static site.

Recommended platforms:

- Vercel
- Netlify
- GitHub Pages

Before deployment, confirm that:

- All links work correctly
- Supabase keys are configured
- CORS / auth settings are correct
- Realtime permissions are set properly

## 🤝 Contributing

Contributions are welcome.

Suggested workflow:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the site locally
5. Open a pull request

## 📄 License

This project is licensed under the **MIT License**.

That means anyone is free to copy, use, modify, merge, publish, distribute, sublicense, and even sell copies of this project, as long as the license notice is kept with the software.

If you want the exact legal text, add a `LICENSE` file containing the full MIT License.

## 🙏 Acknowledgements

- Supabase for backend services
- Anime data sources used by the project
- Everyone who contributes to AniChan Web

## 📬 Contact

For questions, feature ideas, or contributions, use the repository issues page on GitHub.

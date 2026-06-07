# AniChan Web

AniChan Web is a clean, static anime tracking and social web app built with HTML, JavaScript, and Supabase.

It combines anime discovery, library management, user profiles, and real-time chat into one interface.

## Live Demo

- https://ani-chan-web.vercel.app/

## Features

- Anime library browsing and search
- Anime detail pages with episode information
- Browse by genre, status, type, and season
- User authentication flows
- Profile page and friend discovery
- Real-time chat
- Admin pages for management
- Multilingual support via `i18n.js`
- Responsive interface designed for desktop and mobile

## Project Structure

The repository is organized as a multi-page static site, including:

- `index.html` — home page / anime library
- `anime.html` — anime listing and browsing
- `anime_info.html` — anime details
- `episode_info.html` — episode details
- `genre.html` — genre browsing
- `status.html` — status browsing
- `type.html` — type browsing
- `season.html` — seasonal browsing
- `profile.html` — user profile
- `chat.html` — messaging interface
- `find_friends.html` — discover users
- `user_login.html` — user login
- `admin_login.html` — admin login
- `admin.html` — admin dashboard
- `forgot_password.html` — password recovery
- `reset_password.html` — password reset
- `i18n.js` — translation and localization logic

## Tech Stack

- HTML
- JavaScript
- Supabase
- Google Fonts / Inter
- Material Symbols

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/brandon-300/AniChan-web.git
cd AniChan-web
```

### 2. Run the project locally

Because this is a static site, you can open `index.html` directly in your browser.

For a better local development experience, use a simple static server:

```bash
python -m http.server 8000
```

Then open:

```bash
http://localhost:8000
```

## Supabase Setup

AniChan uses Supabase for backend services such as data storage, authentication, realtime updates, and chat presence.

If you are customizing the project, review the Supabase configuration in the JavaScript files and replace it with your own project settings as needed.

## Deployment

This project can be deployed to any static hosting platform, including:

- Vercel
- Netlify
- GitHub Pages

## Contributing

Contributions are welcome. A simple workflow:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Open a pull request

## License

Add a license file if you want to define how others may use or modify this project.

## Acknowledgements

Built for anime fans who want a personal tracker, library, and social space in one app.

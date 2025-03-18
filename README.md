# Spotify Playlist Analysis Tool

## Overview
A charming name, I know. This tool is a powerful Streamlit application that provides comprehensive insights into your Spotify playlists. The application visualizes track popularity, artist distribution, and playlist metrics in an elegant, interactive interface.

## Features
- Authenticate securely with your Spotify account
- Analyze any accessible Spotify playlist (public, private, or collaborative)
- Visualize popularity distribution across tracks
- Identify top artists and their representation
- View detailed track information including album and popularity scores
- Export complete playlist data as CSV for further analysis
- Clean, responsive interface optimized for desktop and mobile

## Prerequisites
- Python 3.8+
- Spotify Developer Account
- Modern web browser

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/milescoler/spotify-analyzer.git
cd spotify-analyzer
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

### 3. Run Setup Script
```bash
python setup.py
```

This will:
- Create a .streamlit/secrets.toml template
- Install all required dependencies

### 4. Configure Spotify API Credentials
1. Visit the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Create a new application
3. Set a Redirect URI to `http://localhost:8501`
4. Update the `.streamlit/secrets.toml` file with your credentials:
```toml
SPOTIPY_CLIENT_ID = "your_client_id_here"
SPOTIPY_CLIENT_SECRET = "your_client_secret_here"
SPOTIPY_REDIRECT_URI = "http://localhost:8501"
```

## Running the Application
```bash
streamlit run app.py
```

The application will open in your default web browser at `http://localhost:8501`.

## Usage Guide
1. Enter a Spotify playlist URL or ID in the input field
2. For first-time use, you'll need to authenticate with your Spotify account
3. The application will display:
   - Playlist metadata (name, owner, track count)
   - Popularity distribution chart
   - Top artists visualization
   - Complete track listing with details
4. Use the "Download as CSV" button to export the data

## Technical Details
This application leverages:
- Streamlit for the web interface
- Spotipy library for Spotify API integration
- Pandas for data manipulation
- Matplotlib and Seaborn for data visualization

## Security Notes
- The application uses OAuth 2.0 for secure authentication
- Your Spotify credentials are never stored by the application
- API keys should be kept confidential and not committed to version control

## Contributing
Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments
- Spotify for providing their comprehensive Web API
- Streamlit team for their excellent data application framework
- The open-source community for their invaluable libraries

## Disclaimer
This project is not affiliated with, endorsed by, or connected to Spotify in any way. It is an independent tool that uses Spotify's publicly available API.

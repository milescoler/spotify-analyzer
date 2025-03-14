# Spotify Playlist Analyzer

## Overview
Spotify Playlist Analyzer is a Streamlit web application that provides deep insights into Spotify playlists. Analyze track popularity, top artists, and download playlist data with ease.

## Features
- Retrieve detailed playlist information
- Visualize track popularity distribution
- Identify top artists in the playlist
- Download playlist track data as CSV
- Interactive and user-friendly interface

## Prerequisites
- Python 3.8+
- Spotify Developer Account

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/spotify-playlist-analyzer.git
cd spotify-playlist-analyzer
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Spotify API Setup
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Create a new application
3. Get your Client ID and Client Secret
4. Set Redirect URI to `http://localhost:8501/callback` for local development
5. Create a `.streamlit/secrets.toml` file with your credentials:
```toml
SPOTIFY_CLIENT_ID = "your_client_id"
SPOTIFY_CLIENT_SECRET = "your_client_secret"
```

## Running the Application
```bash
streamlit run app.py
```

## Usage
1. Enter a Spotify Playlist ID
2. Click "Analyze" to view insights
3. Use the "Use Example Playlist" button to try a sample playlist

## Screenshots
[You can add screenshots here once you have them]

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License.

## Disclaimer
This project is not affiliated with Spotify. It uses the Spotify Web API but is not endorsed by Spotify.
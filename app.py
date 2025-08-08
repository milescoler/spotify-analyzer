import streamlit as st
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Simple page configuration
st.set_page_config(
    page_title="Playlist Analysis",
    page_icon="🎵",
    layout="centered"
)

# CSS
st.markdown("""
<style>
    /* Simple color scheme */
    body {
        background-color: #f9f9f9;
        color: #333;
        font-family: Arial, sans-serif;
        text-align: center;
    }
    
    h1 {
        color: #1DB954;
        text-align: center;
        margin: 2rem 0 1rem 0;
    }
    
    h2, h3 {
        color: #333;
        text-align: center;
        margin-top: 1.5rem;
    }
    
    /* Simple card-like container */
    .simple-box {
        background-color: white;
        border-radius: 8px;
        padding: 15px;
        margin: 10px 0;
        border: 1px solid #eee;
    }
    
    /* Footer credit */
    .footer {
        text-align: center;
        margin-top: 3rem;
        font-size: 0.8rem;
        color: #888;
    }
</style>
""", unsafe_allow_html=True)

def get_spotify_client():
    """Create a Spotify client using Streamlit secrets or environment variables"""
    try:
        # Try using Streamlit secrets first
        try:
            client_id = st.secrets["SPOTIPY_CLIENT_ID"]
            client_secret = st.secrets["SPOTIPY_CLIENT_SECRET"]
            redirect_uri = st.secrets["SPOTIPY_REDIRECT_URI"]
        except Exception:
            # Fall back to direct input if secrets aren't available
            st.info("Spotify API credentials needed. Please provide them below:")
            client_id = st.text_input("Spotify Client ID", type="password")
            client_secret = st.text_input("Spotify Client Secret", type="password")
            redirect_uri = st.text_input("Redirect URI", "http://localhost:8501")
            
            # If any are empty, stop and wait for user input
            if not (client_id and client_secret and redirect_uri):
                st.warning("Please provide all Spotify API credentials to continue")
                return None
        
        # Configure Spotipy client
        auth_manager = SpotifyOAuth(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            scope='playlist-read-private playlist-read-collaborative',
            cache_path=".spotify_cache"  # Adding cache path for easier debugging
        )
        
        # Check if auth manager is working
        try:
            token_info = auth_manager.get_cached_token()
            if not token_info or auth_manager.is_token_expired(token_info):
                st.write("Need to get new token...")
                # Get a user to authorize if needed
                auth_url = auth_manager.get_authorize_url()
                st.markdown(f"Please click this link to authorize: [Spotify Authorization]({auth_url})")
                redirect_code = st.text_input("Enter the redirect code from the URL:")
                if redirect_code:
                    auth_manager.get_access_token(redirect_code)
                else:
                    return None
        except Exception as e:
            st.error(f"Authentication error: {e}")
            return None
            
        return spotipy.Spotify(auth_manager=auth_manager)
        
    except Exception as e:
        st.error(f"Couldn't connect to Spotify: {e}")
        st.info("Tip: Make sure your Spotify app in the developer dashboard has the correct redirect URI")
        st.info("Correct format for redirect URI: http://localhost:8501")
    return None

def get_playlist_tracks(sp, playlist_id):
    """Get tracks from a playlist"""
    tracks = []
    results = sp.playlist_tracks(playlist_id)
    tracks.extend(results['items'])
    
    # Handle pagination for larger playlists
    while results['next']:
        results = sp.next(results)
        tracks.extend(results['items'])
    
    return tracks

def create_track_dataframe(sp, tracks):
    """Create a dataframe of track info and audio features"""
    data = []
    track_ids = []
    for item in tracks:
        track = item.get('track')
        if track and track.get('id'):
            track_ids.append(track['id'])
            data.append({
                'Track ID': track['id'],
                'Track Name': track['name'],
                'Artist': track['artists'][0]['name'],
                'Album': track['album']['name'],
                'Popularity': track.get('popularity', 0),
                'Duration (min)': track['duration_ms'] / 60000
            })

    df = pd.DataFrame(data)
    if df.empty:
        return df

    # Fetch audio features for all tracks
    features = []
    for i in range(0, len(track_ids), 50):
        batch = track_ids[i:i + 50]
        features.extend(sp.audio_features(batch))

    features_df = pd.DataFrame(features)
    features_df = features_df[['id', 'danceability', 'energy', 'valence', 'tempo']]
    features_df.rename(columns={'id': 'Track ID'}, inplace=True)

    df = df.merge(features_df, on='Track ID', how='left')
    return df

def main():
    # Simple title
    st.title("My Spotify Playlist Analyzer")
    st.markdown("*An enhanced tool to analyze your playlists*")
    
    # Get Spotify client
    sp = get_spotify_client()
    if not sp:
        st.stop()
    
    # Playlist input
    st.markdown("### Enter a Playlist")
    playlist_url = st.text_input(
        "Paste the Spotify playlist URL or ID:",
        placeholder="https://open.spotify.com/playlist/0yrEw20VDQlagj59ckglN2?si=ff7d35b7525f424f"
    )
    
    # Example button
    if st.button("Use Example Playlist"):
        playlist_url = "0yrEw20VDQlagj59ckglN2"  # Cole's "January 2025"
    
    if playlist_url:
        # Extract playlist ID if URL was provided
        if 'spotify.com' in playlist_url:
            import re
            match = re.search(r'playlist/([a-zA-Z0-9]+)', playlist_url)
            if match:
                playlist_id = match.group(1)
            else:
                st.error("Sorry, I couldn't find the playlist ID in that URL")
                st.stop()
        else:
            playlist_id = playlist_url
        
        # Show loading message
        with st.spinner("Loading playlist data..."):
            try:
                # Get playlist info
                playlist = sp.playlist(playlist_id)
                playlist_name = playlist['name']
                playlist_owner = playlist['owner']['display_name']
                track_count = playlist['tracks']['total']
                
                # Display playlist info
                st.markdown(f"### {playlist_name}")
                st.write(f"By: {playlist_owner} • {track_count} tracks")
                
                # Get tracks
                tracks = get_playlist_tracks(sp, playlist_id)
                df = create_track_dataframe(sp, tracks)
                
                # Display detailed stats
                st.markdown("### Playlist Stats")
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Avg Popularity", f"{df['Popularity'].mean():.1f}")
                with col2:
                    st.metric("Unique Artists", f"{df['Artist'].nunique()}")
                with col3:
                    total_duration = df['Duration (min)'].sum()
                    st.metric("Total Duration (hrs)", f"{total_duration / 60:.2f}")
                
                # Visualizations
                st.markdown("### Popularity Distribution")
                fig, ax = plt.subplots(figsize=(8, 4))
                sns.histplot(data=df, x='Popularity', kde=True, color='#1DB954', ax=ax)
                ax.set_xlabel('Popularity Score (0-100)')
                ax.set_ylabel('Number of Tracks')
                st.pyplot(fig)

                st.markdown("### Audio Feature Averages")
                feature_cols = ['danceability', 'energy', 'valence', 'tempo']
                feature_means = df[feature_cols].mean()
                fig, ax = plt.subplots(figsize=(8, 4))
                feature_means.plot.bar(ax=ax, color='#1DB954')
                ax.set_ylabel('Average Value')
                plt.xticks(rotation=0)
                st.pyplot(fig)

                st.markdown("### Top Artists")
                top_artists = df['Artist'].value_counts().head(5)
                fig, ax = plt.subplots(figsize=(8, 4))
                top_artists.plot.bar(ax=ax, color='#1DB954')
                ax.set_ylabel('Number of Tracks')
                plt.xticks(rotation=45, ha='right')
                st.pyplot(fig)

                st.markdown("### Top Tracks by Popularity")
                top_tracks = df.sort_values('Popularity', ascending=False).head(10)
                st.dataframe(top_tracks[['Track Name', 'Artist', 'Popularity']])
                
                # Show track list
                st.markdown("### Tracks")
                st.dataframe(df.drop(columns=['Track ID']))
                
                # Download option
                csv = df.to_csv(index=False)
                st.download_button(
                    "Download as CSV",
                    data=csv,
                    file_name=f"{playlist_name}_tracks.csv",
                    mime="text/csv"
                )
                
            except Exception as e:
                st.error(f"Error analyzing playlist: {e}")
                st.info("Make sure the playlist exists and is accessible to your Spotify account")
    
    # Simple footer
    st.markdown("""
    <div class="footer">
        Created as a learning project • 2025
    </div>
    """, unsafe_allow_html=True)

if __name__ == '__main__':
    main()


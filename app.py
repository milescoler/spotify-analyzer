import os
import streamlit as st
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Page configuration
st.set_page_config(
    page_title="Spotify Playlist Analyzer",
    page_icon="🎵",
    layout="wide"
)

def get_spotify_client():
    """
    Create a Spotify client with full authorization using Streamlit secrets
    """
    try:
        # Retrieve credentials from Streamlit secrets
        client_id = st.secrets["SPOTIFY_CLIENT_ID"]
        client_secret = st.secrets["SPOTIFY_CLIENT_SECRET"]
        
        return spotipy.Spotify(auth_manager=SpotifyOAuth(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri='https://spotify-playlist-analyzer.streamlit.app/callback',
            scope='playlist-read-private playlist-read-collaborative user-library-read'
        ))
    except KeyError:
        st.error("Spotify credentials not found. Please check your Streamlit secrets.")
        return None
    except Exception as e:
        st.error(f"Authentication error: {e}")
        return None

def get_playlist_info(sp, playlist_id):
    """
    Get additional playlist information
    """
    try:
        playlist = sp.playlist(playlist_id)
        return {
            'name': playlist['name'],
            'owner': playlist['owner']['display_name'],
            'total_tracks': playlist['tracks']['total'],
            'description': playlist.get('description', 'No description'),
            'image': playlist['images'][0]['url'] if playlist['images'] else None
        }
    except Exception as e:
        st.error(f"Error retrieving playlist info: {e}")
        return None

def get_playlist_features(sp, playlist_id):
    """
    Retrieve track information from a Spotify playlist
    """
    # Get playlist tracks with pagination
    tracks = []
    results = sp.playlist_tracks(playlist_id)
    tracks.extend(results['items'])
    
    while results['next']:
        results = sp.next(results)
        tracks.extend(results['items'])
    
    # Prepare track data
    track_data = []
    for item in tracks:
        track = item['track']
        if track:
            track_data.append({
                'name': track['name'],
                'artist': track['artists'][0]['name'],
                'album': track['album']['name'],
                'id': track['id'],
                'popularity': track.get('popularity', 0)
            })
    
    # Convert to DataFrame
    df = pd.DataFrame(track_data)
    
    return df

def create_popularity_plot(df):
    """
    Create a styled popularity distribution plot
    """
    plt.figure(figsize=(10, 6))
    sns.histplot(data=df, x='popularity', kde=True, color='#1DB954')
    plt.title('Track Popularity Distribution', fontsize=16, fontweight='bold')
    plt.xlabel('Popularity Score', fontsize=12)
    plt.ylabel('Number of Tracks', fontsize=12)
    plt.tight_layout()
    return plt.gcf()

def create_artists_plot(df):
    """
    Create a styled top artists plot
    """
    # Top artists
    artist_counts = df['artist'].value_counts().head(10)
    
    plt.figure(figsize=(12, 6))
    artist_counts.plot(kind='bar', color='#1DB954')
    plt.title('Top 10 Artists', fontsize=16, fontweight='bold')
    plt.xlabel('Artist', fontsize=12)
    plt.ylabel('Number of Tracks', fontsize=12)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    return plt.gcf()

def main():
    # Custom CSS
    st.markdown("""
    <style>
    .main-title {
        font-size: 3rem;
        color: #1DB954;
        text-align: center;
        margin-bottom: 30px;
    }
    .sub-header {
        color: #1DB954;
        border-bottom: 2px solid #1DB954;
        padding-bottom: 10px;
    }
    .stMetric {
        background-color: #f0f2f6;
        padding: 15px;
        border-radius: 10px;
        text-align: center;
    }
    </style>
    """, unsafe_allow_html=True)

    # Title
    st.markdown('<h1 class="main-title">Spotify Playlist Analyzer</h1>', unsafe_allow_html=True)

    # Spotify Authentication
    sp = get_spotify_client()
    if not sp:
        st.stop()
    
    # Playlist ID Input
    col1, col2 = st.columns([3, 1])
    with col1:
        playlist_id = st.text_input('Enter Spotify Playlist ID', 
                                    help="Find the Playlist ID in the Spotify URL")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        example_btn = st.button("Use Example Playlist")
        if example_btn:
            # Example playlist (e.g., a popular Spotify curated playlist)
            playlist_id = '37i9dQZF1DXcBWIGoYBM5M'
    
    if playlist_id:
        with st.spinner('Fetching playlist details...'):
            try:
                # Get playlist data
                df = get_playlist_features(sp, playlist_id)
                playlist_info = get_playlist_info(sp, playlist_id)
                
                # Playlist Header
                if playlist_info:
                    st.markdown(f'<h2 class="sub-header">{playlist_info["name"]}</h2>', unsafe_allow_html=True)
                    
                    # Playlist Details
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("Total Tracks", playlist_info['total_tracks'])
                    with col2:
                        st.metric("Owner", playlist_info['owner'])
                    with col3:
                        st.metric("Description", playlist_info['description'][:50] + '...' 
                                  if len(playlist_info['description']) > 50 else playlist_info['description'])
                
                # Key Statistics
                st.markdown('<h3 class="sub-header">Track Popularity</h3>', unsafe_allow_html=True)
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric('Average Popularity', f"{df['popularity'].mean():.2f}")
                with col2:
                    st.metric('Median Popularity', f"{df['popularity'].median():.2f}")
                with col3:
                    st.metric('Min Popularity', f"{df['popularity'].min()}")
                with col4:
                    st.metric('Max Popularity', f"{df['popularity'].max()}")
                
                # Visualizations
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown('<h3 class="sub-header">Popularity Distribution</h3>', unsafe_allow_html=True)
                    popularity_plot = create_popularity_plot(df)
                    st.pyplot(popularity_plot)
                
                with col2:
                    st.markdown('<h3 class="sub-header">Top Artists</h3>', unsafe_allow_html=True)
                    artists_plot = create_artists_plot(df)
                    st.pyplot(artists_plot)
                
                # Detailed Track View
                st.markdown('<h3 class="sub-header">Track Details</h3>', unsafe_allow_html=True)
                st.dataframe(df.style.highlight_max(subset=['popularity'], color='lightgreen'))
                
                # Downloadable CSV
                csv = df.to_csv(index=False)
                st.download_button(
                    label="Download Playlist Data",
                    data=csv,
                    file_name='playlist_tracks.csv',
                    mime='text/csv',
                    help="Download a CSV file with detailed track information"
                )
            
            except Exception as e:
                st.error(f"Error analyzing playlist: {e}")
                st.info("Tips:\n- Check the Playlist ID\n- Ensure the playlist is public\n- Verify your Spotify API credentials")

if __name__ == '__main__':
    main()
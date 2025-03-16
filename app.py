import streamlit as st
import spotipy
from spotipy.oauth2 import SpotifyOAuth, SpotifyClientCredentials
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Page configuration
st.set_page_config(
    page_title="Spotify Playlist Analyzer",
    page_icon="🎧",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        'Get Help': 'https://www.spotify.com/help',
        'Report a bug': "mailto:milescoler@gmail.com",
        'About': "# Spotify Playlist Analyzer\nDiscover insights about your playlists and music preferences."
    }
)

# Custom CSS with consolidated styling
st.markdown("""
<style>
    /* Main theme - lighter background for better readability */
    .main {
        background-color: #FFFFFF;
        color: #222222;
    }
    .sidebar .sidebar-content {
        background-color: #F5F5F5;
    }
    
    /* Typography - darker headings on light background */
    h1, h2, h3, .sub-header {
        color: #1DB954;
        font-size: 2rem;
        font-weight: 700;
        margin-top: 1.5rem;
        margin-bottom: 1.5rem;
    }
    .main-title {
        font-size: 3.5rem;
        color: #1DB954;
        text-align: center;
        margin-bottom: 2rem;
    }
    .sub-header {
        font-size: 1.8rem;
        border-bottom: 3px solid #1DB954;
        padding-bottom: 0.8rem;
    }
    
    /* Error messages - more visible */
    .stAlert {
        background-color: #f8f9fa;
        color: #333;
        border-left: 6px solid #1DB954;
        padding: 20px;
        border-radius: 10px;
        font-size: 1.2rem;
        margin: 1.5rem 0;
    }
    
    /* Components - bigger, more modern */
    .stButton>button {
        background-color: #1DB954;
        color: white;
        font-size: 1.2rem;
        padding: 0.6rem 1.5rem;
        border-radius: 30px;
        border: none;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
    }
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 8px rgba(0,0,0,0.15);
    }
    .stProgress .st-bo {
        background-color: #1DB954;
        height: 10px;
        border-radius: 5px;
    }
    .stMetric {
        background-color: #f8f9fa;
        padding: 20px;
        border-radius: 15px;
        text-align: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        margin: 1rem 0;
    }
    .stMetric label {
        font-size: 1.3rem;
        font-weight: 600;
        color: #1DB954;
    }
    .stMetric .metric-value {
        font-size: 2rem;
        font-weight: 700;
    }
    
    /* Form elements - clearer and bigger */
    .stTextInput>div>div>input {
        font-size: 1.1rem;
        padding: 0.8rem;
        border-radius: 8px;
        border: 2px solid #ddd;
    }
    .stTextInput>label {
        font-size: 1.2rem;
        font-weight: 600;
        color: #333;
    }
    .stSelectbox label, .stSlider label {
        font-size: 1.2rem;
        font-weight: 600;
        color: #333;
    }
    
    /* Data display */
    .stDataFrame {
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    }
    
    /* Hide footer */
    footer {
        visibility: hidden;
    }
</style>
""", unsafe_allow_html=True)


def get_spotify_client():
    """Create a Spotify client with full authorization using Streamlit secrets"""
    try:
        # Use Streamlit secrets
        client_id = st.secrets["SPOTIPY_CLIENT_ID"]
        client_secret = st.secrets["SPOTIPY_CLIENT_SECRET"]
        redirect_uri = st.secrets["SPOTIPY_REDIRECT_URI"]

        # Configure Spotipy client with OAuth for full access
        return spotipy.Spotify(auth_manager=SpotifyOAuth(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            scope='playlist-read-private playlist-read-collaborative user-library-read'
        ))
    except KeyError:
        st.markdown("""
        <div style="
            background-color: #f8f9fa;
            border-left: 6px solid #ff4b4b;
            color: #333;
            padding: 20px;
            border-radius: 10px;
            margin: 1.5rem 0;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        ">
            <h3 style="color: #ff4b4b; margin-top: 0;">Spotify Credentials Missing</h3>
            <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">To use this app, you need to set up your Spotify API credentials:</p>
            <ol style="font-size: 1.1rem;">
                <li>Create a Spotify Developer account at <a href="https://developer.spotify.com/dashboard/" target="_blank">developer.spotify.com</a></li>
                <li>Create a new app in the Spotify Developer Dashboard</li>
                <li>Add your credentials to the Streamlit secrets.toml file</li>
            </ol>
        </div>
        """, unsafe_allow_html=True)
    except Exception as e:
        st.markdown(f"""
        <div style="
            background-color: #f8f9fa;
            border-left: 6px solid #ff4b4b;
            color: #333;
            padding: 20px;
            border-radius: 10px;
            margin: 1.5rem 0;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        ">
            <h3 style="color: #ff4b4b; margin-top: 0;">Authentication Error</h3>
            <p style="font-size: 1.2rem;">There was a problem authenticating with Spotify: {e}</p>
        </div>
        """, unsafe_allow_html=True)
    return None


def get_playlist_info(sp, playlist_id):
    """Get basic playlist metadata"""
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


def get_playlist_tracks(sp, playlist_id):
    """Retrieve all tracks from a Spotify playlist with pagination"""
    tracks = []
    results = sp.playlist_tracks(playlist_id)
    tracks.extend(results['items'])
    
    while results['next']:
        results = sp.next(results)
        tracks.extend(results['items'])
    
    return tracks


def prepare_track_dataframe(tracks):
    """Convert track data to a clean DataFrame"""
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
    
    return pd.DataFrame(track_data)


def create_popularity_plot(df):
    """Create a popularity distribution histogram"""
    plt.figure(figsize=(10, 6))
    sns.histplot(data=df, x='popularity', kde=True, color='#1DB954')
    plt.title('Track Popularity Distribution', fontsize=16, fontweight='bold')
    plt.xlabel('Popularity Score', fontsize=12)
    plt.ylabel('Number of Tracks', fontsize=12)
    plt.tight_layout()
    return plt.gcf()


def create_artists_plot(df):
    """Create a bar chart of top 10 artists"""
    artist_counts = df['artist'].value_counts().head(10)
    
    plt.figure(figsize=(12, 6))
    artist_counts.plot(kind='bar', color='#1DB954')
    plt.title('Top 10 Artists', fontsize=16, fontweight='bold')
    plt.xlabel('Artist', fontsize=12)
    plt.ylabel('Number of Tracks', fontsize=12)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    return plt.gcf()


def display_metrics(df, playlist_info):
    """Display metrics about the playlist"""
    # Playlist header
    st.markdown(f'<h2 class="sub-header">{playlist_info["name"]}</h2>', unsafe_allow_html=True)
    
    # Playlist details
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total Tracks", playlist_info['total_tracks'])
    with col2:
        st.metric("Owner", playlist_info['owner'])
    with col3:
        description = playlist_info['description']
        if len(description) > 50:
            description = description[:50] + '...'
        st.metric("Description", description)
    
    # Popularity statistics
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


def display_visualizations(df):
    """Display data visualizations"""
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown('<h3 class="sub-header">Popularity Distribution</h3>', unsafe_allow_html=True)
        popularity_plot = create_popularity_plot(df)
        st.pyplot(popularity_plot)
    
    with col2:
        st.markdown('<h3 class="sub-header">Top Artists</h3>', unsafe_allow_html=True)
        artists_plot = create_artists_plot(df)
        st.pyplot(artists_plot)


def main():
    # App title
    st.markdown("""
    <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 2rem 0;
    ">
        <div style="
            background-color: #1DB954;
            border-radius: 20px;
            padding: 15px 30px;
            box-shadow: 0 8px 16px rgba(29, 185, 84, 0.2);
        ">
            <h1 style="
                font-size: 3rem;
                color: white;
                margin: 0;
                font-weight: 800;
                text-align: center;
            ">🎵 Spotify Playlist Analyzer</h1>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Spotify Authentication
    sp = get_spotify_client()
    if not sp:
        st.stop()
    
    # Playlist ID Input with styled container
    st.markdown("""
    <div style="
        background-color: #f8f9fa;
        border-radius: 15px;
        padding: 25px;
        margin: 20px 0;
        box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    ">
        <h3 style="color: #1DB954; margin-top: 0; font-size: 1.5rem;">Enter a Playlist to Analyze</h3>
    </div>
    """, unsafe_allow_html=True)
    
    col1, col2 = st.columns([3, 1])
    with col1:
        playlist_id = st.text_input('Enter Spotify Playlist ID', 
                                   help="Find the Playlist ID in the Spotify URL",
                                   placeholder="e.g., 37i9dQZF1DXcBWIGoYBM5M")
    with col2:
        st.markdown("<div style='padding-top: 25px;'></div>", unsafe_allow_html=True)
        if st.button("Use Example Playlist", key="example_button"):
            # Example playlist (Top 50 Global)
            playlist_id = '37i9dQZF1DXcBWIGoYBM5M'
    
    if playlist_id:
        with st.spinner('Analyzing playlist...'):
            try:
                # Get playlist data
                playlist_info = get_playlist_info(sp, playlist_id)
                if not playlist_info:
                    st.error("Could not retrieve playlist information.")
                    st.stop()
                    
                # Get and process track data
                tracks = get_playlist_tracks(sp, playlist_id)
                df = prepare_track_dataframe(tracks)
                
                # Display metrics and visualizations
                display_metrics(df, playlist_info)
                display_visualizations(df)
                
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
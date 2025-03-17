import os
import sys
import subprocess

def create_secrets_file():
    """Create a .streamlit/secrets.toml file with placeholder credentials"""
    secrets_dir = '.streamlit'
    secrets_path = os.path.join(secrets_dir, 'secrets.toml')
    
    # Create .streamlit directory if it doesn't exist
    if not os.path.exists(secrets_dir):
        os.makedirs(secrets_dir)
    
    # Create secrets.toml if it doesn't exist
    if not os.path.exists(secrets_path):
        with open(secrets_path, 'w') as f:
            f.write('# Spotify API Credentials\n')
            f.write('SPOTIPY_CLIENT_ID = "your_client_id_here"\n')
            f.write('SPOTIPY_CLIENT_SECRET = "your_client_secret_here"\n')
            f.write('SPOTIPY_REDIRECT_URI = "http://localhost:8501"\n')
        print(f"Created {secrets_path} with placeholder credentials.")
        print("Please update this file with your actual Spotify Developer credentials.")
    else:
        print(f"{secrets_path} already exists. Skipping creation.")

def setup():
    """Setup the Spotify Playlist Analyzer"""
    print("Setting up Spotify Playlist Analyzer...")
    
    # Create secrets file
    create_secrets_file()
    
    # Install dependencies
    try:
        print("Installing required dependencies...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'streamlit', 'spotipy', 'pandas', 'matplotlib', 'seaborn'])
        print("Dependencies installed successfully.")
    except Exception as e:
        print(f"Error installing dependencies: {e}")
    
    print("\nSetup complete!")
    print("Next steps:")
    print("1. Update .streamlit/secrets.toml with your Spotify API credentials")
    print("2. Run the app with: streamlit run app.py")

if __name__ == '__main__':
    setup()
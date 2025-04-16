import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import 'video.js/dist/video-js.css';
import 'videojs-contrib-quality-levels';
import '@silvermine/videojs-quality-selector/dist/css/quality-selector.css';
import 'animate.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5152';

function VideoList() {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/videos`);
        const validVideos = res.data.filter(video => video && video._id && video.filePaths && video.channel);
        setVideos(validVideos);
        if (res.data.length !== validVideos.length) {
          console.warn(`Filtered out ${res.data.length - validVideos.length} invalid video entries`);
        }
      } catch (err) {
        console.error('Error fetching videos:', err);
        setError(err.response?.data.error || 'Failed to load videos');
      }
    };

    fetchVideos();
  }, []);

  const handleUpload = () => {
    navigate('/upload');
  };

  if (error) {
    return <div style={{ textAlign: 'center', color: '#ff4444' }}>{error}</div>;
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #e6f0ff 0%, #ffe6f0 100%)',
      padding: '30px',
      borderRadius: '15px',
      maxWidth: '1200px',
      margin: '0 auto',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
      fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
      color: '#ff69b4'
    }}>
      <h2 style={{ textAlign: 'center', color: '#ff69b4' }}>* Welcome to BugaTube! *</h2>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button
          onClick={handleUpload}
          style={{
            backgroundColor: '#ff69b4',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#ff85c2'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#ff69b4'}
        >
          Upload a Video 📤
        </button>
      </div>
      {videos.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#ff69b4' }}>No videos yet! Be the first to upload one! ✨</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
          {videos.map(video => (
            <div key={video._id} style={{
              backgroundColor: '#fff0f5',
              padding: '15px',
              borderRadius: '10px',
              width: '300px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
              border: '1px solid #ffb6c1',
              transition: 'transform 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Link to={`/watch?v=${video._id}`} style={{ textDecoration: 'none', color: '#ff69b4' }}>
                <img
                  src={`${API_URL}${video.thumbnail}`}
                  alt={video.title}
                  style={{
                    width: '100%',
                    height: '150px',
                    objectFit: 'cover',
                    borderRadius: '10px',
                    marginBottom: '10px'
                  }}
                  onError={(e) => e.target.src = 'https://via.placeholder.com/300x150?text=Thumbnail+Not+Found'}
                />
                <h3 style={{ fontSize: '16px', margin: '0 0 5px 0', color: '#ff69b4' }}>{video.title}</h3>
                <p style={{ fontSize: '14px', margin: '0', color: '#ff8c00' }}>
                  Channel: {video.channel?.email || 'Unknown'}
                </p>
                <p style={{ fontSize: '14px', margin: '0', color: '#ff69b4' }}>
                  Likes: {video.likes?.length || 0}
                </p>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VideoList;

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import 'animate.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5152';

function Channel() {
  const { userId } = useParams();
  const [videos, setVideos] = useState([]);
  const [channel, setChannel] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchChannelVideos = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/videos/channel/${userId}`);
        setVideos(res.data);
        if (res.data.length > 0) {
          setChannel(res.data[0].channel);
        }
      } catch (err) {
        console.error('Error fetching channel videos:', err);
        setError('Failed to load channel videos');
      }
    };

    fetchChannelVideos();
  }, [userId]);

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
      <h2 style={{ textAlign: 'center', color: '#ff69b4' }}>
        {channel ? `${channel.email}'s Channel` : 'Loading Channel...'} 🎬
      </h2>
      {videos.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#ff69b4', fontSize: '18px' }}>
          No videos found for this channel! ✨
        </p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '20px'
        }}>
          {videos.map(video => (
            <div key={video._id} className="animate__animated animate__fadeIn" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              padding: '10px',
              borderRadius: '10px',
              border: '2px solid #ffb6c1',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              position: 'relative'
            }}>
              <Link to={`/watch?v=${video._id}`}>
                <img
                  src={`${API_URL}${video.thumbnail}`}
                  alt={video.title}
                  style={{
                    width: '100%',
                    height: '120px',
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                  onError={(e) => console.error('Thumbnail load error:', `${API_URL}${video.thumbnail}`)}
                />
              </Link>
              <h3 style={{
                color: '#ff69b4',
                fontSize: '14px',
                margin: '10px 0 5px 0',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                <Link to={`/watch?v=${video._id}`} style={{ color: '#ff69b4' }}>{video.title}</Link>
              </h3>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Channel;

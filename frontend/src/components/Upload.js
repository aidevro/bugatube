import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import 'animate.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5152';
const WS_URL = API_URL.replace('http', 'ws');

function Upload() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const wsRef = React.useRef(null);

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    wsRef.current = new WebSocket(WS_URL);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      if (token) {
        wsRef.current.send(JSON.stringify({ type: 'auth', token }));
      }
    };

    wsRef.current.onmessage = (event) => {
       const data = JSON.parse(event.data);
       console.log('WebSocket message received:', data);
       if (data.type === 'queueUpdate') {
         setQueue(data.queue);
       }
     };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
      setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
    };

    wsRef.current.onerror = (err) => console.error('WebSocket error:', err);
  };

  useEffect(() => {
    // Fetch initial queue state
    const fetchQueue = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/videos/queue`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setQueue(res.data);
      } catch (err) {
        console.error('Failed to fetch queue status:', err);
        setError(err.response?.data.error || 'Failed to fetch queue status');
      }
    };

    fetchQueue();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title) {
      setError('Please provide a title and select a file');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);

    try {
      await axios.post(`${API_URL}/api/videos/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setTitle('');
      setFile(null);
      setError('');
      navigate('/'); // Redirect to videos page after successful upload
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data.error || 'Failed to upload video');
    }
  };

  const handleYoutubeDownload = async (e) => {
    e.preventDefault();
    if (!youtubeUrl) {
      setError('Please provide a YouTube URL');
      return;
    }

    try {
      await axios.post(`${API_URL}/api/videos/youtube`, { url: youtubeUrl }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setYoutubeUrl('');
      setError('');
    } catch (err) {
      console.error('YouTube download error:', err);
      setError(err.response?.data.error || 'Failed to queue YouTube video');
    }
  };

  const handleClearFailed = async () => {
    try {
      await axios.delete(`${API_URL}/api/videos/queue/failed`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setError('');
    } catch (err) {
      console.error('Clear failed error:', err);
      setError(err.response?.data.error || 'Failed to clear failed downloads');
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #e6f0ff 0%, #ffe6f0 100%)',
      padding: '30px',
      borderRadius: '15px',
      maxWidth: '800px',
      margin: '0 auto',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
      fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
      color: '#ff69b4'
    }}>
      <h2 style={{ textAlign: 'center', color: '#ff69b4' }}>* Upload Your Magical Videos! *</h2>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <Link to="/" style={{
          textDecoration: 'none',
          color: '#ff8c00',
          fontSize: '18px',
          display: 'inline-flex',
          alignItems: 'center'
        }}>
          <span style={{ marginRight: '5px' }}>🏠</span> Back to Videos
        </Link>
      </div>
      {error && <div style={{ textAlign: 'center', color: '#ff4444', marginBottom: '20px' }}>{error}</div>}
      <div style={{ marginBottom: '20px', border: '2px dashed #ffb6c1', padding: '20px', borderRadius: '10px' }}>
        <h3 style={{ color: '#ff69b4', textAlign: 'center' }}>Upload a Local Video</h3>
        <form onSubmit={handleUpload}>
          <input
            type="text"
            placeholder="Video Title (required)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '10px',
              border: '2px solid #ffb6c1',
              fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
              backgroundColor: '#fff0f5'
            }}
          />
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              border: '2px solid #ffb6c1',
              fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
              backgroundColor: '#fff0f5'
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: '#ff69b4',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              marginTop: '10px',
              fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#ff85c2'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#ff69b4'}
          >
            Upload 🌟
          </button>
        </form>
      </div>
      <div style={{ marginBottom: '20px', border: '2px dashed #ffb6c1', padding: '20px', borderRadius: '10px' }}>
        <h3 style={{ color: '#ff69b4', textAlign: 'center' }}>Download from YouTube</h3>
        <form onSubmit={handleYoutubeDownload}>
          <input
            type="text"
            placeholder="YouTube URL (e.g., https://youtube.com/watch?v=TLjGReNt2q4)"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '10px',
              border: '2px solid #ffb6c1',
              fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
              backgroundColor: '#fff0f5'
            }}
          />
          <button
            type="submit"
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
            Add to Download Queue 🌈
          </button>
        </form>
      </div>
      <div style={{ border: '2px dashed #ffb6c1', padding: '20px', borderRadius: '10px' }}>
        <h3 style={{ color: '#ff69b4', textAlign: 'center' }}>Processing Queue</h3>
        {queue.length > 0 ? (
          <>
            <ul style={{ listStyle: 'none', padding: '0' }}>
              {queue.map(item => (
                <li key={item.videoId} style={{
                  backgroundColor: '#fff0f5',
                  padding: '10px',
                  marginBottom: '10px',
                  borderRadius: '10px',
                  border: '1px solid #ffb6c1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{item.title}</span>
                  <span>
                    {item.status === 'pending' ? `${item.stage}: ${Math.round(item.progress)}%` : item.status === 'completed' ? 'Completed' : 'Failed'}
                  </span>
                  {item.status === 'pending' && (
                    <div style={{
                      width: '100%',
                      backgroundColor: '#f0f0f0',
                      borderRadius: '5px',
                      marginTop: '5px'
                    }}>
                      <div style={{
                        width: `${item.progress}%`,
                        height: '10px',
                        backgroundColor: '#ff69b4',
                        borderRadius: '5px'
                      }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <button
              onClick={handleClearFailed}
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
              Clear Failed Downloads 🧹
            </button>
          </>
        ) : (
          <p style={{ textAlign: 'center', color: '#ff69b4' }}>No videos in queue! ✨</p>
        )}
      </div>
    </div>
  );
}

export default Upload;

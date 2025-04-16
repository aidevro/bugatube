import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import 'video.js/dist/video-js.css';
import videojs from 'video.js';
import 'videojs-contrib-quality-levels';
import '@silvermine/videojs-quality-selector/dist/css/quality-selector.css';
import 'animate.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5152';

const VideoPlayer = ({ video, onClose }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [playerError, setPlayerError] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !containerRef.current) {
      setPlayerError('Video player failed to initialize: Element not found.');
      setUseFallback(true);
      return;
    }

    const player = videojs(videoRef.current, {
      controls: true,
      fluid: true,
      autoplay: false,
      preload: 'auto',
      sources: [
        { src: `${API_URL}${video.filePaths.low}`, type: 'video/mp4', label: '320p' },
        ...(video.filePaths.high ? [{ src: `${API_URL}${video.filePaths.high}`, type: 'video/mp4', label: '1080p' }] : [])
      ]
    });

    const qualitySelectorFactory = require('@silvermine/videojs-quality-selector')(videojs);
    if (!videojs.getComponent('QualitySelector')) {
      videojs.registerComponent('QualitySelector', qualitySelectorFactory);
    }
    if (player.controlBar && !player.controlBar.getChild('QualitySelector')) {
      player.controlBar.addChild('QualitySelector');
    }

    player.on('error', () => {
      const error = player.error();
      setPlayerError(error.message || 'Failed to load video.');
      setUseFallback(true);
    });

    player.on('loadedmetadata', () => console.log('Video metadata loaded'));
    player.on('ready', () => {
      setIsPlayerReady(true);
    });
    player.on('play', () => console.log('Video playback started'));

    playerRef.current = player;

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [video]);

  if (playerError) {
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ textAlign: 'center', color: '#ff4444' }}>{playerError}</div>
        {useFallback && (
          <video
            controls
            width="100%"
            style={{ borderRadius: '10px', display: 'block', minHeight: '360px' }}
          >
            <source src={`${API_URL}${video.filePaths.low}`} type="video/mp4" />
            <source src={`${API_URL}${video.filePaths.high}`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#ff8c00',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#ffa500'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#ff8c00'}
          >
            Close Player 🎥
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ marginBottom: '20px' }}>
      {!isPlayerReady && <div style={{ textAlign: 'center', color: '#ff69b4' }}>Loading video player...</div>}
      <video
        ref={videoRef}
        className="video-js vjs-default-skin vjs-big-play-centered"
        controls
        width="100%"
        style={{ borderRadius: '10px', display: 'block', minHeight: '360px', visibility: isPlayerReady ? 'visible' : 'hidden' }}
        data-setup='{"fluid": true}'
      />
      <div style={{ marginTop: '10px', textAlign: 'center' }}>
        <button
          onClick={onClose}
          style={{
            backgroundColor: '#ff8c00',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#ffa500'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#ff8c00'}
        >
          Close Player 🎥
        </button>
      </div>
    </div>
  );
};

function Watch() {
  const [video, setVideo] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoId = searchParams.get('v');

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/videos/${videoId}`);
        setVideo(res.data);
      } catch (err) {
        console.error('Error fetching video:', err);
        setError(err.response?.data.error || 'Failed to load video');
      }
    };

    if (videoId) {
      fetchVideo();
    } else {
      setError('No video ID provided');
    }

    try {
      const token = localStorage.getItem('token');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUser(decoded);
      }
    } catch (err) {
      console.error('Error decoding token:', err);
    }
  }, [videoId]);

  const handleLike = async () => {
    if (!user) {
      setError('Please log in to like videos');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/api/videos/${videoId}/like`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setVideo({ ...video, likes: res.data.likes });
      setError('');
    } catch (err) {
      console.error('Like error:', err);
      setError(err.response?.data.error || 'Failed to like video');
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to comment');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/api/videos/${videoId}/comment`, { text: commentText }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setVideo({ ...video, comments: res.data.comments });
      setCommentText('');
      setError('');
    } catch (err) {
      console.error('Comment error:', err);
      setError(err.response?.data.error || 'Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!user) {
      setError('Please log in to delete comments');
      return;
    }
    try {
      const res = await axios.delete(`${API_URL}/api/videos/${videoId}/comment/${commentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setVideo({ ...video, comments: res.data.comments });
      setError('');
    } catch (err) {
      console.error('Delete comment error:', err);
      setError(err.response?.data.error || 'Failed to delete comment');
    }
  };

  const handleShare = () => {
    const shareUrl = `http://89.33.193.13:5151/watch?v=${videoId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setError('Video URL copied to clipboard!');
      }).catch(() => {
        setError('Failed to copy URL. Please copy manually: ' + shareUrl);
      });
    } else {
      setError('Failed to copy URL. Please copy manually: ' + shareUrl);
    }
  };

  const handleClosePlayer = () => {
    navigate('/');
  };

  if (error) {
    return <div style={{ textAlign: 'center', color: '#ff4444' }}>{error}</div>;
  }

  if (!video) {
    return <div style={{ textAlign: 'center', color: '#ff69b4' }}>Loading...</div>;
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
      <h2 style={{ textAlign: 'center', color: '#ff69b4' }}>{video.title}</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <p style={{ color: '#ff69b4' }}>
            Channel: <Link to={`/channel/${video.channel._id}`} style={{ color: '#ff8c00' }}>{video.channel.email}</Link>
          </p>
          <p style={{ color: '#ff69b4' }}>Likes: {video.likes.length}</p>
        </div>
        <button
          onClick={handleShare}
          style={{
            backgroundColor: '#ff8c00',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#ffa500'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#ff8c00'}
        >
          Share 📤
        </button>
      </div>
      <VideoPlayer video={video} onClose={handleClosePlayer} />
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={handleLike}
          style={{
            backgroundColor: user && video.likes.includes(user.id) ? '#ff4444' : '#ff69b4',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            marginRight: '10px',
            fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = user && video.likes.includes(user.id) ? '#ff6666' : '#ff85c2'}
          onMouseOut={(e) => e.target.style.backgroundColor = user && video.likes.includes(user.id) ? '#ff4444' : '#ff69b4'}
        >
          {user && video.likes.includes(user.id) ? 'Unlike ❤️' : 'Like ❤️'}
        </button>
      </div>
      <div style={{ marginTop: '20px' }}>
        <h3 style={{ color: '#ff69b4' }}>Comments</h3>
        {user ? (
          <form onSubmit={handleComment}>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                border: '2px solid #ffb6c1',
                fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
                backgroundColor: '#fff0f5',
                marginBottom: '10px'
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
              Comment 💬
            </button>
          </form>
        ) : (
          <p style={{ color: '#ff69b4' }}>Please log in to comment</p>
        )}
        {video.comments.length > 0 ? (
          video.comments.map(comment => (
            <div key={comment._id} style={{
              backgroundColor: '#fff0f5',
              padding: '10px',
              borderRadius: '10px',
              marginBottom: '10px',
              border: '1px solid #ffb6c1'
            }}>
              <p style={{ color: '#ff69b4' }}>
                <strong>{comment.userId.email}</strong> - {new Date(comment.createdAt).toLocaleString()}
              </p>
              <p style={{ color: '#ff69b4' }}>{comment.text}</p>
              {(user && (user.id === comment.userId._id || user.role === 'admin')) && (
                <button
                  onClick={() => handleDeleteComment(comment._id)}
                  style={{
                    backgroundColor: '#ff4444',
                    color: 'white',
                    padding: '5px 10px',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#ff6666'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#ff4444'}
                >
                  Delete 🗑️
                </button>
              )}
            </div>
          ))
        ) : (
          <p style={{ color: '#ff69b4' }}>No comments yet</p>
        )}
      </div>
    </div>
  );
}

export default Watch;

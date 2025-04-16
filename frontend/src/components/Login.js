import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import 'animate.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5152';
console.log('API_URL:', API_URL);

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isSignup ? 'signup' : 'login';
    try {
      console.log(`Sending ${endpoint} request to:`, `${API_URL}/api/auth/${endpoint}`);
      const response = await axios.post(`${API_URL}/api/auth/${endpoint}`, { email, password });
      localStorage.setItem('token', response.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data.error || `${endpoint.charAt(0).toUpperCase() + endpoint.slice(1)} failed`);
      console.error(`${endpoint} error:`, err);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffe6f0 0%, #e6f0ff 100%)',
      padding: '30px',
      borderRadius: '15px',
      maxWidth: '400px',
      margin: '50px auto',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
      fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
      color: '#ff69b4'
    }}>
      <h2 className="animate__animated animate__bounceIn" style={{ textAlign: 'center', color: '#ff69b4' }}>
        {isSignup ? '✨ Sign Up for BugaTube! ✨' : '✨ Sign In to BugaTube! ✨'}
      </h2>
      {error && (
        <p style={{ textAlign: 'center', color: '#ff4444', fontSize: '16px' }}>{error}</p>
      )}
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email 🌟"
          required
          style={{
            padding: '10px',
            marginBottom: '10px',
            width: '100%',
            borderRadius: '10px',
            border: '2px solid #ffb6c1',
            fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
            backgroundColor: '#fff0f5'
          }}
        />
        <br />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password 🦄"
          required
          style={{
            padding: '10px',
            marginBottom: '10px',
            width: '100%',
            borderRadius: '10px',
            border: '2px solid #ffb6c1',
            fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
            backgroundColor: '#fff0f5'
          }}
        />
        <br />
        <button
          type="submit"
          style={{
            backgroundColor: '#ff69b4',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'block',
            margin: '0 auto 10px',
            fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#ff85c2'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#ff69b4'}
        >
          {isSignup ? 'Sign Up 🌈' : 'Sign In 🌈'}
        </button>
      </form>
      <button
        onClick={() => setIsSignup(!isSignup)}
        style={{
          backgroundColor: '#ff8c00',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          display: 'block',
          margin: '0 auto',
          fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive",
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#ffa500'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#ff8c00'}
      >
        {isSignup ? 'Switch to Sign In' : 'Switch to Sign Up'}
      </button>
    </div>
  );
}

export default Login;

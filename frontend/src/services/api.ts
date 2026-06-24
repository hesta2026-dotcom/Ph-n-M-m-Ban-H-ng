import axios from 'axios'

const NGROK_URL = 'https://plausible-quarrel-comprised.ngrok-free.dev'
const isDev = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.')
const baseURL = isDev ? '/api' : `${NGROK_URL}/api`

const api = axios.create({ baseURL, withCredentials: true })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Bypass ngrok browser warning page
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

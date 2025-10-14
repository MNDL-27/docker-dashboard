// server/docker/qbittorrentClient.js
const axios = require('axios');

class QBittorrentClient {
  constructor(baseUrl, username, password) {
    this.baseUrl = baseUrl || 'http://localhost:8080';
    this.username = username || 'admin';
    this.password = password || 'adminadmin';
    this.cookie = null;
  }

  /**
   * Login to qBittorrent WebUI and get session cookie
   */
  async login() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v2/auth/login`,
        `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Extract cookie from response
      const cookies = response.headers['set-cookie'];
      if (cookies && cookies.length > 0) {
        this.cookie = cookies[0].split(';')[0];
        return true;
      }
      return false;
    } catch (error) {
      console.error('qBittorrent login failed:', error.message);
      return false;
    }
  }

  /**
   * Get transfer info (bandwidth statistics)
   */
  async getTransferInfo() {
    try {
      // Login if not already authenticated
      if (!this.cookie) {
        const loggedIn = await this.login();
        if (!loggedIn) {
          throw new Error('Failed to authenticate with qBittorrent');
        }
      }

      const response = await axios.get(`${this.baseUrl}/api/v2/transfer/info`, {
        headers: {
          Cookie: this.cookie,
        },
      });

      return {
        success: true,
        data: {
          // Total data downloaded (bytes)
          dlInfoData: response.data.dl_info_data || 0,
          // Total data uploaded (bytes)
          upInfoData: response.data.up_info_data || 0,
          // Current download speed (bytes/s)
          dlInfoSpeed: response.data.dl_info_speed || 0,
          // Current upload speed (bytes/s)
          upInfoSpeed: response.data.up_info_speed || 0,
          // Connection status
          connectionStatus: response.data.connection_status || 'disconnected',
        },
      };
    } catch (error) {
      // If unauthorized, try to login again
      if (error.response && error.response.status === 403) {
        this.cookie = null;
        return this.getTransferInfo();
      }
      
      console.error('Failed to get qBittorrent transfer info:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get torrents list
   */
  async getTorrents() {
    try {
      if (!this.cookie) {
        const loggedIn = await this.login();
        if (!loggedIn) {
          throw new Error('Failed to authenticate with qBittorrent');
        }
      }

      const response = await axios.get(`${this.baseUrl}/api/v2/torrents/info`, {
        headers: {
          Cookie: this.cookie,
        },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      if (error.response && error.response.status === 403) {
        this.cookie = null;
        return this.getTorrents();
      }
      
      console.error('Failed to get qBittorrent torrents:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = QBittorrentClient;
